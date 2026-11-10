/**
 * Decodes the phone's H.264 stream (Annex-B, scrcpy framing) with WebCodecs
 * and draws each frame on a canvas. Hardware-accelerated when available.
 */
export interface DecoderStats {
  width: number;
  height: number;
  fps: number;
  decoded: number;
}

function findNal(data: Uint8Array, type: number): Uint8Array | null {
  for (let i = 0; i + 4 < data.length; i++) {
    if (data[i] === 0 && data[i + 1] === 0 && (data[i + 2] === 1 || (data[i + 2] === 0 && data[i + 3] === 1))) {
      const start = data[i + 2] === 1 ? i + 3 : i + 4;
      if ((data[start] & 0x1f) === type) return data.subarray(start);
    }
  }
  return null;
}

/** "avc1.PPCCLL" from the SPS (profile, constraints, level). */
export function codecFromConfig(config: Uint8Array): string | null {
  const sps = findNal(config, 7);
  if (!sps || sps.length < 4) return null;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `avc1.${h(sps[1])}${h(sps[2])}${h(sps[3])}`;
}

export class H264CanvasDecoder {
  private decoder: VideoDecoder | null = null;
  private config: Uint8Array | null = null;
  private needKey = true;
  private frames = 0;
  private lastTick = performance.now();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onStats: (s: DecoderStats) => void;
  private onNeedKeyFrame: () => void;
  stats: DecoderStats = { width: 0, height: 0, fps: 0, decoded: 0 };

  constructor(canvas: HTMLCanvasElement, onStats: (s: DecoderStats) => void, onNeedKeyFrame: () => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.onStats = onStats;
    this.onNeedKeyFrame = onNeedKeyFrame;
  }

  private draw(frame: VideoFrame) {
    const w = frame.displayWidth;
    const h = frame.displayHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.drawImage(frame, 0, 0, w, h);
    frame.close();
    this.frames++;
    this.stats.decoded++;
    const now = performance.now();
    if (now - this.lastTick >= 1000) {
      this.stats = { ...this.stats, width: w, height: h, fps: Math.round((this.frames * 1000) / (now - this.lastTick)) };
      this.frames = 0;
      this.lastTick = now;
      this.onStats(this.stats);
    } else if (this.stats.width !== w || this.stats.height !== h) {
      this.stats = { ...this.stats, width: w, height: h };
      this.onStats(this.stats);
    }
  }

  private configure(config: Uint8Array) {
    const codec = codecFromConfig(config);
    if (!codec) return;
    this.decoder?.close();
    this.decoder = new VideoDecoder({
      output: (f) => this.draw(f),
      error: (e) => {
        console.error("decoder error", e?.message);
        // Corrupted state: wait for a fresh key frame.
        this.needKey = true;
        this.decoder = null;
        if (this.config) this.configure(this.config);
        this.onNeedKeyFrame();
      },
    });
    // No `description`: chunks are fed in Annex-B form.
    this.decoder.configure({ codec, optimizeForLatency: true, hardwareAcceleration: "no-preference" });
    this.needKey = true;
  }

  push(p: { config: boolean; key: boolean; pts: number; data: Uint8Array }) {
    if (p.config) {
      this.config = p.data;
      this.configure(p.data);
      return;
    }
    if (!this.decoder || this.decoder.state !== "configured") return;
    if (this.needKey && !p.key) return;
    let data = p.data;
    if (p.key && this.config) {
      // Annex-B decoders want SPS/PPS in front of each key frame.
      data = new Uint8Array(this.config.length + p.data.length);
      data.set(this.config);
      data.set(p.data, this.config.length);
    }
    this.needKey = false;
    // Drop frames rather than build latency when the decoder falls behind.
    if (this.decoder.decodeQueueSize > 6 && !p.key) return;
    this.decoder.decode(new EncodedVideoChunk({ type: p.key ? "key" : "delta", timestamp: p.pts, data }));
  }

  close() {
    try {
      this.decoder?.close();
    } catch {}
    this.decoder = null;
  }
}
