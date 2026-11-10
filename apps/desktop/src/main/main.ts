import { app, BrowserWindow, desktopCapturer, dialog, type DesktopCapturerSource, globalShortcut, ipcMain, protocol, session, shell, type IpcMainInvokeEvent } from "electron";
import { join, normalize, extname, sep } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { HostServer } from "./host.ts";
import { ViewerClient, PairingError } from "./viewer.ts";
import { Discovery, localAddresses } from "./discovery.ts";
import { Store } from "./store.ts";
import { AirPlayReceiver, findUxPlay } from "./airplay.ts";
import { AndroidBridge, findTool, isHostPort, isSerial } from "./android.ts";
import { AndroidService, findScrcpyServer } from "./android-service.ts";
import { randomHex } from "./pairing.ts";
import { IPC, type CaptureSource, type HostEvent, type ViewerEvent } from "../shared/api.ts";

// ---------------------------------------------------------------------------
// Process-wide hardening
// ---------------------------------------------------------------------------
// Process-wide sandbox, unless explicitly disabled (only needed to run as root in CI containers).
if (!app.commandLine.hasSwitch("no-sandbox")) app.enableSandbox();
// Test-only: lets the end-to-end suite run two isolated instances side by side.
if (!app.isPackaged && process.env.MM_USER_DATA) app.setPath("userData", process.env.MM_USER_DATA);
if (!app.requestSingleInstanceLock()) app.quit();

// The UI is served from a private, secure scheme rather than file://, so the
// GrantFileProtocolExtraPrivileges fuse can stay off.
const SCHEME = "app";
const ORIGIN = `${SCHEME}://mansomirror`;
const RENDERER_URL = `${ORIGIN}/index.html`;
const RENDERER_DIR = join(__dirname, "renderer");
const isAppUrl = (url: string | undefined) => !!url && url.split("#")[0] === RENDERER_URL;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob: mediastream:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: false } }]);

async function serveRenderer(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.host !== "mansomirror") return new Response(null, { status: 404 });
  const file = normalize(join(RENDERER_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(RENDERER_DIR + sep) || !MIME[extname(file)]) return new Response(null, { status: 404 });
  try {
    return new Response(await readFile(file), {
      headers: { "content-type": MIME[extname(file)], "content-security-policy": CSP, "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

app.on("web-contents-created", (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url)) e.preventDefault();
  });
  contents.on("will-attach-webview", (e) => e.preventDefault());
});

let win: BrowserWindow | null = null;
let store: Store;
let deviceId = "";
const host = new HostServer(() => store.settings.deviceName);
const viewer = new ViewerClient();
const discovery = new Discovery();
const airplay = new AirPlayReceiver(findUxPlay(process.env, process.resourcesPath));
airplay.on("state", (st) => win?.webContents.send(IPC.airplayEvent, st));

// Test-only fake phone (see test/fixtures/fake-phone.mjs); ignored in packaged builds.
const fakePhonePort = !app.isPackaged && process.env.MM_ANDROID_FAKE_PORT ? Number(process.env.MM_ANDROID_FAKE_PORT) : null;
const android = new AndroidService(
  new AndroidBridge({ adb: findTool("adb", process.env, process.resourcesPath), scrcpy: null }),
  findScrcpyServer(process.env, process.resourcesPath, join(__dirname, "..")),
  fakePhonePort,
);
const androidHistory = new Map<string, string>();
android.on("event", (e) => {
  if (e.type === "meta") {
    const id = randomHex(8);
    androidHistory.set(e.serial, id);
    store.startSession({ id, role: "viewer", peer: e.meta.deviceName || "Android", address: e.serial });
  } else {
    const id = androidHistory.get(e.serial);
    if (id) store.endSession(id, e.reason);
    androidHistory.delete(e.serial);
  }
  win?.webContents.send(IPC.androidEvent, e);
});
android.on("packet", (p) => win?.webContents.send(IPC.androidVideo, p));
let selectedSource: DesktopCapturerSource | null = null;
/** Sources from the last listing shown to the user; only these can be selected. */
let listedSources = new Map<string, DesktopCapturerSource>();
let hostHistoryId: string | null = null;
let viewerHistoryId: string | null = null;

function loadDeviceId(dir: string): string {
  const p = join(dir, "device-id");
  try {
    const v = readFileSync(p, "utf8").trim();
    if (/^[0-9a-f]{32}$/.test(v)) return v;
  } catch {}
  const id = randomHex();
  mkdirSync(dir, { recursive: true });
  writeFileSync(p, id, { mode: 0o600 });
  return id;
}

const sendHost = (e: HostEvent) => win?.webContents.send(IPC.hostEvent, e);
const sendViewer = (e: ViewerEvent) => win?.webContents.send(IPC.viewerEvent, e);

host.on("request", (r) => sendHost({ type: "request", ...r }));
host.on("connected", (c) => {
  hostHistoryId = c.requestId;
  store.startSession({ id: c.requestId, role: "host", peer: c.name, address: c.address });
  discovery.unpublish(); // one session at a time: stop advertising
  sendHost({ type: "connected", name: c.name, address: c.address });
});
host.on("ended", ({ reason }) => {
  if (hostHistoryId) store.endSession(hostHistoryId, reason);
  hostHistoryId = null;
  sendHost({ type: "ended", reason });
});
host.on("recording", (r) => sendHost({ type: "recording", ...r }));
host.on("pin", (p) => sendHost({ type: "pin", ...p }));
host.on("attempt", (a) => sendHost({ type: "attempt", ...a }));
viewer.on("recording", (r) => sendViewer({ type: "recording", ...r }));
viewer.on("ended", ({ reason }) => {
  if (viewerHistoryId) store.endSession(viewerHistoryId, reason);
  viewerHistoryId = null;
  sendViewer({ type: "ended", reason });
});

async function killAll() {
  viewer.disconnect();
  android.stopAll();
  await Promise.all([host.stop("killed"), airplay.stop()]);
  discovery.unpublish();
  selectedSource = null;
  win?.webContents.send(IPC.killed);
}

// ---------------------------------------------------------------------------
// IPC — every handler checks the sender and validates its arguments.
// ---------------------------------------------------------------------------
function handle(channel: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(channel, (e: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!isAppUrl(e.senderFrame?.url)) throw new Error("forbidden");
    return fn(...args);
  });
}

const str = (v: unknown, max: number): string => {
  if (typeof v !== "string" || v.length === 0 || v.length > max) throw new Error("invalid argument");
  return v;
};

function registerIpc() {
  handle(IPC.info, () => ({ version: app.getVersion(), platform: process.platform, deviceId, addresses: localAddresses() }));
  handle(IPC.getSettings, () => store.settings);
  handle(IPC.setSettings, (patch) => store.updateSettings(patch));
  handle(IPC.history, () => store.history);
  handle(IPC.clearHistory, () => store.clearHistory());

  handle(IPC.listSources, async (): Promise<CaptureSource[]> => {
    // Screens and windows are listed separately: on some systems the combined
    // request intermittently comes back empty when window enumeration fails.
    const opts = { thumbnailSize: { width: 320, height: 180 } };
    const [screens, windows] = await Promise.all([
      desktopCapturer.getSources({ ...opts, types: ["screen"] }).catch(() => []),
      desktopCapturer.getSources({ ...opts, types: ["window"] }).catch(() => []),
    ]);
    const sources = [...screens, ...windows];
    listedSources = new Map(sources.map((s) => [s.id, s]));
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith("screen:") ? "screen" : "window",
      thumbnail: s.thumbnail.toDataURL(),
    }));
  });
  handle(IPC.selectSource, (id) => {
    selectedSource = listedSources.get(str(id, 200)) ?? null;
    return selectedSource !== null;
  });

  handle(IPC.hostStart, async () => {
    const port = await host.start(store.settings.port);
    const pin = host.issuePin();
    if (store.settings.discoverable) discovery.publish(store.settings.deviceName, port, deviceId);
    return { ...pin, port, addresses: localAddresses() };
  });
  handle(IPC.hostNewPin, () => {
    if (store.settings.discoverable && host.port && !host.inSession) discovery.publish(store.settings.deviceName, host.port, deviceId);
    return host.issuePin();
  });
  handle(IPC.hostStop, async () => {
    discovery.unpublish();
    await host.stop();
    selectedSource = null;
  });
  handle(IPC.hostAccept, (id, sdp) => host.accept(str(id, 64), str(sdp, 32 * 1024)));
  handle(IPC.hostRefuse, (id) => host.refuse(str(id, 64)));
  handle(IPC.hostEndSession, () => host.endSession("stopped"));

  handle(IPC.discoverStart, () => discovery.browse(deviceId, (list) => win?.webContents.send(IPC.devices, list)));
  handle(IPC.discoverStop, () => discovery.stopBrowsing());

  handle(IPC.viewerConnect, async (args) => {
    const a = (args ?? {}) as Record<string, unknown>;
    const hostAddr = str(a.host, 255);
    if (!/^[0-9a-zA-Z.:\-[\]]+$/.test(hostAddr)) return { ok: false, code: "unreachable" };
    const port = Number(a.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, code: "unreachable" };
    try {
      const res = await viewer.connect({
        host: hostAddr,
        port,
        pin: str(a.pin, 6),
        name: store.settings.deviceName,
        offerSdp: str(a.offerSdp, 32 * 1024),
      });
      viewerHistoryId = randomHex(8);
      store.startSession({ id: viewerHistoryId, role: "viewer", peer: res.hostName, address: hostAddr });
      return { ok: true, ...res };
    } catch (e) {
      if (e instanceof PairingError) return { ok: false, code: e.code, remaining: e.remaining };
      return { ok: false, code: "unreachable" };
    }
  });
  handle(IPC.viewerSetRecording, (on) => viewer.setRecording(on === true));
  handle(IPC.viewerDisconnect, () => viewer.disconnect());
  handle(IPC.killAll, () => killAll());

  handle(IPC.airplayState, (recheck) => {
    if (recheck === true) airplay.setBinary(findUxPlay(process.env, process.resourcesPath));
    return airplay.current;
  });
  handle(IPC.airplayStart, () => airplay.start(store.settings.deviceName));
  handle(IPC.airplayStop, () => airplay.stop());

  handle(IPC.androidStatus, () => android.status());
  handle(IPC.androidDevices, () => android.devices());
  handle(IPC.androidPair, async (hostPort, code) => {
    if (!isHostPort(hostPort) || typeof code !== "string" || !/^\d{6}$/.test(code)) return { ok: false, message: "Adresse ou code invalide." };
    try {
      await android.bridge.pair(hostPort, code);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  });
  handle(IPC.androidConnect, async (hostPort) => {
    if (!isHostPort(hostPort)) return { ok: false, message: "Adresse invalide." };
    try {
      await android.bridge.connect(hostPort);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  });
  handle(IPC.androidStart, async (serial, control) => {
    if (!isSerial(serial)) return { ok: false, message: "Appareil invalide." };
    try {
      await android.start(serial, {
        maxSize: store.settings.maxHeight,
        maxFps: store.settings.fps,
        bitRate: store.settings.maxHeight && store.settings.maxHeight <= 720 ? 4_000_000 : 8_000_000,
        control: control !== false,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  });
  handle(IPC.androidInput, (serial, input) => (isSerial(serial) ? android.input(serial, input) : false));
  handle(IPC.androidStop, (serial) => {
    if (isSerial(serial)) android.stop(serial);
  });

  handle(IPC.saveFile, async (kind, data) => {
    if ((kind !== "png" && kind !== "webm") || !(data instanceof ArrayBuffer || ArrayBuffer.isView(data))) throw new Error("invalid argument");
    const buf = data instanceof ArrayBuffer ? Buffer.from(new Uint8Array(data)) : Buffer.from(data as Uint8Array);
    if (buf.length > 4 * 1024 ** 3) throw new Error("too large");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const res = await dialog.showSaveDialog(win!, {
      defaultPath: join(app.getPath(kind === "png" ? "pictures" : "videos"), `MansoMirror-${stamp}.${kind}`),
      filters: [kind === "png" ? { name: "Image PNG", extensions: ["png"] } : { name: "Vidéo WebM", extensions: ["webm"] }],
    });
    if (res.canceled || !res.filePath) return null;
    writeFileSync(res.filePath, buf);
    return res.filePath;
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: "MansoMirror",
    backgroundColor: "#111110",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => (win = null));
  void win.loadURL(RENDERER_URL);
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, serveRenderer);
  store = new Store(app.getPath("userData"));
  deviceId = loadDeviceId(app.getPath("userData"));

  const ses = session.defaultSession;
  // Only our own page may use screen capture; nothing else is ever granted.
  ses.setPermissionRequestHandler((wc, permission, cb, details) =>
    cb((permission === "media" || permission === "display-capture") && isAppUrl(details.requestingUrl ?? wc.getURL())),
  );
  ses.setPermissionCheckHandler((_wc, permission, origin) => (permission === "media" || permission === "display-capture") && origin === ORIGIN);
  // getDisplayMedia only ever returns the source the user explicitly picked in our UI.
  ses.setDisplayMediaRequestHandler((req, callback) => {
    const src = selectedSource;
    selectedSource = null; // one capture per explicit choice
    if (!src || !isAppUrl(req.frame?.url)) return callback({});
    callback({ video: src });
  });

  registerIpc();
  createWindow();

  // Global kill switch, works even when the window is hidden behind others.
  globalShortcut.register("CommandOrControl+Alt+K", () => void killAll());
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  viewer.disconnect();
  void host.stop("stopped");
  discovery.destroy();
  void airplay.stop();
  android.stopAll();
});
