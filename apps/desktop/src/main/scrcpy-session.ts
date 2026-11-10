import { EventEmitter } from "node:events";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createServer, Socket, type AddressInfo } from "node:net";
import { randomInt } from "node:crypto";
import { DEVICE_SERVER_PATH, VideoDemuxer, serverCommand, socketName, type VideoMeta, type VideoPacket } from "./scrcpy-protocol.ts";

/**
 * One phone being shown inside MansoMirror.
 *   adb push scrcpy-server → adb forward tcp:PORT localabstract:scrcpy_SCID
 *   → adb shell app_process … Server 3.3.1 → connect video + control sockets.
 * The decoded picture is drawn by the renderer (WebCodecs); this class only
 * moves bytes.
 */

export interface SessionEvents {
  meta: [VideoMeta];
  packet: [VideoPacket];
  ended: [{ reason: string }];
}

export interface SessionOptions {
  maxSize: number;
  maxFps: number;
  bitRate: number;
  control: boolean;
}

const CONNECT_ATTEMPTS = 100;
const CONNECT_DELAY_MS = 100;

function run(file: string, args: string[], timeout = 20_000): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(file, args, { timeout, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || stdout || err.message).trim())) : resolve(`${stdout}${stderr}`),
    ),
  );
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
}

/** Connect and wait for the 1-byte "ready" signal; the forward tunnel accepts before the device listens, so retry. */
async function connectReady(port: number, host = "127.0.0.1"): Promise<Socket> {
  for (let i = 0; i < CONNECT_ATTEMPTS; i++) {
    const sock = await new Promise<Socket | null>((resolve) => {
      const s = new Socket();
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        s.removeAllListeners("data");
        if (ok) resolve(s);
        else {
          s.destroy();
          resolve(null);
        }
      };
      s.once("error", () => finish(false));
      s.once("close", () => finish(false));
      s.once("data", (d: Buffer) => {
        if (d.length > 1) s.unshift(d.subarray(1)); // keep anything after the dummy byte
        finish(true);
      });
      s.connect(port, host);
    });
    if (sock) {
      sock.removeAllListeners("error");
      sock.removeAllListeners("close");
      return sock;
    }
    await new Promise((r) => setTimeout(r, CONNECT_DELAY_MS));
  }
  throw new Error("Le téléphone ne répond pas (serveur MansoMirror non démarré).");
}

export class ScrcpySession extends EventEmitter<SessionEvents> {
  private video: Socket | null = null;
  private control: Socket | null = null;
  private shell: ChildProcess | null = null;
  private forward: { adb: string; serial: string; port: number } | null = null;
  private ended = false;
  meta: VideoMeta | null = null;

  /** Start the server on the phone through adb, then attach. */
  async startOnDevice(adb: string, serial: string, serverJar: string, o: SessionOptions): Promise<void> {
    const scid = randomInt(0, 0x7fffffff);
    await run(adb, ["-s", serial, "push", serverJar, DEVICE_SERVER_PATH], 60_000);
    const port = await freePort();
    await run(adb, ["-s", serial, "forward", `tcp:${port}`, `localabstract:${socketName(scid)}`]);
    this.forward = { adb, serial, port };
    const shell = spawn(adb, ["-s", serial, "shell", ...serverCommand({ scid, ...o })], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    this.shell = shell;
    let lastLine = "";
    const keep = (b: Buffer) => {
      const l = b.toString().trim().split(/\r?\n/).pop();
      if (l) lastLine = l;
    };
    shell.stdout?.on("data", keep);
    shell.stderr?.on("data", keep);
    shell.once("exit", () => this.end(lastLine ? `Le téléphone a arrêté la session : ${lastLine}` : "Le téléphone a arrêté la session."));
    await this.attach(port);
  }

  /** Attach to an already listening server (forwarded port, or a test double). */
  async attach(port: number, host = "127.0.0.1"): Promise<void> {
    const video = await connectReady(port, host);
    this.video = video;
    const control = new Socket();
    await new Promise<void>((resolve, reject) => {
      control.once("error", reject);
      control.connect(port, host, () => {
        control.removeListener("error", reject);
        resolve();
      });
    });
    this.control = control;
    control.on("error", () => this.end("Connexion de contrôle perdue."));
    control.on("data", () => {}); // device → client messages (clipboard…) are ignored for now

    const demux = new VideoDemuxer(
      (m) => {
        this.meta = m;
        this.emit("meta", m);
      },
      (p) => this.emit("packet", p),
    );
    video.on("data", (d: Buffer) => {
      try {
        demux.push(d);
      } catch (e) {
        this.end(`Flux vidéo invalide : ${(e as Error).message}`);
      }
    });
    video.on("close", () => this.end("Le téléphone s'est déconnecté."));
    video.on("error", () => this.end("Connexion vidéo perdue."));
  }

  send(msg: Uint8Array): boolean {
    if (!this.control || this.control.destroyed) return false;
    return this.control.write(msg);
  }

  end(reason = "Session arrêtée."): void {
    if (this.ended) return;
    this.ended = true;
    this.video?.destroy();
    this.control?.destroy();
    this.shell?.kill();
    if (this.forward) {
      const { adb, serial, port } = this.forward;
      execFile(adb, ["-s", serial, "forward", "--remove", `tcp:${port}`], { timeout: 5000 }, () => {});
    }
    this.emit("ended", { reason });
  }
}
