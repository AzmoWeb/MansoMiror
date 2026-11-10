import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AirPlayVideoServer, AnnexBSplitter, vrtpPipeline, type H264Packet } from "../../src/main/airplay-video.ts";

const clip = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "phone-360x640.h264"));
const FRAMES = 90; // 3 s at 30 fps

function split(data: Uint8Array, step: number, stripAud: boolean) {
  let buf = data;
  if (stripAud) {
    // remove "00 00 00 01 09 xx" access unit delimiters
    const parts: number[] = [];
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 0 && buf[i + 3] === 1 && (buf[i + 4] & 0x1f) === 9) {
        i += 5;
        continue;
      }
      parts.push(buf[i]);
    }
    buf = Uint8Array.from(parts);
  }
  const out: H264Packet[] = [];
  const s = new AnnexBSplitter((p) => out.push(p), () => 0);
  for (let i = 0; i < buf.length; i += step) s.push(buf.subarray(i, i + step));
  s.end();
  return out;
}

for (const stripAud of [false, true]) {
  test(`splitter finds every frame${stripAud ? " (no AUD)" : ""}, config first, key frames flagged`, () => {
    for (const step of [7, 1000, clip.length]) {
      const p = split(clip, step, stripAud);
      const frames = p.filter((x) => !x.config);
      assert.equal(frames.length, FRAMES, `step ${step}`);
      assert.equal(p[0].config, true);
      assert.equal(p[1].key, true);
      assert.equal(frames.filter((f) => f.key).length, 3, "one IDR per second (-g 30)");
      for (const f of p) assert.deepEqual([...f.data.subarray(0, 4)], [0, 0, 0, 1]);
    }
  });
}

test("the -vrtp tail sends Annex-B access units to 127.0.0.1 only", () => {
  const p = vrtpPipeline(4567);
  assert.match(p, /^config-interval=-1 ! rtph264depay ! h264parse config-interval=-1 ! video\/x-h264,stream-format=byte-stream,alignment=au ! tcpclientsink host=127\.0\.0\.1 port=4567/);
});

let gst = "";
try {
  gst = execFileSync("sh", ["-c", "command -v gst-launch-1.0"]).toString().trim();
} catch {}

test(
  "real GStreamer: the exact UxPlay -vrtp chain delivers decodable frames to the server",
  { skip: !gst && "gst-launch-1.0 not installed", timeout: 30_000 },
  async () => {
    const srv = new AirPlayVideoServer(500);
    const port = await srv.listen();
    // UxPlay opens idle connections (one per codec pipeline) as soon as it starts.
    const { Socket } = await import("node:net");
    const idle = [new Socket(), new Socket()];
    for (const s of idle) s.connect(port, "127.0.0.1");
    const packets: H264Packet[] = [];
    const states: boolean[] = [];
    srv.on("packet", (p) => packets.push(p));
    srv.on("streaming", (s) => states.push(s));
    // What UxPlay builds: appsrc ! queue ! h264parse ! rtph264pay <our tail>
    const pipeline = `videotestsrc num-buffers=60 ! video/x-raw,width=640,height=1136,framerate=30/1 ! x264enc tune=zerolatency key-int-max=30 ! h264parse ! rtph264pay ${vrtpPipeline(port)}`;
    const proc = spawn("gst-launch-1.0", ["-q", ...pipeline.split(" ")], { stdio: "ignore" });
    await new Promise((r) => proc.once("exit", r));
    await new Promise((r) => setTimeout(r, 1000)); // > idle timeout
    for (const s of idle) assert.equal(s.destroyed, false, "idle UxPlay connections are kept");
    await srv.close();
    const frames = packets.filter((p) => !p.config);
    assert.ok(packets.some((p) => p.config), "SPS/PPS received");
    assert.ok(frames.length >= 55, `frames: ${frames.length}`);
    assert.ok(frames.filter((f) => f.key).length >= 2);
    assert.deepEqual(states, [true, false]);
  },
);
