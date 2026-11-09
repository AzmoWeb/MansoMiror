// Two real MansoMirror instances on one machine (run under Xvfb on Linux):
// A shares its screen, B pairs with the PIN shown by A, A consents, B receives video.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { _electron: electron } = require("playwright");
const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOTS = process.env.SHOTS_DIR;
const dirs = [];
let A, B, pa, pb;

async function launch(name) {
  const dir = mkdtempSync(join(tmpdir(), `mm-${name}-`));
  dirs.push(dir);
  // Chromium refuses its OS sandbox as root (CI containers); real users never run as root.
  const args = process.getuid?.() === 0 ? [appDir, "--no-sandbox"] : [appDir];
  const app = await electron.launch({ args, env: { ...process.env, MM_USER_DATA: dir }, timeout: 30000 });
  const page = await app.firstWindow();
  if (process.env.MM_DEBUG) page.on("console", (m) => m.type() === "error" && console.error(`[${name}] ${m.text()}`));
  await page.waitForSelector(".shell");
  return { app, page };
}

before(async () => {
  ({ app: A, page: pa } = await launch("a"));
  ({ app: B, page: pb } = await launch("b"));
});

after(async () => {
  await A?.close();
  await B?.close();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

test("renderer is isolated: no Node, only the narrow API", { timeout: 60_000 }, async () => {
  const r = await pb.evaluate(() => ({
    require: typeof window.require,
    process: typeof window.process,
    api: Object.keys(window.mm).sort(),
    // Not https, so the app neither opens it nor hands it to the system browser.
    popup: window.open("file:///etc/hostname") === null,
  }));
  assert.equal(r.require, "undefined");
  assert.equal(r.process, "undefined");
  assert.ok(r.api.includes("killAll") && r.api.length === 24, `api: ${r.api}`);
  assert.equal(r.popup, true);
});

test("CSP blocks inline scripts", { timeout: 60_000 }, async () => {
  const blocked = await pb.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__inlineRan = true";
    document.body.appendChild(s);
    return window.__inlineRan !== true;
  });
  assert.equal(blocked, true);
});

let pin = "";

test("A starts sharing and shows a 6-digit PIN", { timeout: 60_000 }, async () => {
  await pa.getByRole("button", { name: "Choisir l'écran à partager" }).click();
  // Right after Xvfb starts, the capturer can briefly report no screen: use "Actualiser" like a user would.
  for (let i = 0; i < 20 && (await pa.locator(".source").count()) === 0; i++) {
    await pa.waitForTimeout(1000);
    if ((await pa.getByText("Aucun écran disponible.").count()) > 0) await pa.getByRole("button", { name: "Actualiser" }).click();
  }
  await pa.locator(".source").first().click();
  const text = await pa.getByTestId("pin").innerText({ timeout: 15000 });
  pin = text.replace(/\s/g, "");
  assert.match(pin, /^\d{6}$/);
  if (SHOTS) await pa.screenshot({ path: `${SHOTS}/host-waiting.png` });
});

test("B discovers A on the local network (mDNS) while A waits for a viewer", { timeout: 60_000 }, async () => {
  const item = pb.locator(".device-list li").first();
  await item.waitFor({ timeout: 15000 });
  assert.match(await item.innerText(), /127\.0\.0\.1|\d+\.\d+\.\d+\.\d+/);
});

async function openPinDialog() {
  await pb.getByLabel("Adresse IP").fill("127.0.0.1");
  await pb.getByRole("button", { name: "Continuer" }).click();
  await pb.getByLabel("Code à 6 chiffres").waitFor();
}

test("B is told when the PIN is wrong, and A is warned", { timeout: 60_000 }, async () => {
  await openPinDialog();
  const wrong = String((Number(pin) + 1) % 1e6).padStart(6, "0");
  await pb.getByLabel("Code à 6 chiffres").fill(wrong);
  await pb.getByRole("dialog").getByRole("button", { name: "Se connecter" }).click();
  await pb.getByRole("alert").filter({ hasText: "Code incorrect. Encore 4 essais." }).waitFor({ timeout: 15000 });
  await pa.getByText(/Code incorrect saisi depuis 127\.0\.0\.1/).waitFor();
  assert.equal(await pa.getByText("Demande de connexion").count(), 0, "A is never asked for a wrong PIN");
});

test("correct PIN → A must consent → B receives live video", { timeout: 60_000 }, async () => {
  await pb.getByLabel("Code à 6 chiffres").fill(pin);
  await pb.getByRole("dialog").getByRole("button", { name: "Se connecter" }).click();
  await pa.getByRole("dialog", { name: "Demande de connexion" }).waitFor({ timeout: 15000 });
  if (SHOTS) await pa.screenshot({ path: `${SHOTS}/host-consent.png` });
  await pa.getByRole("button", { name: "Autoriser" }).click();

  await pb.waitForFunction(() => {
    const v = document.querySelector(".viewer video");
    return v && v.videoWidth > 0 && v.currentTime > 0;
  }, null, { timeout: 20000 });
  const dims = await pb.evaluate(() => {
    const v = document.querySelector(".viewer video");
    return [v.videoWidth, v.videoHeight];
  });
  assert.ok(dims[0] >= 320 && dims[1] >= 200, `video ${dims}`);
  await pb.getByTestId("stats").filter({ hasText: /\d+×\d+ · \d+ i\/s/ }).waitFor({ timeout: 10000 });
  await pa.getByText(/voit votre écran/).waitFor();
  if (SHOTS) {
    await pb.screenshot({ path: `${SHOTS}/viewer.png` });
    await pa.screenshot({ path: `${SHOTS}/host-sharing.png` });
  }
});

test("starting a recording on B is announced on A", { timeout: 60_000 }, async () => {
  await pb.getByRole("button", { name: "Enregistrer" }).click();
  await pa.getByText(/enregistre votre écran/).first().waitFor({ timeout: 5000 });
});

test("the PIN cannot be reused by a third party once paired", { timeout: 60_000 }, async () => {
  const r = await pb.evaluate(async (p) => {
    const pc = new RTCPeerConnection();
    pc.addTransceiver("video");
    await pc.setLocalDescription(await pc.createOffer());
    const res = await window.mm.viewerConnect({ host: "127.0.0.1", port: 47800, pin: p, offerSdp: pc.localDescription.sdp });
    pc.close();
    return res;
  }, pin);
  assert.equal(r.ok, false);
});

test("kill switch on A ends the session on both sides", { timeout: 60_000 }, async () => {
  await pa.getByRole("button", { name: "Tout couper" }).first().click();
  await pa.getByText("Toutes les connexions ont été coupées.").waitFor();
  await pb.waitForSelector(".shell", { timeout: 10000 });
  await pb.getByText("L'autre ordinateur a mis fin au partage.").waitFor();
  assert.equal(await pa.getByTestId("pin").count(), 0);
});

test("the session is recorded in both histories", { timeout: 60_000 }, async () => {
  for (const [p, role] of [[pa, "Partagé"], [pb, "Regardé"]]) {
    await p.getByRole("button", { name: "Historique" }).click();
    await p.getByRole("cell", { name: role }).waitFor();
  }
  if (SHOTS) await pb.screenshot({ path: `${SHOTS}/history.png` });
});
