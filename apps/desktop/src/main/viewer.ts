import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { deriveKey, macEquals, randomHex, sdpMac } from "./pairing.ts";
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, parseMessage, type ErrorCode, type Message } from "../shared/protocol.ts";

export class PairingError extends Error {
  readonly code: ErrorCode | "unreachable" | "mitm";
  readonly remaining?: number;

  constructor(code: ErrorCode | "unreachable" | "mitm", remaining?: number) {
    super(code);
    this.code = code;
    this.remaining = remaining;
  }
}

export interface ViewerEvents {
  recording: [{ on: boolean }];
  ended: [{ reason: "bye" | "closed" | "local" }];
}

/** Long enough to cover the host user reading and accepting the request. */
export const VIEWER_TIMEOUT_MS = 45_000;

const send = (ws: WebSocket, m: Message) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

export class ViewerClient extends EventEmitter<ViewerEvents> {
  private ws: WebSocket | null = null;

  get connected() {
    return this.ws !== null;
  }

  /**
   * Authenticate with the PIN, send our SDP offer, and return the host's
   * verified answer. Rejects with PairingError on any failure.
   */
  connect(opts: { host: string; port: number; pin: string; name: string; offerSdp: string }): Promise<{ answerSdp: string; hostName: string }> {
    if (this.ws) return Promise.reject(new PairingError("busy"));
    if (!/^\d{6}$/.test(opts.pin)) return Promise.reject(new PairingError("bad-pin"));

    const url = `ws://${opts.host.includes(":") ? `[${opts.host}]` : opts.host}:${opts.port}`;
    const ws = new WebSocket(url, { maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false, handshakeTimeout: 5000 });
    const nonceV = randomHex();
    let key: Buffer | null = null;
    let nonceH = "";
    let hostName = "";
    let done = false;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new PairingError("timeout")), VIEWER_TIMEOUT_MS);
      const finish = (err: PairingError | null, value?: { answerSdp: string; hostName: string }) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) {
          ws.removeAllListeners("close");
          ws.on("error", () => {});
          ws.terminate();
          reject(err);
        } else {
          this.ws = ws;
          resolve(value!);
        }
      };

      ws.on("error", () => finish(new PairingError("unreachable")));
      ws.on("open", () => send(ws, { t: "hello", v: PROTOCOL_VERSION, name: opts.name, nonce: nonceV }));
      ws.on("close", () => {
        if (!done) finish(new PairingError("unreachable"));
        else if (this.ws === ws) {
          this.ws = null;
          this.emit("ended", { reason: "closed" });
        }
      });

      ws.on("message", async (data, isBinary) => {
        if (isBinary) return finish(new PairingError("protocol"));
        const m = parseMessage(data.toString());
        if (!m) return finish(new PairingError("protocol"));

        if (!done) {
          if (m.t === "error") return finish(new PairingError(m.code, m.remaining));
          if (m.t === "challenge" && !key) {
            if (m.v !== PROTOCOL_VERSION) return finish(new PairingError("version"));
            nonceH = m.nonce;
            hostName = m.hostName;
            key = await deriveKey(opts.pin, m.salt);
            send(ws, { t: "offer", sdp: opts.offerSdp, mac: sdpMac(key, "offer", nonceV, nonceH, opts.offerSdp) });
            return;
          }
          if (m.t === "answer" && key) {
            // The host proves it knows the PIN too, and binds its DTLS fingerprint.
            if (!macEquals(m.mac, sdpMac(key, "answer", nonceV, nonceH, m.sdp))) return finish(new PairingError("mitm"));
            return finish(null, { answerSdp: m.sdp, hostName });
          }
          return finish(new PairingError("protocol"));
        }

        if (m.t === "recording") this.emit("recording", { on: m.on });
        else if (m.t === "bye" && this.ws === ws) {
          this.ws = null;
          ws.close();
          this.emit("ended", { reason: "bye" });
        }
      });
    });
  }

  setRecording(on: boolean) {
    if (this.ws) send(this.ws, { t: "recording", on });
  }

  disconnect() {
    const ws = this.ws;
    if (!ws) return;
    this.ws = null;
    send(ws, { t: "bye" });
    ws.close();
    this.emit("ended", { reason: "local" });
  }
}
