// End-to-end checks against the production build (`pnpm build` first).
// Uses the Playwright library already present on the machine; set
// PW_CHROMIUM to a Chromium binary path if it is installed elsewhere.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS_DIR;
let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

before(async () => {
  const nextBin = require.resolve("next/dist/bin/next");
  server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT), "-H", "127.0.0.1"], { stdio: "ignore" });
  await waitForServer();
  browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});

after(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
  await new Promise((r) => (server.exitCode !== null ? r() : server.once("exit", r)));
});

async function open(opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE + (opts.path ?? "/"), { waitUntil: "networkidle" });
  return { ctx, page, errors };
}

test("home renders every required section without console errors", async () => {
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await assert.doesNotReject(page.getByRole("heading", { level: 1, name: /Votre écran/ }).waitFor());
  for (const id of ["fonctionnalites", "applications", "fonctionnement", "demo", "compatibilite", "telecharger", "faq"]) {
    assert.equal(await page.locator(`section#${id}`).count(), 1, `missing #${id}`);
  }
  for (const label of ["Télécharger gratuitement", "Découvrir MansoMirror"]) {
    assert.equal(await page.getByRole("link", { name: label }).count(), 1);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-light.png`, fullPage: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("downloads only link to real GitHub release files; mobile is not offered", async () => {
  const { ctx, page } = await open();
  const section = page.locator("#telecharger");
  for (const id of ["android", "ios"]) {
    const row = section.locator(`[data-platform="${id}"]`);
    assert.equal(await row.locator("a[download]").count(), 0);
    assert.equal(await row.getByText("Pas encore disponible").count(), 1);
  }
  const links = await section.locator("a[download]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  for (const href of links) assert.match(href, /^https:\/\/github\.com\/AzmoWeb\/MansoMiror\/releases\/download\//);
  if (links.length) assert.equal(await page.getByTestId("beta-warning").count(), 1);
  else assert.equal(await page.getByTestId("no-release").count(), 1);
  await ctx.close();
});

test("FAQ accordion opens and closes with correct aria state", async () => {
  const { ctx, page } = await open();
  const q = page.getByRole("button", { name: "Puis-je utiliser une connexion USB ?" });
  assert.equal(await q.getAttribute("aria-expanded"), "false");
  await q.click();
  assert.equal(await q.getAttribute("aria-expanded"), "true");
  await page.getByText(/la connexion USB est prévue dès la première version/).waitFor();
  await q.click();
  assert.equal(await q.getAttribute("aria-expanded"), "false");
  await ctx.close();
});

test("feature list highlights the matching part of the product view", async () => {
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
  const item = page.locator("#fonctionnalites").getByRole("button", { name: /Enregistrement vidéo/ });
  await item.hover();
  assert.equal(await item.getAttribute("aria-pressed"), "true");
  await page.locator("#fonctionnalites").getByText("REC", { exact: true }).waitFor();
  await ctx.close();
});

test("demo controls update the stream figures and stay labelled as a mock-up", async () => {
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
  const demo = page.locator("#demo");
  await demo.getByText("1080p · 60 i/s").waitFor();
  await demo.getByText("1440p", { exact: true }).click();
  await demo.getByText("30", { exact: true }).click();
  await demo.getByText("1440p · 30 i/s").waitFor();
  assert.match(await page.getByTestId("demo-disclaimer").innerText(), /aucun appareil n'est connecté/);
  await ctx.close();
});

test("theme toggle forces dark then returns to automatic, and persists", async () => {
  const { ctx, page } = await open({ colorScheme: "light" });
  const btn = page.getByTestId("theme-toggle");
  await btn.click(); // auto -> light
  await btn.click(); // light -> dark
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, "rgb(17, 17, 16)");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.getByTestId("theme-toggle").click(); // dark -> auto
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
  await ctx.close();
});

test("OS dark preference is followed in automatic mode", async () => {
  const { ctx, page } = await open({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, "rgb(17, 17, 16)");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-dark.png`, fullPage: true });
  await ctx.close();
});

test("phone layout: no horizontal scroll and a working menu", async () => {
  const { ctx, page } = await open({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const menu = page.locator("#mobile-menu");
  await menu.waitFor();
  await menu.getByRole("link", { name: "FAQ" }).click();
  await page.waitForFunction(() => location.hash === "#faq");
  if (SHOTS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SHOTS}/mobile.png`, fullPage: true });
  }
  await ctx.close();
});

test("reduced motion: content is visible immediately", async () => {
  const { ctx, page } = await open({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const opacity = await page.locator("#faq h2").evaluate((el) => {
    let n = el;
    let o = 1;
    while (n) {
      o *= Number(getComputedStyle(n).opacity);
      n = n.parentElement;
    }
    return o;
  });
  assert.equal(opacity, 1);
  await ctx.close();
});

test("legal pages and 404 render", async () => {
  for (const [path, title] of [["/confidentialite", "Politique de confidentialité"], ["/conditions", "Conditions d'utilisation"], ["/nope", "Cette page n'a pas de reflet."]]) {
    const { ctx, page } = await open({ path });
    await page.getByRole("heading", { level: 1, name: title }).waitFor();
    await ctx.close();
  }
});

test("security headers are sent", async () => {
  const res = await fetch(BASE);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-powered-by"), null);
});
