import { test } from "node:test";
import assert from "node:assert/strict";
import { PinManager, PIN_MAX_ATTEMPTS, PIN_TTL_MS, deriveKey, generatePin, macEquals, sdpMac } from "../../src/main/pairing.ts";
import { parseMessage, cleanName } from "../../src/shared/protocol.ts";

test("PINs are 6 digits and vary", () => {
  const pins = new Set(Array.from({ length: 200 }, generatePin));
  for (const p of pins) assert.match(p, /^\d{6}$/);
  assert.ok(pins.size > 190);
});

test("a PIN is single-use", () => {
  const m = new PinManager();
  m.issue();
  assert.deepEqual(m.record(true), { ok: true });
  assert.deepEqual(m.active(), { reason: "none" });
  assert.equal(m.record(true).ok, false);
});

test("a PIN expires after its TTL", () => {
  let t = 1_000;
  const m = new PinManager(() => t);
  m.issue();
  t += PIN_TTL_MS - 1;
  assert.ok("pin" in m.active());
  t += 2;
  assert.deepEqual(m.active(), { reason: "expired" });
});

test("the PIN locks after the maximum number of wrong guesses", () => {
  const m = new PinManager();
  m.issue();
  for (let i = 1; i < PIN_MAX_ATTEMPTS; i++) {
    assert.deepEqual(m.record(false), { ok: false, reason: "bad-pin", remaining: PIN_MAX_ATTEMPTS - i });
  }
  assert.deepEqual(m.record(false), { ok: false, reason: "locked", remaining: 0 });
  assert.deepEqual(m.active(), { reason: "locked" });
});

test("issuing a new PIN changes the salt and resets attempts", () => {
  const m = new PinManager();
  m.issue();
  const salt = m.salt;
  m.record(false);
  m.issue();
  assert.notEqual(m.salt, salt);
  for (let i = 1; i < PIN_MAX_ATTEMPTS; i++) m.record(false);
  assert.ok("pin" in m.active());
});

test("MACs depend on the PIN, the nonces, the direction and the SDP", async () => {
  const salt = "00".repeat(16);
  const k1 = await deriveKey("123456", salt);
  const k2 = await deriveKey("123457", salt);
  const a = "11".repeat(16);
  const b = "22".repeat(16);
  const base = sdpMac(k1, "offer", a, b, "v=0");
  assert.ok(macEquals(base, sdpMac(k1, "offer", a, b, "v=0")));
  assert.ok(!macEquals(base, sdpMac(k2, "offer", a, b, "v=0")));
  assert.ok(!macEquals(base, sdpMac(k1, "answer", a, b, "v=0")));
  assert.ok(!macEquals(base, sdpMac(k1, "offer", b, a, "v=0")));
  assert.ok(!macEquals(base, sdpMac(k1, "offer", a, b, "v=1")));
  assert.ok(!macEquals(base, "zz"));
});

test("protocol parser rejects malformed or oversized messages", () => {
  assert.equal(parseMessage("not json"), null);
  assert.equal(parseMessage("[]"), null);
  assert.equal(parseMessage(JSON.stringify({ t: "hello", v: 1, name: "x", nonce: "short" })), null);
  assert.equal(parseMessage(JSON.stringify({ t: "offer", sdp: "x".repeat(40_000), mac: "a".repeat(64) })), null);
  assert.equal(parseMessage(JSON.stringify({ t: "unknown" })), null);
  assert.deepEqual(parseMessage(JSON.stringify({ t: "recording", on: true })), { t: "recording", on: true });
});

test("device names are cleaned of control and bidi characters", () => {
  assert.equal(cleanName("PC‮-salon\u0007 "), "PC-salon");
  assert.equal(cleanName("\u0000"), "Appareil");
  assert.equal(cleanName("a".repeat(100)).length, 64);
});
