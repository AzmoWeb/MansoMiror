import { EventEmitter } from "node:events";
import { createServer, type Server, type Socket, type AddressInfo } from "node:net";

/**
 * Brings the iPhone's screen into the MansoMirror window.
 *
 * UxPlay (>= 1.74) is started with `-vrtp`, so instead of opening its own
 * window it hands the mirrored H.264 stream to a GStreamer tail that we
 * choose: RTP is immediately depayloaded again and the Annex-B byte stream is
 * sent over a TCP connection to 127.0.0.1 (this server). We split it into
 * access units and pass them to the same WebCodecs decoder used for Android.
 */

export interface H264Packet {
  config: boolean;
  key: boolean;
  pts: number;
  data: Uint8Array;
}

const SC = Uint8Array.of(0, 0, 0, 1);

function concatNals(nals: Uint8Array[]): Uint8Array {
  const len = nals.reduce((n, x) => n + 4 + x.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const n of nals) {
    out.set(SC, o);
    out.set(n, o + 4);
    o += 4 + n.length;
  }
  return out;
}

/**
 * Incremental Annex-B splitter: NAL units → access units → packets.
 * An access unit starts at an AUD, SPS, PPS or SEI following a slice, or at a
 * slice whose first_mb_in_slice is 0 (first bit of the slice header set).
 */
export class AnnexBSplitter {
  private buf = new Uint8Array(0);
  private au: Uint8Array[] = [];
  private auHasSlice = false;
  private onPacket: (p: H264Packet) => void;
  private now: () => number;
  private maxBuffer: number;

  constructor(onPacket: (p: H264Packet) => void, now: () => number = () => Math.round(performance.now() * 1000), maxBuffer = 8 * 1024 * 1024) {
    this.onPacket = onPacket;
    this.now = now;
    this.maxBuffer = maxBuffer;
  }

  private emitAu() {
    if (!this.au.length) return;
    const cfg = this.au.filter((n) => (n[0] & 0x1f) === 7 || (n[0] & 0x1f) === 8);
    const vcl = this.au.filter((n) => {
      const t = n[0] & 0x1f;
      return t >= 1 && t <= 5;
    });
    const pts = this.now();
    if (cfg.length) this.onPacket({ config: true, key: false, pts, data: concatNals(cfg) });
    if (vcl.length) this.onPacket({ config: false, key: vcl.some((n) => (n[0] & 0x1f) === 5), pts, data: concatNals(vcl) });
    this.au = [];
    this.auHasSlice = false;
  }

  private nal(n: Uint8Array) {
    if (n.length === 0) return;
    const t = n[0] & 0x1f;
    const isSlice = t >= 1 && t <= 5;
    const startsAu = isSlice ? n.length > 1 && (n[1] & 0x80) !== 0 : t === 9 || t === 7 || t === 8 || t === 6;
    if (startsAu && this.auHasSlice) this.emitAu();
    if (t === 9) return; // AUD carries no picture data
    this.au.push(n);
    if (isSlice) this.auHasSlice = true;
  }

  push(chunk: Uint8Array) {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    if (merged.length > this.maxBuffer) throw new Error("H.264 stream not framed");
    // Find start codes; the last NAL stays buffered until the next start code arrives.
    let start = -1;
    let i = 0;
    while (i + 3 <= merged.length) {
      if (merged[i] === 0 && merged[i + 1] === 0 && merged[i + 2] === 1) {
        const scStart = i > 0 && merged[i - 1] === 0 ? i - 1 : i;
        if (start >= 0) this.nal(merged.subarray(start, scStart));
        start = i + 3;
        i += 3;
      } else i++;
    }
    this.buf = start >= 0 ? merged.slice(start - 3) : merged;
    if (start >= 0 && this.buf[0] !== 0) this.buf = merged.slice(start - 3);
  }

  /** End of stream: flush the last NAL and access unit. */
  end() {
    const b = this.buf;
    const i = b.length >= 3 && b[0] === 0 && b[1] === 0 && b[2] === 1 ? 3 : -1;
    if (i > 0) this.nal(b.subarray(i));
    this.buf = new Uint8Array(0);
    this.emitAu();
  }
}

/** GStreamer tail appended by UxPlay after `rtph264pay `. */
export function vrtpPipeline(port: number): string {
  return [
    "config-interval=-1",
    "! rtph264depay",
    "! h264parse config-interval=-1",
    "! video/x-h264,stream-format=byte-stream,alignment=au",
    `! tcpclientsink host=127.0.0.1 port=${port} sync=false`,
  ].join(" ");
}

export interface VideoServerEvents {
  streaming: [boolean];
  packet: [H264Packet];
}

/** Without a frame for this long, the iPhone is considered to have stopped mirroring. */
export const IDLE_MS = 2000;

/**
 * Local-only TCP endpoint receiving UxPlay's stream.
 * UxPlay opens its connections when it starts (one per codec pipeline) and
 * keeps them open between sessions, so several idle connections can coexist;
 * "streaming" follows the arrival of video data, not the connections.
 */
export class AirPlayVideoServer extends EventEmitter<VideoServerEvents> {
  private server: Server | null = null;
  private sockets = new Set<Socket>();
  private lastData = 0;
  private streaming = false;
  private timer: NodeJS.Timeout | null = null;
  private idleMs: number;
  port = 0;

  constructor(idleMs = IDLE_MS) {
    super();
    this.idleMs = idleMs;
  }

  async listen(): Promise<number> {
    if (this.server) return this.port;
    const server = createServer((sock) => this.onConnection(sock));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    this.server = server;
    this.port = (server.address() as AddressInfo).port;
    this.timer = setInterval(() => {
      if (this.streaming && Date.now() - this.lastData > this.idleMs) this.setStreaming(false);
    }, 250);
    this.timer.unref?.();
    return this.port;
  }

  private setStreaming(on: boolean) {
    if (this.streaming === on) return;
    this.streaming = on;
    this.emit("streaming", on);
  }

  private onConnection(sock: Socket) {
    // Only UxPlay on this machine may send video (the server listens on 127.0.0.1).
    if (sock.remoteAddress !== "127.0.0.1" && sock.remoteAddress !== "::ffff:127.0.0.1") {
      sock.destroy();
      return;
    }
    this.sockets.add(sock);
    const splitter = new AnnexBSplitter((p) => this.emit("packet", p));
    sock.on("data", (d: Buffer) => {
      this.lastData = Date.now();
      this.setStreaming(true);
      try {
        splitter.push(d);
      } catch {
        sock.destroy();
      }
    });
    sock.on("close", () => {
      this.sockets.delete(sock);
      splitter.end();
    });
    sock.on("error", () => sock.destroy());
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    this.setStreaming(false);
    const s = this.server;
    this.server = null;
    this.port = 0;
    if (s) await new Promise<void>((r) => s.close(() => r()));
  }
}

/**
 * Keeps what a decoder needs to start showing the picture right now: the last
 * SPS/PPS, the last key frame and every frame since. The iPhone only sends a
 * key frame when mirroring starts (and rarely afterwards), so a screen opened
 * a moment later would otherwise stay black.
 */
export class GopCache {
  private config: H264Packet | null = null;
  private gop: H264Packet[] = [];
  private bytes = 0;
  private full = false;
  private maxPackets: number;
  private maxBytes: number;

  constructor(maxPackets = 900, maxBytes = 48 * 1024 * 1024) {
    this.maxPackets = maxPackets;
    this.maxBytes = maxBytes;
  }

  push(p: H264Packet) {
    if (p.config) {
      this.config = p;
      return;
    }
    if (p.key) {
      this.gop = [p];
      this.bytes = p.data.length;
      this.full = false;
      return;
    }
    if (!this.gop.length || this.full) return;
    if (this.gop.length >= this.maxPackets || this.bytes + p.data.length > this.maxBytes) {
      // Too long without a key frame: keep the key frame, stop growing.
      this.full = true;
      return;
    }
    this.gop.push(p);
    this.bytes += p.data.length;
  }

  /** Packets to replay, in decoding order (empty until a config and a key frame were seen). */
  snapshot(): H264Packet[] {
    return this.config && this.gop.length ? [this.config, ...this.gop] : [];
  }

  clear() {
    this.config = null;
    this.gop = [];
    this.bytes = 0;
    this.full = false;
  }
}
