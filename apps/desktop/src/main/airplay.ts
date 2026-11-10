import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
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
  | { status: "running"; name: string; pin: string; since: number }
  | { status: "error"; message: string };

export interface AirPlayEvents {
  state: [AirPlayState];
  log: [string];
}

const BIN = process.platform === "win32" ? "uxplay.exe" : "uxplay";

/** Look for UxPlay: explicit path, copy shipped next to the app, then PATH. */
export function findUxPlay(env: NodeJS.ProcessEnv = process.env, resourcesPath?: string): string | null {
  const candidates = [
    env.MM_UXPLAY_PATH,
    resourcesPath ? join(resourcesPath, "uxplay", BIN) : undefined,
    ...(env.PATH ?? "").split(delimiter).filter(Boolean).map((d) => join(d, BIN)),
    // Homebrew on macOS is often missing from the PATH of apps started from the Dock.
    ...(process.platform === "darwin" ? ["/opt/homebrew/bin/uxplay", "/usr/local/bin/uxplay"] : []),
  ];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

export function airplayArgs(name: string, pin: string): string[] {
  return [
    "-n", name,
    "-nh", // show exactly our name in the iPhone list
    "-pin", pin, // the iPhone must type this code
    "-reset", "5", // free the receiver if the iPhone disappears
    "-nohold", // a new (authenticated) client replaces a stale one
  ];
}

export class AirPlayReceiver extends EventEmitter<AirPlayEvents> {
  private proc: ChildProcess | null = null;
  private state: AirPlayState = { status: "stopped" };
  private bin: string | null;

  constructor(bin: string | null) {
    super();
    this.bin = bin;
    if (!bin) this.state = { status: "unavailable", reason: "not-installed" };
  }

  /** Re-detect UxPlay (e.g. after the user installed it). */
  setBinary(bin: string | null) {
    if (this.proc) return;
    this.bin = bin;
    this.set(bin ? { status: "stopped" } : { status: "unavailable", reason: "not-installed" });
  }

  get current(): AirPlayState {
    return this.state;
  }

  private set(s: AirPlayState) {
    this.state = s;
    this.emit("state", s);
  }

  start(deviceName: string): AirPlayState {
    if (!this.bin) return this.state;
    if (this.proc) return this.state;
    const name = `${cleanName(deviceName)} · MansoMirror`.slice(0, 60);
    const pin = String(randomInt(0, 10_000)).padStart(4, "0");
    const proc = spawn(this.bin, airplayArgs(name, pin), { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    this.proc = proc;
    const onData = (buf: Buffer) => {
      for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) this.emit("log", line.trim());
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.once("error", (e) => {
      this.proc = null;
      this.set({ status: "error", message: e.message });
    });
    proc.once("exit", (code, signal) => {
      if (this.proc !== proc) return;
      this.proc = null;
      this.set(signal || code === 0 ? { status: "stopped" } : { status: "error", message: `UxPlay s'est arrêté (code ${code}).` });
    });
    this.set({ status: "running", name, pin, since: Date.now() });
    return this.state;
  }

  /** Stop the receiver; resolves once the process has exited. */
  stop(): Promise<void> {
    const proc = this.proc;
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
