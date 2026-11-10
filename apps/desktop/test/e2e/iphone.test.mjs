// iPhone screen inside MansoMirror. Needs UxPlay >= 1.74 (MM_UXPLAY_PATH or
// PATH) and gst-launch-1.0. The iPhone is replaced by the exact GStreamer
// chain UxPlay builds with -vrtp, fed with a real H.264 stream.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { _electron: electron } = require("playwright");
const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOTS = process.env.SHOTS_DIR;

function which(cmd) {
  try {
    return execFileSync("sh", ["-c", `command -v ${cmd}`]).toString().trim();
  } catch {
    return "";
  }
}
const uxplay = process.env.MM_UXPLAY_PATH || which("uxplay");
let vrtp = false;
try {
  vrtp = execFileSync(uxplay, ["-h"], { stdio: ["ignore", "pipe", "pipe"] }).toString().includes("-vrtp");
} catch (e) {
  vrtp = `${e.stdout ?? ""}${e.stderr ?? ""}`.includes("-vrtp");
}
const skip = !uxplay ? "UxPlay not installed" : !vrtp ? "UxPlay < 1.74 (no -vrtp)" : !which("gst-launch-1.0") ? "gst-launch-1.0 missing" : false;

let app, page, dir;

before(async () => {
  if (skip) return;
  dir = mkdtempSync(join(tmpdir(), "mm-iphone-"));
  const args = process.getuid?.() === 0 ? [appDir, "--no-sandbox"] : [appDir];
  app = await electron.launch({ args, env: { ...process.env, MM_USER_DATA: dir, MM_UXPLAY_PATH: uxplay }, timeout: 30000 });
  page = await app.firstWindow();
  await page.waitForSelector(".shell");
});

after(async () => {
  await app?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test("AirPlay receiver starts in in-app mode", { skip, timeout: 30_000 }, async () => {
  const panel = page.getByTestId("airplay");
  await panel.getByRole("button", { name: "Activer la réception AirPlay" }).click();
  await page.getByTestId("airplay-pin").waitFor();
  const st = await page.evaluate(() => window.mm.airplayState());
  assert.equal(st.status, "running");
  assert.equal(st.inApp, true);
  assert.ok(st.videoPort > 0);
  assert.match(await panel.innerText(), /s'affiche ici, en grand, avec le son/);
});

test("a mirrored stream shows the iPhone screen large in the window, then returns when it stops", { skip, timeout: 60_000 }, async () => {
  const { videoPort } = await page.evaluate(() => window.mm.airplayState());
  const tail = `config-interval=-1 ! rtph264depay ! h264parse config-interval=-1 ! video/x-h264,stream-format=byte-stream,alignment=au ! tcpclientsink host=127.0.0.1 port=${videoPort} sync=false`;
  const pipeline = `videotestsrc is-live=true num-buffers=150 pattern=ball ! video/x-raw,width=640,height=1136,framerate=30/1 ! x264enc tune=zerolatency key-int-max=30 ! h264parse ! rtph264pay ${tail}`;
  const gst = spawn("gst-launch-1.0", ["-q", ...pipeline.split(" ")], { stdio: process.env.MM_DEBUG ? "inherit" : "ignore" });
  if (process.env.MM_DEBUG) gst.on("exit", (c) => console.error("gst exit", c));

  await page.getByTestId("iphone-screen").waitFor({ timeout: 15000 });
  if (process.env.MM_DEBUG) console.error("iphone screen shown");
  await page.getByTestId("iphone-stats").filter({ hasText: /640×1136 · \d+ i\/s/ }).waitFor({ timeout: 15000 });
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="iphone-canvas"]');
    const rect = c.getBoundingClientRect();
    return { w: c.width, h: c.height, shownH: rect.height, viewportH: innerHeight };
  });
  assert.deepEqual([r.w, r.h], [640, 1136]);
  assert.ok(r.shownH > r.viewportH * 0.6, "shown large");
  assert.ok(r.shownH <= r.viewportH, "fully visible (not cut)");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/iphone-screen.png` });

  await new Promise((res) => gst.once("exit", res));
  await page.waitForSelector(".shell", { timeout: 15000 });
  assert.equal(await page.getByTestId("iphone-screen").count(), 0);
});

test("Tout couper stops the receiver", { skip, timeout: 30_000 }, async () => {
  await page.getByRole("button", { name: "Tout couper" }).first().click();
  await page.getByTestId("airplay").getByRole("button", { name: "Activer la réception AirPlay" }).waitFor({ timeout: 10000 });
});
