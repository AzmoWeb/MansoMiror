import type { Settings, HistoryEntry } from "../main/store.ts";
import type { DiscoveredDevice } from "../main/discovery.ts";
import type { AirPlayState } from "../main/airplay.ts";
import type { AndroidDevice } from "../main/android.ts";
import type { AndroidEvent, AndroidInput } from "../main/android-service.ts";
import type { UpdateState } from "../main/updater.ts";

export type { Settings, HistoryEntry, DiscoveredDevice, AirPlayState, AndroidDevice, AndroidEvent, AndroidInput, UpdateState };

export interface AndroidVideoPacket {
  serial: string;
  config: boolean;
  key: boolean;
  pts: number;
  data: Uint8Array;
}

export interface AppInfo {
  version: string;
  platform: string;
  deviceId: string;
  addresses: string[];
}

export interface CaptureSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string;
}

export type HostEvent =
  | { type: "request"; requestId: string; name: string; address: string; offerSdp: string }
  | { type: "connected"; name: string; address: string }
  | { type: "ended"; reason: string }
  | { type: "recording"; on: boolean }
  | { type: "pin"; state: "locked" | "expired" | "used" }
  | { type: "attempt"; ok: boolean; remaining?: number; address: string };

export type ViewerEvent = { type: "ended"; reason: string } | { type: "recording"; on: boolean };

export type ConnectResult =
  | { ok: true; answerSdp: string; hostName: string }
  | { ok: false; code: string; remaining?: number };

/** The only surface the renderer can reach (exposed by the preload as window.mm). */
export interface MansoApi {
  info(): Promise<AppInfo>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  history(): Promise<HistoryEntry[]>;
  clearHistory(): Promise<void>;

  listSources(): Promise<CaptureSource[]>;
  selectSource(id: string): Promise<boolean>;

  hostStart(): Promise<{ pin: string; expiresAt: number; port: number; addresses: string[] }>;
  hostNewPin(): Promise<{ pin: string; expiresAt: number }>;
  hostStop(): Promise<void>;
  hostAccept(requestId: string, answerSdp: string): Promise<boolean>;
  hostRefuse(requestId: string): Promise<void>;
  hostEndSession(): Promise<void>;
  onHostEvent(cb: (e: HostEvent) => void): () => void;

  discoverStart(): Promise<void>;
  discoverStop(): Promise<void>;
  onDevices(cb: (list: DiscoveredDevice[]) => void): () => void;

  viewerConnect(args: { host: string; port: number; pin: string; offerSdp: string }): Promise<ConnectResult>;
  viewerSetRecording(on: boolean): Promise<void>;
  viewerDisconnect(): Promise<void>;
  onViewerEvent(cb: (e: ViewerEvent) => void): () => void;

  /** Ends every session, stops sharing, stops listening. */
  killAll(): Promise<void>;
  onKilled(cb: () => void): () => void;

  saveFile(kind: "png" | "webm", data: ArrayBuffer): Promise<string | null>;

  /** AirPlay receiver (iPhone / iPad "Recopie de l'écran"). recheck = look for UxPlay again. */
  airplayState(recheck?: boolean): Promise<AirPlayState>;
  airplayStart(): Promise<AirPlayState>;
  airplayStop(): Promise<void>;
  /** Opens the folder with main.log and uxplay.log. */
  openLogs(): Promise<void>;
  onAirPlay(cb: (s: AirPlayState) => void): () => void;
  onAirPlayVideo(cb: (p: { config: boolean; key: boolean; pts: number; data: Uint8Array }) => void): () => void;

  /** Android: show and control a phone inside MansoMirror. */
  androidStatus(): Promise<{ adb: boolean; server: boolean; available: boolean }>;
  androidDevices(): Promise<AndroidDevice[]>;
  androidPair(hostPort: string, code: string): Promise<{ ok: boolean; message?: string }>;
  androidConnect(hostPort: string): Promise<{ ok: boolean; message?: string }>;
  androidStart(serial: string, control: boolean): Promise<{ ok: boolean; message?: string }>;
  androidInput(serial: string, input: AndroidInput): Promise<boolean>;
  androidStop(serial: string): Promise<void>;
  onAndroidEvent(cb: (e: AndroidEvent) => void): () => void;
  onAndroidVideo(cb: (p: AndroidVideoPacket) => void): () => void;

  /** Automatic updates. */
  updateState(): Promise<UpdateState>;
  updateCheck(): Promise<void>;
  updateInstall(): Promise<boolean>;
  onUpdate(cb: (s: UpdateState) => void): () => void;
}

export const IPC = {
  info: "mm:info",
  getSettings: "mm:settings:get",
  setSettings: "mm:settings:set",
  history: "mm:history",
  clearHistory: "mm:history:clear",
  listSources: "mm:sources",
  selectSource: "mm:sources:select",
  hostStart: "mm:host:start",
  hostNewPin: "mm:host:pin",
  hostStop: "mm:host:stop",
  hostAccept: "mm:host:accept",
  hostRefuse: "mm:host:refuse",
  hostEndSession: "mm:host:end",
  hostEvent: "mm:host:event",
  discoverStart: "mm:discover:start",
  discoverStop: "mm:discover:stop",
  devices: "mm:devices",
  viewerConnect: "mm:viewer:connect",
  viewerSetRecording: "mm:viewer:recording",
  viewerDisconnect: "mm:viewer:disconnect",
  viewerEvent: "mm:viewer:event",
  killAll: "mm:kill",
  killed: "mm:killed",
  saveFile: "mm:save",
  airplayState: "mm:airplay:state",
  airplayStart: "mm:airplay:start",
  airplayStop: "mm:airplay:stop",
  airplayEvent: "mm:airplay:event",
  airplayVideo: "mm:airplay:video",
  openLogs: "mm:logs:open",
  androidStatus: "mm:android:status",
  androidDevices: "mm:android:devices",
  androidPair: "mm:android:pair",
  androidConnect: "mm:android:connect",
  androidStart: "mm:android:start",
  androidInput: "mm:android:input",
  androidStop: "mm:android:stop",
  androidEvent: "mm:android:event",
  androidVideo: "mm:android:video",
  updateState: "mm:update:state",
  updateCheck: "mm:update:check",
  updateInstall: "mm:update:install",
  updateEvent: "mm:update:event",
} as const;
