import { test } from "node:test";
import assert from "node:assert/strict";
import { AndroidBridge, findTool, isHostPort, isSerial, parseAdbDevices, scrcpyArgs, type MirrorState } from "../../src/main/android.ts";

const ADB_OUTPUT = `List of devices attached
R58M12ABCDE            device usb:1-1 product:beyond1lteeea model:SM_G973F device:beyond1 transport_id:3
0123456789ABCDEF       unauthorized usb:1-2 transport_id:4
192.168.1.42:41867     device product:raven model:Pixel_6_Pro device:raven transport_id:5
adb-1A2B3C4D-xyZ._adb-tls-connect._tcp device product:oriole model:Pixel_6 device:oriole transport_id:6
emulator-5554          offline transport_id:7
`;

test("parses adb devices: model, state, USB vs Wi-Fi", () => {
  const d = parseAdbDevices(ADB_OUTPUT);
  assert.deepEqual(
    d.map((x) => [x.serial, x.state, x.model, x.transport]),
    [
      ["R58M12ABCDE", "device", "SM G973F", "usb"],
      ["0123456789ABCDEF", "unauthorized", "0123456789ABCDEF", "usb"],
      ["192.168.1.42:41867", "device", "Pixel 6 Pro", "wifi"],
      ["adb-1A2B3C4D-xyZ._adb-tls-connect._tcp", "device", "Pixel 6", "wifi"],
      ["emulator-5554", "offline", "emulator-5554", "usb"],
    ],
  );
  assert.deepEqual(parseAdbDevices("List of devices attached\n\n"), []);
  assert.deepEqual(parseAdbDevices("* daemon started successfully\n"), []);
});

test("serial and address validation blocks command injection", () => {
  assert.ok(isSerial("R58M12ABCDE"));
  assert.ok(!isSerial("x; rm -rf /"));
  assert.ok(!isSerial("$(id)"));
  assert.ok(isHostPort("192.168.1.42:41867"));
  assert.ok(!isHostPort("192.168.1.420:41867"));
  assert.ok(!isHostPort("192.168.1.4:0"));
  assert.ok(!isHostPort("192.168.1.4:5555 && calc"));
  assert.ok(!isHostPort("example.com:5555"));
});

test("scrcpy arguments: control on by default, view-only adds -n", () => {
  const a = scrcpyArgs("R58M12ABCDE", { maxSize: 1080, fps: 60, control: true, title: "Galaxy · MansoMirror" });
  assert.deepEqual(a.slice(0, 2), ["-s", "R58M12ABCDE"]);
  assert.equal(a[a.indexOf("--window-title") + 1], "Galaxy · MansoMirror");
  assert.equal(a[a.indexOf("--max-fps") + 1], "60");
  assert.equal(a[a.indexOf("-m") + 1], "1080");
  assert.ok(!a.includes("-n"));
  assert.ok(scrcpyArgs("X", { maxSize: 0, fps: 30, control: false, title: "t" }).includes("-n"));
  assert.ok(!scrcpyArgs("X", { maxSize: 0, fps: 30, control: false, title: "t" }).includes("-m"));
});

test("pair/connect refuse invalid input before running adb", async () => {
  const b = new AndroidBridge({ adb: "/nonexistent/adb", scrcpy: null });
  await assert.rejects(b.pair("1.2.3.4:5555; reboot", "123456"), /invalide/);
  await assert.rejects(b.pair("1.2.3.4:5555", "12ab56"), /invalide/);
  await assert.rejects(b.connect("not-an-address"), /invalide/);
  assert.deepEqual(b.start("bad serial!", { maxSize: 0, fps: 30, control: true, title: "t" }).status, "error");
});

const adb = findTool("adb");
const scrcpy = findTool("scrcpy");

test("real adb: lists devices (none attached here)", { skip: !adb && "adb not installed" }, async () => {
  const b = new AndroidBridge({ adb, scrcpy });
  const list = await b.devices();
  assert.ok(Array.isArray(list));
  for (const d of list) assert.ok(isSerial(d.serial));
});

test("real scrcpy: a missing phone ends the session with an error, not a hang", { skip: !scrcpy && "scrcpy not installed", timeout: 30_000 }, async () => {
  const b = new AndroidBridge({ adb, scrcpy });
  const events: MirrorState[] = [];
  const done = new Promise<void>((resolve) =>
    b.on("mirror", (s) => {
      events.push(s);
      if (s.status !== "running") resolve();
    }),
  );
  assert.equal(b.start("NO-SUCH-PHONE", { maxSize: 720, fps: 30, control: true, title: "t" }).status, "running");
  await done;
  assert.equal(events.at(-1)!.status, "error");
  assert.equal(b.isRunning("NO-SUCH-PHONE"), false);
});
