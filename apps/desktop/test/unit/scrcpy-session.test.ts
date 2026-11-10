// ScrcpySession against the fake phone: real TCP, real H.264 packets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ScrcpySession } from "../../src/main/scrcpy-session.ts";
import { MotionAction, touchMessage, type VideoMeta, type VideoPacket } from "../../src/main/scrcpy-protocol.ts";
// @ts-expect-error — plain JS test helper
import { startFakePhone, accessUnits } from "../fixtures/fake-phone.mjs";

test("fixture clip starts with a config packet followed by a key frame", () => {
  const p = accessUnits();
  assert.equal(p[0].config, true);
  assert.equal(p[1].key, true);
  assert.ok(p.filter((x: { key: boolean }) => x.key).length >= 3);
});

test("session: reads device meta, receives video packets, sends control messages, ends cleanly", { timeout: 15_000 }, async () => {
  const phone = await startFakePhone({ name: "Pixel test", width: 360, height: 640 });
  const s = new ScrcpySession();
  const meta = new Promise<VideoMeta>((r) => s.once("meta", r));
  const packets: VideoPacket[] = [];
  s.on("packet", (p) => packets.push(p));
  await s.attach(phone.port);
  assert.deepEqual(await meta, { deviceName: "Pixel test", codecId: 0x68323634, width: 360, height: 640 });
  await new Promise((r) => setTimeout(r, 600));
  assert.ok(packets.length >= 10, `only ${packets.length} packets`);
  assert.equal(packets[0].config, true);
  assert.equal(packets[1].key, true);
  // Annex-B start code preserved
  assert.deepEqual([...packets[1].data.subarray(0, 4)], [0, 0, 0, 1]);

  assert.ok(s.send(touchMessage(MotionAction.DOWN, 10, 20, 360, 640)));
  await new Promise((r) => setTimeout(r, 100));
  const got = Buffer.concat(phone.control);
  assert.equal(got.length, 32);
  assert.equal(got[0], 2);

  const ended = new Promise<{ reason: string }>((r) => s.once("ended", r));
  await phone.close();
  assert.match((await ended).reason, /déconnecté|perdue/);
});

test("session: gives up with a clear error when nothing answers", { timeout: 30_000 }, async () => {
  const s = new ScrcpySession();
  await assert.rejects(s.attach(1), /ne répond pas/);
});
