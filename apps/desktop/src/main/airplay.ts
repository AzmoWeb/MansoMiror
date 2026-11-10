import { EventEmitter } from "node:events";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { AirPlayVideoServer, vrtpPipeline, type H264Packet } from "./airplay-video.ts";
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { randomInt } from "node:crypto";
import { cleanName } from "../shared/protocol.ts";

/**
 * AirPlay screen-mirroring receiver ("Recopie de l'écran" on iPhone / iPad).
 *
 * Runs UxPlay (https://github.com/FDH2/UxPlay, GPL-3.0) as a separate process.
 * UxPlay advertises the computer over Bonjour (_airplay._tcp / _raop._tcp),
 * receives the mirrored stream and shows it in its own window.
 * Every session requires the 4-digit code shown in MansoMirror.
 */

export type AirPlayState =
  | { status: "unavailable"; reason: "not-installed" }
  | { status: "stopped" }
  | {
      status: "running";
      name: string;
      pin: string;
      since: number;
      /** true: the iPhone screen is shown inside MansoMirror (UxPlay >= 1.74); false: in UxPlay's own window. */
      inApp: boolean;
      /** An iPhone is currently mirroring. */
      streaming: boolean;
      /** Local port receiving the stream (127.0.0.1 only). */
      videoPort: number;
      /** Something that can keep the iPhone from seeing this PC (e.g. firewall not allowed). */
      notice?: string;
    }
  | { status: "error"; message: string };

export interface AirPlayEvents {
  state: [AirPlayState];
  log: [string];
  video: [H264Packet];
}

const BIN = process.platform === "win32" ? "uxplay.exe" : "uxplay";

/** Look for UxPlay: explicit path, copy shipped next to the app, then PATH. */
export function findUxPlay(env: NodeJS.ProcessEnv = process.env, resourcesPath?: string): string | null {
  const candidates = [
    env.MM_UXPLAY_PATH,
    resourcesPath ? join(resourcesPath, "uxplay", "bin", BIN) : undefined, // runtime shipped in the Windows installer
    resourcesPath ? join(resourcesPath, "uxplay", BIN) : undefined,
    ...(env.PATH ?? "").split(delimiter).filter(Boolean).map((d) => join(d, BIN)),
    // Homebrew on macOS is often missing from the PATH of apps started from the Dock.
    ...(process.platform === "darwin" ? ["/opt/homebrew/bin/uxplay", "/usr/local/bin/uxplay"] : []),
  ];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

export function airplayArgs(name: string, pin: string, platform: NodeJS.Platform = process.platform, videoPort = 0): string[] {
  return [
    "-n", name,
    "-nh", // show exactly our name in the iPhone list
    "-pin", pin, // the iPhone must type this code
    "-reset", "5", // free the receiver if the iPhone disappears
    "-nohold", // a new (authenticated) client replaces a stale one
    "-s", "1920x1080@60", // ask the iPhone for 1080p at 60 Hz
    "-fps", "60", // UxPlay's default cap is 30
    ...(videoPort
      ? // Video goes to MansoMirror's window; audio is played right away (the picture is not delayed either).
        ["-vrtp", vrtpPipeline(videoPort), "-vsync", "no"]
      : // UxPlay's Windows notes: d3d12 can crash on some drivers; d3d11 is the safe choice.
        platform === "win32" ? ["-vs", "d3d11videosink"] : []),
  ];
}

/**
 * Name shown in the iPhone's "Recopie de l'écran" list. ASCII only: on Windows,
 * UxPlay reads its arguments in the ANSI code page and quits (exit code 0) on
 * any other character — "·", accents, emoji…
 */
export function airplayName(deviceName: string): string {
  const ascii = cleanName(deviceName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // é → e
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${ascii || "PC"} - MansoMirror`.slice(0, 60);
}

/** UxPlay >= 1.74 can hand the stream to us (-vrtp); older builds only show their own window. */
export function supportsInApp(bin: string, env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    const out = execFileSync(bin, ["-h"], { env, timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).toString();
    return out.includes("-vrtp");
  } catch (e) {
    const out = `${(e as { stdout?: Buffer }).stdout ?? ""}${(e as { stderr?: Buffer }).stderr ?? ""}`;
    return out.includes("-vrtp");
  }
}

/**
 * Environment for a self-contained UxPlay runtime (bin/, lib/gstreamer-1.0/,
 * libexec/gstreamer-1.0/ side by side): use only its own GStreamer plugins.
 */
export function runtimeEnv(bin: string, base: NodeJS.ProcessEnv = process.env, registryDir?: string): NodeJS.ProcessEnv {
  const root = dirname(dirname(bin));
  const plugins = join(root, "lib", "gstreamer-1.0");
  if (!existsSync(plugins)) return base;
  const scanner = join(root, "libexec", "gstreamer-1.0", process.platform === "win32" ? "gst-plugin-scanner.exe" : "gst-plugin-scanner");
  // Windows names it "Path" (case-insensitive); update the existing key instead of adding a second one.
  const pathKey = Object.keys(base).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  const env: NodeJS.ProcessEnv = { ...base };
  for (const k of Object.keys(env)) if (k.toUpperCase() === "PATH" && k !== pathKey) delete env[k];
  return {
    ...env,
    [pathKey]: `${dirname(bin)}${delimiter}${base[pathKey] ?? ""}`,
    GST_PLUGIN_PATH: plugins,
    GST_PLUGIN_SYSTEM_PATH: plugins,
    ...(existsSync(scanner) ? { GST_PLUGIN_SCANNER: scanner } : {}),
    ...(registryDir ? { GST_REGISTRY: join(registryDir, "gst-registry.bin") } : {}),
  };
}

export class AirPlayReceiver extends EventEmitter<AirPlayEvents> {
  private proc: ChildProcess | null = null;
  private state: AirPlayState = { status: "stopped" };
  private bin: string | null;

  /** Shown with the running state (set by the app, e.g. firewall refused). */
  notice?: string;

  get binary(): string | null {
    return this.bin;
  }

  /** Where GStreamer may cache its plugin registry (the app's user data folder). */
  registryDir?: string;

  constructor(bin: string | null, registryDir?: string) {
    super();
    this.bin = bin;
    this.registryDir = registryDir;
    if (!bin) this.state = { status: "unavailable", reason: "not-installed" };
  }

  /** Re-detect UxPlay (e.g. after the user installed it). */
  setBinary(bin: string | null) {
    if (this.proc) return;
    this.bin = bin;
    this.inApp = null;
    this.set(bin ? { status: "stopped" } : { status: "unavailable", reason: "not-installed" });
  }

  get current(): AirPlayState {
    return this.state;
  }

  private set(s: AirPlayState) {
    this.state = s;
    this.emit("state", s);
  }

  private video = new AirPlayVideoServer();
  private inApp: boolean | null = null;

  async start(deviceName: string): Promise<AirPlayState> {
    if (!this.bin) return this.state;
    if (this.proc) return this.state;
    const name = airplayName(deviceName);
    const pin = String(randomInt(0, 10_000)).padStart(4, "0");
    const env = runtimeEnv(this.bin, process.env, this.registryDir);
    this.inApp ??= supportsInApp(this.bin, env);
    const videoPort = this.inApp ? await this.video.listen() : 0;
    if (this.inApp) {
      this.video.removeAllListeners();
      this.video.on("packet", (p) => this.emit("video", p));
      this.video.on("streaming", (on) => {
        if (this.state.status === "running") this.set({ ...this.state, streaming: on });
      });
    }
    const proc = spawn(this.bin, airplayArgs(name, pin, process.platform, videoPort), {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env,
    });
    this.proc = proc;
    const recent: string[] = [];
    const startedAt = Date.now();
    const onData = (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (!line.trim()) continue;
        recent.push(line.trim());
        if (recent.length > 12) recent.shift();
        this.emit("log", line.trim());
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.once("error", (e) => {
      this.proc = null;
      void this.video.close();
      this.set({ status: "error", message: e.message });
    });
    proc.once("exit", (code, signal) => {
      if (this.proc !== proc) return;
      this.proc = null;
      void this.video.close();
      // Stopped by us (signal) → "stopped". Anything else, or an exit right after start, is an error worth showing.
      const early = Date.now() - startedAt < 5000;
      if (signal && !early) return this.set({ status: "stopped" });
      const tail = recent.filter((l) => /error|erreur|not found|fail|unable|cannot|invalid/i.test(l)).slice(-3).join(" · ") || recent.slice(-2).join(" · ");
      this.set({ status: "error", message: `Le récepteur AirPlay s'est arrêté (code ${code ?? signal}).${tail ? ` ${tail}` : ""}` });
    });
    this.set({ status: "running", name, pin, since: Date.now(), inApp: !!this.inApp, streaming: false, videoPort, ...(this.notice ? { notice: this.notice } : {}) });
    return this.state;
  }

  /** Stop the receiver; resolves once the process has exited. */
  stop(): Promise<void> {
    const proc = this.proc;
    void this.video.close();
    if (!proc) return Promise.resolve();
    this.proc = null;
    return new Promise((resolve) => {
      const force = setTimeout(() => proc.kill("SIGKILL"), 2000);
      proc.once("exit", () => {
        clearTimeout(force);
        this.set(this.bin ? { status: "stopped" } : { status: "unavailable", reason: "not-installed" });
        resolve();
      });
      proc.kill("SIGTERM");
    });
  }
}
