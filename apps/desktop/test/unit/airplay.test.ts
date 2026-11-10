// AirPlay receiver: argument building, binary lookup, and — when UxPlay and an
// mDNS responder are available — a real check that the receiver is announced
// on the network the way an iPhone discovers it (_airplay._tcp).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Bonjour, type Service } from "bonjour-service";
import { mkdirSync } from "node:fs";
import { AirPlayReceiver, airplayArgs, findUxPlay, runtimeEnv } from "../../src/main/airplay.ts";

test("arguments: exact name, mandatory 4-digit code, stale session reset", () => {
  const a = airplayArgs("PC-Salon · MansoMirror", "0427");
  assert.deepEqual(a.slice(0, 3), ["-n", "PC-Salon · MansoMirror", "-nh"]);
  assert.equal(a[a.indexOf("-pin") + 1], "0427");
  assert.ok(a.includes("-reset"));
});

test("in-app mode: video goes to our local port, 1080p60 requested, no UxPlay window", () => {
  const a = airplayArgs("PC", "1234", "win32", 5001);
  assert.match(a[a.indexOf("-vrtp") + 1], /tcpclientsink host=127\.0\.0\.1 port=5001/);
  assert.equal(a[a.indexOf("-s") + 1], "1920x1080@60");
  assert.equal(a[a.indexOf("-fps") + 1], "60");
  assert.ok(!a.includes("-vs"), "no UxPlay video window");
});

test("Windows: Direct3D 11 video output; other systems keep UxPlay's default", () => {
  const w = airplayArgs("PC", "1234", "win32");
  assert.equal(w[w.indexOf("-vs") + 1], "d3d11videosink");
  assert.ok(!airplayArgs("PC", "1234", "linux").includes("-vs"));
});

test("shipped runtime: found under resources/uxplay/bin and isolated to its own GStreamer plugins", () => {
  const res = mkdtempSync(join(tmpdir(), "mm-res-"));
  const bin = join(res, "uxplay", "bin", process.platform === "win32" ? "uxplay.exe" : "uxplay");
  mkdirSync(dirname(bin), { recursive: true });
  mkdirSync(join(res, "uxplay", "lib", "gstreamer-1.0"), { recursive: true });
  writeFileSync(bin, "");
  assert.equal(findUxPlay({ PATH: "" }, res), bin);
  const env = runtimeEnv(bin, { PATH: "/usr/bin" }, "/data");
  assert.equal(env.GST_PLUGIN_PATH, join(res, "uxplay", "lib", "gstreamer-1.0"));
  assert.equal(env.GST_PLUGIN_SYSTEM_PATH, env.GST_PLUGIN_PATH);
  assert.equal(env.GST_REGISTRY, join("/data", "gst-registry.bin"));
  assert.ok(env.PATH!.startsWith(dirname(bin)));
  // A system-wide UxPlay (no bundled plugins) keeps the normal environment.
  assert.deepEqual(runtimeEnv("/usr/bin/uxplay", { PATH: "/usr/bin" }), { PATH: "/usr/bin" });
});

test("findUxPlay: explicit path wins, otherwise searched on PATH, null when absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "mm-uxplay-"));
  const bin = join(dir, process.platform === "win32" ? "uxplay.exe" : "uxplay");
  writeFileSync(bin, "#!/bin/sh\n");
  chmodSync(bin, 0o755);
  assert.equal(findUxPlay({ MM_UXPLAY_PATH: bin, PATH: "" }), bin);
  assert.equal(findUxPlay({ PATH: dir }), bin);
  assert.equal(findUxPlay({ PATH: join(dir, "nothing-here") }), null);
});

test("without UxPlay the receiver reports itself unavailable and start() is a no-op", async () => {
  const r = new AirPlayReceiver(null);
  assert.deepEqual(r.current, { status: "unavailable", reason: "not-installed" });
  assert.deepEqual(await r.start("PC"), { status: "unavailable", reason: "not-installed" });
});

const uxplay = findUxPlay();
// UxPlay opens a video window: on Linux it needs a display (run under Xvfb in CI).
const noDisplay = process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
const skipReal = !uxplay ? "UxPlay not installed" : noDisplay ? "no display (run under xvfb-run)" : false;

test("real UxPlay: announced as an AirPlay receiver under our name, then stopped", { skip: skipReal, timeout: 30_000 }, async () => {
  const r = new AirPlayReceiver(uxplay);
  const logs: string[] = [];
  r.on("log", (l) => logs.push(l));
  const name = `Test-${process.pid}`;
  const st = await r.start(name);
  assert.equal(st.status, "running");
  assert.match((st as { pin: string }).pin, /^\d{4}$/);

  const bonjour = new Bonjour();
  try {
    const found = await new Promise<Service | null>((resolve) => {
      const browser = bonjour.find({ type: "airplay" });
      const t = setTimeout(() => resolve(null), 15_000);
      browser.on("up", (s: Service) => {
        if (s.name.startsWith(name)) {
          clearTimeout(t);
          resolve(s);
        }
      });
    });
    assert.ok(found, `receiver not announced on mDNS. UxPlay said:\n${logs.join("\n")}`);
    assert.equal(found.name, `${name} · MansoMirror`);
    // iOS uses these TXT records to list the device as a screen-mirroring target.
    assert.ok(found.txt && typeof found.txt === "object");
  } finally {
    bonjour.destroy();
    await r.stop();
  }
  assert.equal(r.current.status, "stopped");
});
