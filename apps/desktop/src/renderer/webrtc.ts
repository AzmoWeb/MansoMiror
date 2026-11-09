/**
 * WebRTC helpers. LAN only for now: no STUN/TURN, host candidates only, and
 * non-trickle ICE so the whole SDP (with DTLS fingerprint) is MAC'd at once.
 */
const RTC_CONFIG: RTCConfiguration = { iceServers: [], bundlePolicy: "max-bundle" };
const ICE_TIMEOUT_MS = 5000;

function waitIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ICE_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

export async function createViewer(): Promise<{ pc: RTCPeerConnection; offerSdp: string; stream: Promise<MediaStream> }> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  pc.addTransceiver("video", { direction: "recvonly" });
  const stream = new Promise<MediaStream>((resolve) => {
    pc.ontrack = (e) => resolve(e.streams[0] ?? new MediaStream([e.track]));
  });
  await pc.setLocalDescription(await pc.createOffer());
  await waitIce(pc);
  return { pc, offerSdp: pc.localDescription!.sdp, stream };
}

export async function captureScreen(maxHeight: number, fps: number): Promise<MediaStream> {
  // Constraints passed to getDisplayMedia itself are rejected by some capturers
  // ("Invalid capture constraints"): capture first, then cap size and rate.
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const track = stream.getVideoTracks()[0];
  if (track) {
    track.contentHint = "detail";
    await track
      .applyConstraints({ frameRate: { max: fps }, ...(maxHeight ? { height: { max: maxHeight } } : {}) })
      .catch(() => {});
  }
  return stream;
}

export async function createHost(stream: MediaStream, offerSdp: string, maxBitrate: number): Promise<{ pc: RTCPeerConnection; answerSdp: string }> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  for (const track of stream.getVideoTracks()) {
    const sender = pc.addTrack(track, stream);
    const params = sender.getParameters();
    params.encodings = [{ ...(params.encodings?.[0] ?? {}), maxBitrate }];
    params.degradationPreference = "maintain-resolution";
    void sender.setParameters(params).catch(() => {});
  }
  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await waitIce(pc);
  return { pc, answerSdp: pc.localDescription!.sdp };
}

export function bitrateFor(maxHeight: number, fps: number): number {
  const h = maxHeight || 1440;
  const base = h <= 720 ? 2.5e6 : h <= 1080 ? 5e6 : 9e6;
  return Math.round(base * (fps === 60 ? 1.5 : 1));
}

export interface LiveStats {
  width: number;
  height: number;
  fps: number;
  kbps: number;
  rttMs: number | null;
  lossPct: number;
}

/** Measured (not estimated) receive-side statistics. */
export function watchStats(pc: RTCPeerConnection, cb: (s: LiveStats) => void): () => void {
  let prevBytes = 0;
  let prevTs = 0;
  const timer = setInterval(async () => {
    const report = await pc.getStats();
    let s: LiveStats = { width: 0, height: 0, fps: 0, kbps: 0, rttMs: null, lossPct: 0 };
    report.forEach((r: any) => {
      if (r.type === "inbound-rtp" && r.kind === "video") {
        const kbps = prevTs ? ((r.bytesReceived - prevBytes) * 8) / (r.timestamp - prevTs) : 0;
        prevBytes = r.bytesReceived;
        prevTs = r.timestamp;
        const lost = r.packetsLost ?? 0;
        const total = lost + (r.packetsReceived ?? 0);
        s = { ...s, width: r.frameWidth ?? 0, height: r.frameHeight ?? 0, fps: Math.round(r.framesPerSecond ?? 0), kbps: Math.round(kbps), lossPct: total ? (lost / total) * 100 : 0 };
      }
      if (r.type === "candidate-pair" && r.state === "succeeded" && r.nominated && typeof r.currentRoundTripTime === "number") {
        s.rttMs = Math.round(r.currentRoundTripTime * 1000);
      }
    });
    cb(s);
  }, 1000);
  return () => clearInterval(timer);
}
