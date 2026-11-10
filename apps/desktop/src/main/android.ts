import { EventEmitter } from "node:events";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * Android: show and control a phone from the PC.
 *
 * Uses adb (Android platform-tools) to find phones over USB or Wi-Fi, and
 * scrcpy (https://github.com/Genymobile/scrcpy, Apache-2.0) to display the
 * screen and send mouse/keyboard input. The phone must have "USB debugging"
 * (or "Wireless debugging") enabled and the user must accept the computer's
 * key on the phone: Android itself enforces that consent.
 */

export interface AndroidDevice {
  serial: string;
  state: "device" | "unauthorized" | "offline" | "unknown";
  model: string;
  transport: "usb" | "wifi";
}

export type MirrorState =
  | { status: "running"; serial: string; since: number; control: boolean }
  | { status: "stopped"; serial: string }
  | { status: "error"; serial: string; message: string };

export interface AndroidEvents {
  mirror: [MirrorState];
  log: [string];
}

const exe = (n: string) => (process.platform === "win32" ? `${n}.exe` : n);

/** Look for a tool: explicit env path, copy shipped with the app, PATH, Homebrew. */
export function findTool(name: "scrcpy" | "adb", env: NodeJS.ProcessEnv = process.env, resourcesPath?: string): string | null {
  const bin = exe(name);
  const candidates = [
    name === "scrcpy" ? env.MM_SCRCPY_PATH : env.MM_ADB_PATH,
    resourcesPath ? join(resourcesPath, "scrcpy", bin) : undefined,
    ...(env.PATH ?? "").split(delimiter).filter(Boolean).map((d) => join(d, bin)),
    ...(process.platform === "darwin" ? [`/opt/homebrew/bin/${bin}`, `/usr/local/bin/${bin}`] : []),
  ];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

const SERIAL = /^[A-Za-z0-9._:\-]{1,128}$/;
const HOST_PORT = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/;

export const isSerial = (s: unknown): s is string => typeof s === "string" && SERIAL.test(s);
export const isHostPort = (s: unknown): s is string =>
  typeof s === "string" && HOST_PORT.test(s) && s.split(/[.:]/).slice(0, 4).every((n) => Number(n) <= 255) && Number(s.split(":")[1]) > 0 && Number(s.split(":")[1]) <= 65535;

/** Parse `adb devices -l`. */
export function parseAdbDevices(out: string): AndroidDevice[] {
  const list: AndroidDevice[] = [];
  for (const line of out.split(/\r?\n/)) {
    const m = /^(\S+)\s+(device|unauthorized|offline|\S+)\b(.*)$/.exec(line.trim());
    if (!m || line.startsWith("List of devices") || line.startsWith("*")) continue;
    const [, serial, state, rest] = m;
    if (!isSerial(serial)) continue;
    const model = /model:(\S+)/.exec(rest)?.[1]?.replace(/_/g, " ") ?? "";
    const wifi = /^\d+\.\d+\.\d+\.\d+:\d+$/.test(serial) || serial.includes("._adb-tls-connect._tcp");
    list.push({
      serial,
      state: state === "device" || state === "unauthorized" || state === "offline" ? state : "unknown",
      model: model || (wifi ? serial.split(":")[0] : serial),
      transport: wifi ? "wifi" : "usb",
    });
  }
  return list;
}

export interface MirrorOptions {
  maxSize: number; // 0 = native
  fps: number;
  control: boolean;
  title: string;
}

/** Only options that exist in both scrcpy 1.x and 3.x. */
export function scrcpyArgs(serial: string, o: MirrorOptions): string[] {
  const a = ["-s", serial, "--window-title", o.title, "--max-fps", String(o.fps), "-b", o.maxSize && o.maxSize <= 720 ? "4M" : "8M", "-w"];
  if (o.maxSize) a.push("-m", String(o.maxSize));
  if (!o.control) a.push("-n");
  return a;
}

function run(file: string, args: string[], timeout = 15_000): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(file, args, { timeout, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || stdout || err.message).trim())) : resolve(`${stdout}${stderr}`),
    ),
  );
}

export class AndroidBridge extends EventEmitter<AndroidEvents> {
  adb: string | null;
  scrcpy: string | null;
  private sessions = new Map<string, ChildProcess>();

  constructor(tools: { adb: string | null; scrcpy: string | null }) {
    super();
    this.adb = tools.adb;
    this.scrcpy = tools.scrcpy;
  }

  get available() {
    return !!this.adb && !!this.scrcpy;
  }

  async devices(): Promise<AndroidDevice[]> {
    if (!this.adb) return [];
    return parseAdbDevices(await run(this.adb, ["devices", "-l"]));
  }

  /** Android 11+ "Wireless debugging → Pair device with pairing code". */
  async pair(hostPort: string, code: string): Promise<string> {
    if (!this.adb) throw new Error("adb introuvable");
    if (!isHostPort(hostPort) || !/^\d{6}$/.test(code)) throw new Error("Adresse ou code invalide");
    const out = await run(this.adb, ["pair", hostPort, code], 20_000);
    if (!/Successfully paired/i.test(out)) throw new Error(out.split("\n").pop() || "Échec de l'appairage");
    return out;
  }

  async connect(hostPort: string): Promise<string> {
    if (!this.adb) throw new Error("adb introuvable");
    if (!isHostPort(hostPort)) throw new Error("Adresse invalide");
    const out = await run(this.adb, ["connect", hostPort], 15_000);
    if (!/connected to/i.test(out) || /cannot|failed/i.test(out)) throw new Error(out.trim() || "Connexion impossible");
    return out;
  }

  isRunning(serial: string) {
    return this.sessions.has(serial);
  }

  start(serial: string, o: MirrorOptions): MirrorState {
    if (!this.scrcpy) return { status: "error", serial, message: "scrcpy introuvable" };
    if (!isSerial(serial)) return { status: "error", serial, message: "Appareil invalide" };
    if (this.sessions.has(serial)) return { status: "running", serial, since: Date.now(), control: o.control };
    const env = { ...process.env, ...(this.adb ? { ADB: this.adb } : {}) };
    const proc = spawn(this.scrcpy, scrcpyArgs(serial, o), { stdio: ["ignore", "pipe", "pipe"], windowsHide: false, env });
    this.sessions.set(serial, proc);
    let lastError = "";
    const onData = (b: Buffer) => {
      for (const l of b.toString().split(/\r?\n/)) {
        if (!l.trim()) continue;
        if (/ERROR|error:/i.test(l)) lastError = l.replace(/^.*?ERROR:\s*/i, "").trim();
        this.emit("log", l.trim());
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.once("error", (e) => {
      this.sessions.delete(serial);
      this.emit("mirror", { status: "error", serial, message: e.message });
    });
    proc.once("exit", (code, signal) => {
      if (this.sessions.get(serial) !== proc) return;
      this.sessions.delete(serial);
      this.emit(
        "mirror",
        code === 0 || signal ? { status: "stopped", serial } : { status: "error", serial, message: lastError || `scrcpy s'est arrêté (code ${code}).` },
      );
    });
    const st: MirrorState = { status: "running", serial, since: Date.now(), control: o.control };
    this.emit("mirror", st);
    return st;
  }

  stop(serial: string): Promise<void> {
    const proc = this.sessions.get(serial);
    if (!proc) return Promise.resolve();
    this.sessions.delete(serial);
    return new Promise((resolve) => {
      const force = setTimeout(() => proc.kill("SIGKILL"), 2000);
      proc.once("exit", () => {
        clearTimeout(force);
        this.emit("mirror", { status: "stopped", serial });
        resolve();
      });
      proc.kill("SIGTERM");
    });
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((s) => this.stop(s)));
  }
}
