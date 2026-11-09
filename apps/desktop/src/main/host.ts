import { EventEmitter } from "node:events";
import { WebSocketServer, WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { PinManager, deriveKey, macEquals, randomHex, sdpMac } from "./pairing.ts";
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, parseMessage, type Message } from "../shared/protocol.ts";

export const HANDSHAKE_TIMEOUT_MS = 15_000;
export const CONSENT_TIMEOUT_MS = 30_000;
const MAX_PENDING = 4;

export interface ConnectionRequest {
  requestId: string;
  name: string;
  address: string;
  offerSdp: string;
}

export interface HostEvents {
  request: [ConnectionRequest];
  /** A session was established after consent. */
  connected: [{ requestId: string; name: string; address: string }];
  ended: [{ reason: "bye" | "closed" | "stopped" | "killed" }];
  recording: [{ on: boolean }];
  pin: [{ state: "locked" | "expired" | "used" }];
  attempt: [{ ok: boolean; remaining?: number; address: string }];
}

interface Pending {
  ws: WebSocket;
  key: Buffer;
  nonceV: string;
  nonceH: string;
  name: string;
  address: string;
  timer: NodeJS.Timeout;
}

const send = (ws: WebSocket, m: Message) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

/**
 * Accepts viewers on the LAN. A viewer must prove knowledge of the current PIN
 * (HMAC over its SDP offer), then the local user must explicitly accept.
 * Only one active session at a time. Holds no media: WebRTC runs in the renderer.
 */
export class HostServer extends EventEmitter<HostEvents> {
  readonly pins: PinManager;
  private wss: WebSocketServer | null = null;
  private pending = new Map<string, Pending>();
  private session: { ws: WebSocket; requestId: string } | null = null;

  private hostName: () => string;

  constructor(hostName: () => string, now?: () => number) {
    super();
    this.hostName = hostName;
    this.pins = new PinManager(now);
  }

  get port(): number | null {
    return this.wss ? (this.wss.address() as AddressInfo).port : null;
  }

  get inSession(): boolean {
    return this.session !== null;
  }

  async start(port: number, host = "0.0.0.0"): Promise<number> {
    if (this.wss) return this.port!;
    const wss = new WebSocketServer({ port, host, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });
    await new Promise<void>((resolve, reject) => {
      wss.once("listening", resolve);
      wss.once("error", reject);
    });
    wss.on("connection", (ws, req) => this.onConnection(ws, req.socket.remoteAddress ?? "?"));
    this.wss = wss;
    return this.port!;
  }

  issuePin() {
    return this.pins.issue();
  }

  /** Stop accepting and end everything. */
  async stop(reason: "stopped" | "killed" = "stopped"): Promise<void> {
    this.pins.revoke();
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.ws.terminate();
      this.pending.delete(id);
    }
    this.endSession(reason);
    const wss = this.wss;
    this.wss = null;
    if (wss) {
      for (const c of wss.clients) c.terminate();
      await new Promise<void>((r) => wss.close(() => r()));
    }
  }

  /** User accepted: send the authenticated answer and open the session. */
  accept(requestId: string, answerSdp: string): boolean {
    const p = this.pending.get(requestId);
    if (!p || this.session) return false;
    clearTimeout(p.timer);
    this.pending.delete(requestId);
    send(p.ws, { t: "answer", sdp: answerSdp, mac: sdpMac(p.key, "answer", p.nonceV, p.nonceH, answerSdp) });
    this.session = { ws: p.ws, requestId };
    this.emit("connected", { requestId, name: p.name, address: p.address });
    return true;
  }

  refuse(requestId: string): void {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(requestId);
    send(p.ws, { t: "error", code: "refused" });
    p.ws.close();
  }

  setRecording(on: boolean) {
    if (this.session) send(this.session.ws, { t: "recording", on });
  }

  endSession(reason: "bye" | "closed" | "stopped" | "killed" = "stopped") {
    const s = this.session;
    if (!s) return;
    this.session = null;
    send(s.ws, { t: "bye" });
    s.ws.close();
    this.emit("ended", { reason });
  }

  private onConnection(ws: WebSocket, address: string) {
    if (this.pending.size >= MAX_PENDING) {
      ws.terminate();
      return;
    }
    const nonceH = randomHex();
    let stage: "hello" | "offer" | "pending" | "session" = "hello";
    let nonceV = "";
    let name = "";
    let salt = "";
    const handshakeTimer = setTimeout(() => {
      if (stage === "hello" || stage === "offer") {
        send(ws, { t: "error", code: "timeout" });
        ws.terminate();
      }
    }, HANDSHAKE_TIMEOUT_MS);
    const fail = (code: Message & { t: "error" }) => {
      send(ws, code);
      ws.close();
    };

    ws.on("close", () => {
      clearTimeout(handshakeTimer);
      for (const [id, p] of this.pending) {
        if (p.ws === ws) {
          clearTimeout(p.timer);
          this.pending.delete(id);
        }
      }
      if (this.session?.ws === ws) {
        this.session = null;
        this.emit("ended", { reason: "closed" });
      }
    });
    ws.on("error", () => ws.terminate());

    ws.on("message", async (data, isBinary) => {
      if (isBinary) return ws.terminate();
      const m = parseMessage(data.toString());
      if (!m) return fail({ t: "error", code: "protocol" });

      if (stage === "hello") {
        if (m.t !== "hello") return fail({ t: "error", code: "protocol" });
        if (m.v !== PROTOCOL_VERSION) return fail({ t: "error", code: "version" });
        if (this.session) return fail({ t: "error", code: "busy" });
        const active = this.pins.active();
        if (!("pin" in active)) return fail({ t: "error", code: active.reason === "none" ? "not-accepting" : active.reason });
        nonceV = m.nonce;
        name = m.name;
        salt = this.pins.salt;
        stage = "offer";
        send(ws, { t: "challenge", v: PROTOCOL_VERSION, hostName: this.hostName(), salt, nonce: nonceH });
        return;
      }

      if (stage === "offer") {
        if (m.t !== "offer") return fail({ t: "error", code: "protocol" });
        stage = "pending";
        const active = this.pins.active();
        if (!("pin" in active) || this.pins.salt !== salt) {
          if ("reason" in active && active.reason === "expired") this.emit("pin", { state: "expired" });
          return fail({ t: "error", code: "reason" in active && active.reason !== "none" ? active.reason : "expired" });
        }
        const key = await deriveKey(active.pin, salt);
        const ok = macEquals(m.mac, sdpMac(key, "offer", nonceV, nonceH, m.sdp));
        const result = this.pins.record(ok);
        this.emit("attempt", { ok: result.ok, remaining: result.ok ? undefined : result.remaining, address });
        if (!result.ok) {
          if (result.reason === "locked") this.emit("pin", { state: "locked" });
          return fail({ t: "error", code: result.reason === "none" ? "expired" : result.reason, remaining: result.remaining });
        }
        this.emit("pin", { state: "used" });
        clearTimeout(handshakeTimer);
        if (this.session) return fail({ t: "error", code: "busy" });
        const requestId = randomHex(8);
        const timer = setTimeout(() => {
          if (this.pending.has(requestId)) {
            this.pending.delete(requestId);
            fail({ t: "error", code: "timeout" });
          }
        }, CONSENT_TIMEOUT_MS);
        this.pending.set(requestId, { ws, key, nonceV, nonceH, name, address, timer });
        stage = "session";
        this.emit("request", { requestId, name, address, offerSdp: m.sdp });
        return;
      }

      if (stage === "session" && this.session?.ws === ws) {
        if (m.t === "recording") this.emit("recording", { on: m.on });
        else if (m.t === "bye") {
          this.session = null;
          ws.close();
          this.emit("ended", { reason: "bye" });
        }
      }
    });
  }
}
