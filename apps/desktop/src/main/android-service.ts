import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AndroidBridge, isSerial, type AndroidDevice } from "./android.ts";
import { ScrcpySession, type SessionOptions } from "./scrcpy-session.ts";
import {
  KeyAction,
  Keycode,
  MotionAction,
  backOrScreenOnMessage,
  keyMessage,
  resetVideoMessage,
  scrollMessage,
  textMessage,
  touchMessage,
  type VideoMeta,
  type VideoPacket,
} from "./scrcpy-protocol.ts";

/** Input from the renderer: high-level, validated here, never raw bytes. */
export type AndroidInput =
  | { kind: "touch"; action: "down" | "move" | "up"; x: number; y: number; w: number; h: number }
  | { kind: "scroll"; x: number; y: number; w: number; h: number; dx: number; dy: number }
  | { kind: "key"; action: "down" | "up"; keycode: number }
  | { kind: "text"; text: string }
  | { kind: "nav"; button: "back" | "home" | "recents" | "power" | "volume-up" | "volume-down" }
  | { kind: "reset-video" };

export type AndroidEvent =
  | { type: "meta"; serial: string; meta: VideoMeta }
  | { type: "ended"; serial: string; reason: string };

export interface AndroidServiceEvents {
  event: [AndroidEvent];
  packet: [{ serial: string } & VideoPacket];
}

const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const ALLOWED_KEYCODES = new Set<number>(Object.values(Keycode));
const NAV: Record<string, number> = {
  home: Keycode.HOME,
  recents: Keycode.APP_SWITCH,
  power: Keycode.POWER,
  "volume-up": Keycode.VOLUME_UP,
  "volume-down": Keycode.VOLUME_DOWN,
};

/** Translate a validated input into protocol messages; null when invalid. */
export function inputToMessages(i: unknown): Uint8Array[] | null {
  if (typeof i !== "object" || i === null) return null;
  const e = i as Record<string, unknown>;
  const pos = num(e.x, 0, 65535) && num(e.y, 0, 65535) && num(e.w, 1, 65535) && num(e.h, 1, 65535);
  switch (e.kind) {
    case "touch": {
      const a = { down: MotionAction.DOWN, move: MotionAction.MOVE, up: MotionAction.UP }[e.action as string];
      if (a === undefined || !pos) return null;
      return [touchMessage(a, Math.round(e.x as number), Math.round(e.y as number), e.w as number, e.h as number)];
    }
    case "scroll":
      if (!pos || !num(e.dx, -16, 16) || !num(e.dy, -16, 16)) return null;
      return [scrollMessage(Math.round(e.x as number), Math.round(e.y as number), e.w as number, e.h as number, e.dx as number, e.dy as number)];
    case "key": {
      const a = e.action === "down" ? KeyAction.DOWN : e.action === "up" ? KeyAction.UP : null;
      if (a === null || typeof e.keycode !== "number" || !ALLOWED_KEYCODES.has(e.keycode)) return null;
      return [keyMessage(a, e.keycode)];
    }
    case "text":
      if (typeof e.text !== "string" || e.text.length === 0 || e.text.length > 300) return null;
      return [textMessage(e.text)];
    case "nav":
      if (e.button === "back") return [backOrScreenOnMessage(KeyAction.DOWN), backOrScreenOnMessage(KeyAction.UP)];
      if (typeof e.button === "string" && e.button in NAV) {
        const k = NAV[e.button];
        return [keyMessage(KeyAction.DOWN, k), keyMessage(KeyAction.UP, k)];
      }
      return null;
    case "reset-video":
      return [resetVideoMessage()];
    default:
      return null;
  }
}

/** scrcpy-server jar: explicit env path, shipped copy, or the dev vendor folder. */
export function findScrcpyServer(env: NodeJS.ProcessEnv, resourcesPath: string | undefined, appDir: string): string | null {
  const c = [env.MM_SCRCPY_SERVER, resourcesPath && join(resourcesPath, "scrcpy", "scrcpy-server"), join(appDir, "vendor", "scrcpy", "scrcpy-server")];
  return c.find((p): p is string => !!p && existsSync(p)) ?? null;
}

export const FAKE_SERIAL = "mansomirror-test-phone";

export class AndroidService extends EventEmitter<AndroidServiceEvents> {
  bridge: AndroidBridge;
  serverJar: string | null;
  /** Test only: a fake phone listening on this local port. */
  private fakePort: number | null;
  private sessions = new Map<string, { s: ScrcpySession; control: boolean }>();

  constructor(bridge: AndroidBridge, serverJar: string | null, fakePort: number | null = null) {
    super();
    this.bridge = bridge;
    this.serverJar = serverJar;
    this.fakePort = fakePort;
  }

  status() {
    return { adb: !!this.bridge.adb, server: !!this.serverJar, available: (!!this.bridge.adb && !!this.serverJar) || this.fakePort !== null };
  }

  async devices(): Promise<AndroidDevice[]> {
    const list = this.bridge.adb ? await this.bridge.devices().catch(() => []) : [];
    if (this.fakePort !== null) list.unshift({ serial: FAKE_SERIAL, state: "device", model: "Téléphone de test", transport: "wifi" });
    return list;
  }

  isActive(serial: string) {
    return this.sessions.has(serial);
  }

  async start(serial: string, o: SessionOptions): Promise<void> {
    if (!isSerial(serial)) throw new Error("Appareil invalide");
    if (this.sessions.has(serial)) return;
    const s = new ScrcpySession();
    this.sessions.set(serial, { s, control: o.control });
    s.on("meta", (meta) => this.emit("event", { type: "meta", serial, meta }));
    s.on("packet", (p) => this.emit("packet", { serial, ...p }));
    s.once("ended", ({ reason }) => {
      if (this.sessions.get(serial)?.s === s) this.sessions.delete(serial);
      this.emit("event", { type: "ended", serial, reason });
    });
    try {
      if (serial === FAKE_SERIAL && this.fakePort !== null) await s.attach(this.fakePort);
      else {
        if (!this.bridge.adb || !this.serverJar) throw new Error("adb ou le serveur MansoMirror pour Android est introuvable.");
        await s.startOnDevice(this.bridge.adb, serial, this.serverJar, o);
      }
    } catch (e) {
      this.sessions.delete(serial);
      s.removeAllListeners("ended");
      s.end();
      throw e;
    }
  }

  input(serial: string, i: unknown): boolean {
    const sess = this.sessions.get(serial);
    if (!sess) return false;
    const isReset = typeof i === "object" && i !== null && (i as { kind?: unknown }).kind === "reset-video";
    // View-only sessions refuse every input except asking for a fresh key frame.
    if (!sess.control && !isReset) return false;
    const msgs = inputToMessages(i);
    if (!msgs) return false;
    for (const m of msgs) sess.s.send(m);
    return true;
  }

  stop(serial: string) {
    this.sessions.get(serial)?.s.end("Session arrêtée.");
  }

  stopAll() {
    for (const { s } of this.sessions.values()) s.end("Toutes les connexions ont été coupées.");
  }
}
