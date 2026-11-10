import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Updater, updateSupport, type UpdateState, type UpdaterLike } from "../../src/main/updater.ts";

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  allowPrerelease = false;
  checks = 0;
  installed: unknown[] = [];
  next: "none" | "update" | "fail" = "none";
  async checkForUpdates() {
    this.checks++;
    this.emit("checking-for-update");
    if (this.next === "fail") throw new Error("net::ERR_INTERNET_DISCONNECTED\nstack…");
    if (this.next === "none") this.emit("update-not-available");
    else {
      this.emit("update-available", { version: "0.4.0" });
      this.emit("download-progress", { percent: 42.4 });
      this.emit("update-downloaded", { version: "0.4.0" });
    }
    return null;
  }
  quitAndInstall(...a: unknown[]) {
    this.installed.push(a);
  }
}

test("supported on Windows and on Linux AppImage; disabled in dev, on macOS and .deb", () => {
  assert.equal(updateSupport({ packaged: true, platform: "win32" }), null);
  assert.equal(updateSupport({ packaged: true, platform: "linux", appImage: "/x.AppImage" }), null);
  assert.match(updateSupport({ packaged: false, platform: "win32" })!, /installée/);
  assert.match(updateSupport({ packaged: true, platform: "darwin" })!, /macOS/);
  assert.match(updateSupport({ packaged: true, platform: "linux" })!, /AppImage/);
});

test("downloads in the background, installs on quit, and only restarts when asked", async () => {
  const f = new FakeUpdater();
  const u = new Updater(f, null);
  assert.equal(f.autoDownload, true);
  assert.equal(f.autoInstallOnAppQuit, true);
  const seen: UpdateState[] = [];
  u.on("state", (s) => seen.push(s));

  await u.check();
  assert.deepEqual(seen.at(-1), { status: "idle", lastCheck: (seen.at(-1) as { lastCheck: number }).lastCheck });
  assert.equal(u.installNow(), false, "nothing to install yet");

  f.next = "update";
  await u.check();
  assert.ok(seen.some((s) => s.status === "downloading" && s.percent === 42));
  assert.deepEqual(u.state, { status: "ready", version: "0.4.0" });
  await u.check();
  assert.equal(f.checks, 2, "no re-check once an update is ready");
  assert.equal(u.installNow(), true);
  assert.deepEqual(f.installed, [[false, true]]);
});

test("network errors are reported in one short line", async () => {
  const f = new FakeUpdater();
  f.next = "fail";
  const u = new Updater(f, null);
  await u.check();
  assert.deepEqual(u.state, { status: "error", message: "net::ERR_INTERNET_DISCONNECTED" });
});

test("disabled updater never touches electron-updater", async () => {
  const f = new FakeUpdater();
  const u = new Updater(f, "raison");
  await u.check();
  u.start();
  assert.equal(f.checks, 0);
  assert.deepEqual(u.state, { status: "disabled", reason: "raison" });
});
