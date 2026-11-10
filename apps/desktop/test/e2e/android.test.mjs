// The phone screen inside MansoMirror: the app talks to a fake phone that
// speaks the scrcpy 3.3.1 protocol and streams real H.264 video.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { startFakePhone } from "../fixtures/fake-phone.mjs";

const require = createRequire(import.meta.url);
const { _electron: electron } = require("playwright");
const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOTS = process.env.SHOTS_DIR;
let app, page, phone, dir;

before(async () => {
  phone = await startFakePhone({ name: "Pixel de test", width: 360, height: 640 });
  dir = mkdtempSync(join(tmpdir(), "mm-android-"));
  const args = process.getuid?.() === 0 ? [appDir, "--no-sandbox"] : [appDir];
  app = await electron.launch({ args, env: { ...process.env, MM_USER_DATA: dir, MM_ANDROID_FAKE_PORT: String(phone.port) }, timeout: 30000 });
  page = await app.firstWindow();
  if (process.env.MM_DEBUG) page.on("console", (m) => console.error(`[app] ${m.type()} ${m.text()}`));
  await page.waitForSelector(".shell");
});

after(async () => {
  if (process.env.MM_DEBUG) {
    try {
      console.error("MAIN LOG\n" + (await import("node:fs")).readFileSync(join(dir, "logs", "main.log"), "utf8"));
    } catch {}
    console.error("fake phone connections:", phone?.connections?.());
  }
  await app?.close();
  await phone?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const controlBytes = () => Buffer.concat(phone.control);
/** Split the recorded control stream into messages (types 0, 1, 2, 4 used here). */
function messages(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const t = buf[i];
    const len = t === 2 ? 32 : t === 0 ? 14 : t === 4 ? 2 : t === 1 ? 5 + buf.readUInt32BE(i + 1) : t === 17 ? 1 : 1;
    out.push(buf.subarray(i, i + len));
    i += len;
  }
  return out;
}

test("the test phone is listed and opens full window", { timeout: 60_000 }, async () => {
  const panel = page.getByTestId("android");
  await panel.getByText("Téléphone de test").waitFor({ timeout: 10000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/android-panel.png` });
  await panel.getByRole("button", { name: "Afficher" }).first().click();
  await page.getByTestId("android-screen").waitFor();
});

test("the real H.264 video is decoded and drawn at the phone's resolution", { timeout: 60_000 }, async () => {
  await page.getByTestId("android-stats").filter({ hasText: /360×640 · \d+ i\/s/ }).waitFor({ timeout: 15000 });
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="android-canvas"]');
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) colored++;
    const rect = c.getBoundingClientRect();
    return { w: c.width, h: c.height, colored, shownH: rect.height, viewportH: innerHeight };
  });
  assert.equal(r.w, 360);
  assert.equal(r.h, 640);
  assert.ok(r.colored > 100, `canvas looks empty (${r.colored})`);
  assert.ok(r.shownH > r.viewportH * 0.6, "phone is shown large");
  await page.waitForTimeout(500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/android-screen.png` });
});

test("a click on the picture becomes a touch at the right phone coordinates", { timeout: 30_000 }, async () => {
  phone.control.length = 0;
  const box = await page.getByTestId("android-canvas").boundingBox();
  // Click at 25 % / 75 % of the picture → expect ~(90, 480) on a 360×640 phone.
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75);
  await page.waitForTimeout(300);
  const msgs = messages(controlBytes()).filter((m) => m[0] === 2);
  assert.ok(msgs.length >= 2, `touch messages: ${msgs.length}`);
  const downMsg = msgs[0];
  const upMsg = msgs.at(-1);
  assert.equal(downMsg[1], 0); // DOWN
  assert.equal(upMsg[1], 1); // UP
  const x = downMsg.readInt32BE(10);
  const y = downMsg.readInt32BE(14);
  assert.ok(Math.abs(x - 90) <= 3 && Math.abs(y - 480) <= 3, `got (${x}, ${y})`);
  assert.equal(downMsg.readUInt16BE(18), 360);
  assert.equal(downMsg.readUInt16BE(20), 640);
});

test("Android buttons and typing reach the phone", { timeout: 30_000 }, async () => {
  phone.control.length = 0;
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page.getByRole("button", { name: "Accueil" }).click();
  await page.getByTestId("android-canvas").click();
  phone.control.length = 0;
  await page.keyboard.type("ok");
  await page.waitForTimeout(300);
  const texts = messages(controlBytes()).filter((m) => m[0] === 1).map((m) => m.subarray(5).toString());
  assert.deepEqual(texts, ["o", "k"]);
});

test("read-only mode sends nothing; Déconnecter returns to the device list", { timeout: 30_000 }, async () => {
  await page.getByRole("button", { name: "Contrôle activé" }).click();
  phone.control.length = 0;
  const box = await page.getByTestId("android-canvas").boundingBox();
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.waitForTimeout(300);
  assert.equal(controlBytes().length, 0);
  await page.getByRole("button", { name: "Déconnecter" }).click();
  await page.waitForSelector(".shell");
});
