import { EventEmitter } from "node:events";

/**
 * Automatic updates (Windows installer and Linux AppImage).
 *
 * The site publishes /updates/latest.yml (and latest-linux.yml), generated from
 * the newest GitHub release: version, file URL, SHA-512 and size. electron-updater
 * downloads in the background, verifies the SHA-512, and installs when the app
 * quits — or right away when the user clicks "Redémarrer". Running files
 * cannot be replaced while the app runs, so installing always means a restart.
 *
 * macOS: not supported yet (updates require a signed app); users get the
 * download link instead.
 */

export type UpdateState =
  | { status: "disabled"; reason: string }
  | { status: "idle"; lastCheck: number | null }
  | { status: "checking" }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

export interface UpdaterEvents {
  state: [UpdateState];
}

/** The subset of electron-updater's AppUpdater we use (makes the logic testable). */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  on(event: "checking-for-update", cb: () => void): unknown;
  on(event: "update-available", cb: (info: { version: string }) => void): unknown;
  on(event: "update-not-available", cb: () => void): unknown;
  on(event: "download-progress", cb: (p: { percent: number }) => void): unknown;
  on(event: "update-downloaded", cb: (info: { version: string }) => void): unknown;
  on(event: "error", cb: (e: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function updateSupport(opts: { packaged: boolean; platform: NodeJS.Platform; appImage?: string }): string | null {
  if (!opts.packaged) return "Les mises à jour automatiques ne fonctionnent que dans l'application installée.";
  if (opts.platform === "darwin") return "Sur macOS, téléchargez les nouvelles versions depuis le site (mise à jour automatique à venir).";
  if (opts.platform === "linux" && !opts.appImage) return "Sur Linux, la mise à jour automatique fonctionne avec la version AppImage.";
  return null;
}

export class Updater extends EventEmitter<UpdaterEvents> {
  private u: UpdaterLike | null;
  private timer: NodeJS.Timeout | null = null;
  private lastCheck: number | null = null;
  state: UpdateState;

  constructor(u: UpdaterLike | null, disabledReason: string | null) {
    super();
    this.u = disabledReason ? null : u;
    this.state = disabledReason ? { status: "disabled", reason: disabledReason } : { status: "idle", lastCheck: null };
    if (!this.u) return;
    const up = this.u;
    up.autoDownload = true;
    up.autoInstallOnAppQuit = true;
    up.allowPrerelease = true;
    let pending = "";
    up.on("checking-for-update", () => this.set({ status: "checking" }));
    up.on("update-available", (i) => {
      pending = i.version;
      this.set({ status: "downloading", version: i.version, percent: 0 });
    });
    up.on("download-progress", (p) => this.set({ status: "downloading", version: pending, percent: Math.round(p.percent) }));
    up.on("update-not-available", () => this.set({ status: "idle", lastCheck: this.lastCheck }));
    up.on("update-downloaded", (i) => this.set({ status: "ready", version: i.version }));
    up.on("error", (e) => this.set({ status: "error", message: e.message.split("\n")[0].slice(0, 200) }));
  }

  private set(s: UpdateState) {
    this.state = s;
    this.emit("state", s);
  }

  async check(): Promise<void> {
    if (!this.u || this.state.status === "downloading" || this.state.status === "ready") return;
    this.lastCheck = Date.now();
    try {
      await this.u.checkForUpdates();
    } catch (e) {
      this.set({ status: "error", message: (e as Error).message.split("\n")[0].slice(0, 200) });
    }
  }

  /** Check now, then every hour while the app runs. */
  start() {
    if (!this.u || this.timer) return;
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Restart now and install the downloaded update. */
  installNow(): boolean {
    if (!this.u || this.state.status !== "ready") return false;
    this.u.quitAndInstall(false, true);
    return true;
  }
}
