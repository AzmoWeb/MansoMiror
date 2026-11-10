import { test } from "node:test";
import assert from "node:assert/strict";
import { AndroidBridge } from "../../src/main/android.ts";
import { AndroidService, FAKE_SERIAL, inputToMessages, type AndroidEvent } from "../../src/main/android-service.ts";
// @ts-expect-error — plain JS test helper
import { startFakePhone } from "../fixtures/fake-phone.mjs";

test("inputs are validated and translated; anything else is rejected", () => {
  assert.equal(inputToMessages({ kind: "touch", action: "down", x: 10, y: 20, w: 360, h: 640 })![0].length, 32);
  assert.equal(inputToMessages({ kind: "scroll", x: 1, y: 1, w: 2, h: 2, dx: 0, dy: -3 })![0].length, 21);
  assert.equal(inputToMessages({ kind: "nav", button: "back" })!.length, 2);
  assert.equal(inputToMessages({ kind: "nav", button: "home" })!.length, 2);
  assert.equal(inputToMessages({ kind: "text", text: "bonjour" })![0][0], 1);
  assert.equal(inputToMessages({ kind: "reset-video" })![0][0], 17);
  for (const bad of [
    null,
    "x",
    { kind: "raw", bytes: [1, 2, 3] },
    { kind: "touch", action: "down", x: -1, y: 0, w: 1, h: 1 },
    { kind: "touch", action: "explode", x: 1, y: 1, w: 1, h: 1 },
    { kind: "scroll", x: 1, y: 1, w: 1, h: 1, dx: 0, dy: 99 },
    { kind: "key", action: "down", keycode: 9999 },
    { kind: "text", text: "" },
    { kind: "text", text: "x".repeat(301) },
    { kind: "nav", button: "self-destruct" },
  ]) {
    assert.equal(inputToMessages(bad), null, JSON.stringify(bad));
  }
});

test("service with the fake phone: list, start, meta, packets, input, stop", { timeout: 15_000 }, async () => {
  const phone = await startFakePhone({ width: 360, height: 640 });
  const svc = new AndroidService(new AndroidBridge({ adb: null, scrcpy: null }), null, phone.port);
  assert.equal(svc.status().available, true);
  assert.equal((await svc.devices())[0].serial, FAKE_SERIAL);

  const events: AndroidEvent[] = [];
  svc.on("event", (e) => events.push(e));
  let packets = 0;
  svc.on("packet", () => packets++);
  await svc.start(FAKE_SERIAL, { maxSize: 1080, maxFps: 30, bitRate: 8e6, control: true });
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(events[0].type, "meta");
  assert.ok(packets > 5);

  assert.equal(svc.input(FAKE_SERIAL, { kind: "nav", button: "home" }), true);
  assert.equal(svc.input(FAKE_SERIAL, { kind: "raw" }), false);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(Buffer.concat(phone.control).length, 28); // 2 × 14-byte key messages

  svc.stop(FAKE_SERIAL);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(events.at(-1)!.type, "ended");
  assert.equal(svc.isActive(FAKE_SERIAL), false);
  await phone.close();
});

test("view-only session ignores input", { timeout: 15_000 }, async () => {
  const phone = await startFakePhone();
  const svc = new AndroidService(new AndroidBridge({ adb: null, scrcpy: null }), null, phone.port);
  await svc.start(FAKE_SERIAL, { maxSize: 0, maxFps: 30, bitRate: 8e6, control: false });
  assert.equal(svc.input(FAKE_SERIAL, { kind: "nav", button: "home" }), false);
  svc.stopAll();
  await phone.close();
});

test("without adb or server, a real phone cannot be started", async () => {
  const svc = new AndroidService(new AndroidBridge({ adb: null, scrcpy: null }), null);
  assert.equal(svc.status().available, false);
  await assert.rejects(svc.start("R58M12ABCDE", { maxSize: 0, maxFps: 30, bitRate: 8e6, control: true }), /introuvable/);
  assert.equal(svc.isActive("R58M12ABCDE"), false);
});
