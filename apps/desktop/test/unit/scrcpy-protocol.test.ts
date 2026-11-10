import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODEC_H264,
  KeyAction,
  Keycode,
  MotionAction,
  VideoDemuxer,
  keyMessage,
  scrollMessage,
  serverCommand,
  socketName,
  textMessage,
  touchMessage,
  type VideoMeta,
  type VideoPacket,
} from "../../src/main/scrcpy-protocol.ts";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

function header(name: string, w: number, h: number) {
  const b = Buffer.alloc(64 + 12);
  b.write(name, 0, "utf8");
  b.writeUInt32BE(CODEC_H264, 64);
  b.writeUInt32BE(w, 68);
  b.writeUInt32BE(h, 72);
  return b;
}
function packet(flags: bigint, pts: bigint, data: number[]) {
  const b = Buffer.alloc(12 + data.length);
  b.writeBigUInt64BE(flags | pts, 0);
  b.writeUInt32BE(data.length, 8);
  Buffer.from(data).copy(b, 12);
  return b;
}

test("socket name and server command match scrcpy 3.3.1", () => {
  assert.equal(socketName(0x1a2b), "scrcpy_00001a2b");
  const c = serverCommand({ scid: 0x1a2b, maxSize: 1080, maxFps: 60, bitRate: 8_000_000, control: true });
  assert.deepEqual(c.slice(0, 5), ["CLASSPATH=/data/local/tmp/scrcpy-server.jar", "app_process", "/", "com.genymobile.scrcpy.Server", "3.3.1"]);
  for (const p of ["scid=00001a2b", "tunnel_forward=true", "audio=false", "video_codec=h264", "max_size=1080", "max_fps=60", "video_bit_rate=8000000"]) assert.ok(c.includes(p), p);
  assert.ok(!c.includes("control=false"));
  assert.ok(serverCommand({ scid: 1, maxSize: 0, maxFps: 0, bitRate: 1, control: false }).includes("control=false"));
});

test("demuxer: device meta then config, key and delta packets — across arbitrary chunk boundaries", () => {
  const stream = Buffer.concat([
    header("Pixel 7", 1080, 2400),
    packet(1n << 63n, 0n, [0, 0, 0, 1, 0x67, 0x42]),
    packet(1n << 62n, 1000n, [0, 0, 0, 1, 0x65, 1, 2, 3]),
    packet(0n, 34333n, [0, 0, 0, 1, 0x41, 9]),
  ]);
  for (const step of [1, 3, 7, 50, stream.length]) {
    const metas: VideoMeta[] = [];
    const pkts: VideoPacket[] = [];
    const d = new VideoDemuxer((m) => metas.push(m), (p) => pkts.push(p));
    for (let i = 0; i < stream.length; i += step) d.push(stream.subarray(i, i + step));
    assert.deepEqual(metas, [{ deviceName: "Pixel 7", codecId: CODEC_H264, width: 1080, height: 2400 }]);
    assert.deepEqual(
      pkts.map((p) => [p.config, p.key, p.pts, p.data.length]),
      [
        [true, false, 0, 6],
        [false, true, 1000, 8],
        [false, false, 34333, 6],
      ],
    );
  }
});

test("demuxer rejects absurd packet sizes instead of buffering forever", () => {
  const d = new VideoDemuxer(() => {}, () => {}, 1024);
  const bad = Buffer.alloc(12);
  bad.writeUInt32BE(10_000_000, 8);
  assert.throws(() => d.push(Buffer.concat([header("x", 1, 1), bad])), /too large/);
});

test("touch message: 32 bytes, mouse pointer id, position, pressure, buttons", () => {
  const down = touchMessage(MotionAction.DOWN, 100, 200, 1080, 2400);
  assert.equal(down.length, 32);
  assert.equal(
    hex(down),
    "02" + "00" + "ffffffffffffffff" + "00000064" + "000000c8" + "0438" + "0960" + "ffff" + "00000001" + "00000001",
  );
  const up = touchMessage(MotionAction.UP, 100, 200, 1080, 2400);
  assert.equal(hex(up).slice(44, 48), "0000"); // pressure 0
  assert.equal(hex(up).slice(56), "00000000"); // no button held
});

test("scroll, key and text messages", () => {
  assert.equal(hex(scrollMessage(1, 2, 3, 4, 0, -16)), "03" + "00000001" + "00000002" + "0003" + "0004" + "0000" + "8000" + "00000000");
  assert.equal(hex(scrollMessage(0, 0, 1, 1, 16, 0)).slice(26, 30), "7fff");
  assert.equal(hex(keyMessage(KeyAction.DOWN, Keycode.HOME)), "00" + "00" + "00000003" + "00000000" + "00000000");
  const t = textMessage("Salut é");
  assert.equal(t[0], 1);
  assert.equal(Buffer.from(t).readUInt32BE(1), Buffer.byteLength("Salut é"));
  assert.equal(textMessage("x".repeat(500)).length, 5 + 300);
});
