import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { hostname } from "node:os";
import { cleanName } from "../shared/protocol.ts";

export interface Settings {
  deviceName: string;
  theme: "auto" | "light" | "dark";
  maxHeight: 720 | 1080 | 1440 | 0; // 0 = native
  fps: 30 | 60;
  port: number;
  discoverable: boolean;
}

export interface HistoryEntry {
  id: string;
  role: "host" | "viewer";
  peer: string;
  address: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export const defaultSettings = (): Settings => ({
  deviceName: cleanName(hostname()),
  theme: "auto",
  maxHeight: 1080,
  fps: 30,
  port: 47800,
  discoverable: true,
});

const MAX_HISTORY = 200;

/** Validate untrusted input (from disk or from the renderer) into Settings. */
export function sanitizeSettings(input: unknown, base: Settings): Settings {
  const s = { ...base };
  if (typeof input !== "object" || input === null) return s;
  const i = input as Record<string, unknown>;
  if (typeof i.deviceName === "string") s.deviceName = cleanName(i.deviceName);
  if (i.theme === "auto" || i.theme === "light" || i.theme === "dark") s.theme = i.theme;
  if (i.maxHeight === 720 || i.maxHeight === 1080 || i.maxHeight === 1440 || i.maxHeight === 0) s.maxHeight = i.maxHeight;
  if (i.fps === 30 || i.fps === 60) s.fps = i.fps;
  if (Number.isInteger(i.port) && (i.port as number) >= 1024 && (i.port as number) <= 65535) s.port = i.port as number;
  if (typeof i.discoverable === "boolean") s.discoverable = i.discoverable;
  return s;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Atomic write: a crash never leaves a half-written file. */
function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

export class Store {
  private settingsPath: string;
  private historyPath: string;
  settings: Settings;
  history: HistoryEntry[];

  constructor(dir: string) {
    this.settingsPath = join(dir, "settings.json");
    this.historyPath = join(dir, "history.json");
    this.settings = sanitizeSettings(readJson(this.settingsPath), defaultSettings());
    const h = readJson(this.historyPath);
    this.history = Array.isArray(h) ? (h as HistoryEntry[]).slice(0, MAX_HISTORY) : [];
  }

  updateSettings(patch: unknown): Settings {
    this.settings = sanitizeSettings(patch, this.settings);
    writeJson(this.settingsPath, this.settings);
    return this.settings;
  }

  startSession(e: Omit<HistoryEntry, "endedAt" | "endReason" | "startedAt">): void {
    this.history.unshift({ ...e, startedAt: new Date().toISOString(), endedAt: null, endReason: null });
    this.history = this.history.slice(0, MAX_HISTORY);
    writeJson(this.historyPath, this.history);
  }

  endSession(id: string, reason: string): void {
    const e = this.history.find((h) => h.id === id);
    if (!e || e.endedAt) return;
    e.endedAt = new Date().toISOString();
    e.endReason = reason;
    writeJson(this.historyPath, this.history);
  }

  clearHistory(): void {
    this.history = [];
    writeJson(this.historyPath, this.history);
  }
}
