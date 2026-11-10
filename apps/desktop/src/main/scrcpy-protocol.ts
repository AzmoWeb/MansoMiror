/**
 * scrcpy 3.3.1 wire protocol (server side is Genymobile's scrcpy-server,
 * Apache-2.0). Verified against app/src/{server,demuxer,control_msg}.c of
 * scrcpy v3.3.1. Pure functions + a stream demuxer, no I/O.
 *
 * Connection (tunnel_forward=true):
 *   1. first socket = video: device sends 1 dummy byte when ready
 *   2. second socket = control (audio is disabled)
 *   3. on the video socket: device name (64 bytes, NUL padded),
 *      codec id (u32 BE, "h264"), width (u32), height (u32),
 *      then packets: [u64 pts|flags][u32 size][size bytes Annex-B]
 */

export const SCRCPY_VERSION = "3.3.1";
export const DEVICE_SERVER_PATH = "/data/local/tmp/scrcpy-server.jar";
export const DEVICE_NAME_LENGTH = 64;
export const CODEC_H264 = 0x68_32_36_34; // "h264"

const FLAG_CONFIG = 1n << 63n;
const FLAG_KEY = 1n << 62n;
const PTS_MASK = FLAG_KEY - 1n;

export const socketName = (scid: number) => `scrcpy_${(scid >>> 0).toString(16).padStart(8, "0")}`;

export interface ServerOptions {
  scid: number;
  maxSize: number; // 0 = native
  maxFps: number;
  bitRate: number;
  control: boolean;
}

/** Arguments after `adb -s SERIAL shell`. */
export function serverCommand(o: ServerOptions): string[] {
  const p = [
    `CLASSPATH=${DEVICE_SERVER_PATH}`,
    "app_process",
    "/",
    "com.genymobile.scrcpy.Server",
    SCRCPY_VERSION,
    `scid=${(o.scid >>> 0).toString(16).padStart(8, "0")}`,
    "log_level=info",
    `video_bit_rate=${o.bitRate}`,
    "audio=false",
    "video_codec=h264",
    "tunnel_forward=true",
    "stay_awake=true",
  ];
  if (o.maxSize) p.push(`max_size=${o.maxSize}`);
  if (o.maxFps) p.push(`max_fps=${o.maxFps}`);
  if (!o.control) p.push("control=false");
  return p;
}

export interface VideoMeta {
  deviceName: string;
  codecId: number;
  width: number;
  height: number;
}

export interface VideoPacket {
  config: boolean;
  key: boolean;
  pts: number; // µs
  data: Uint8Array;
}

/** Incremental parser for the video socket (after the dummy byte). */
export class VideoDemuxer {
  private buf = new Uint8Array(0);
  private meta: VideoMeta | null = null;

  private onMeta: (m: VideoMeta) => void;
  private onPacket: (p: VideoPacket) => void;
  private maxPacket: number;

  constructor(onMeta: (m: VideoMeta) => void, onPacket: (p: VideoPacket) => void, maxPacket = 16 * 1024 * 1024) {
    this.onMeta = onMeta;
    this.onPacket = onPacket;
    this.maxPacket = maxPacket;
  }

  push(chunk: Uint8Array): void {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    let off = 0;
    const dv = new DataView(merged.buffer, merged.byteOffset, merged.byteLength);

    if (!this.meta) {
      if (merged.length < DEVICE_NAME_LENGTH + 12) {
        this.buf = merged;
        return;
      }
      const nameBytes = merged.subarray(0, DEVICE_NAME_LENGTH);
      const end = nameBytes.indexOf(0);
      const deviceName = new TextDecoder().decode(nameBytes.subarray(0, end === -1 ? DEVICE_NAME_LENGTH - 1 : end));
      this.meta = {
        deviceName,
        codecId: dv.getUint32(DEVICE_NAME_LENGTH),
        width: dv.getUint32(DEVICE_NAME_LENGTH + 4),
        height: dv.getUint32(DEVICE_NAME_LENGTH + 8),
      };
      off = DEVICE_NAME_LENGTH + 12;
      this.onMeta(this.meta);
    }

    while (merged.length - off >= 12) {
      const ptsFlags = dv.getBigUint64(off);
      const size = dv.getUint32(off + 8);
      if (size > this.maxPacket) throw new Error(`packet too large: ${size}`);
      if (merged.length - off - 12 < size) break;
      const data = merged.slice(off + 12, off + 12 + size);
      this.onPacket({
        config: (ptsFlags & FLAG_CONFIG) !== 0n,
        key: (ptsFlags & FLAG_KEY) !== 0n,
        pts: Number(ptsFlags & PTS_MASK),
        data,
      });
      off += 12 + size;
    }
    this.buf = merged.slice(off);
  }
}

// ---------------------------------------------------------------------------
// Control messages (client → device)
// ---------------------------------------------------------------------------
export const ControlType = {
  INJECT_KEYCODE: 0,
  INJECT_TEXT: 1,
  INJECT_TOUCH_EVENT: 2,
  INJECT_SCROLL_EVENT: 3,
  BACK_OR_SCREEN_ON: 4,
  EXPAND_NOTIFICATION_PANEL: 5,
  SET_DISPLAY_POWER: 10,
  ROTATE_DEVICE: 11,
} as const;

export const MotionAction = { DOWN: 0, UP: 1, MOVE: 2 } as const;
export const KeyAction = { DOWN: 0, UP: 1 } as const;
export const POINTER_ID_MOUSE = 0xffff_ffff_ffff_ffffn;
export const BUTTON_PRIMARY = 1;
export const TEXT_MAX_LENGTH = 300;

export const Keycode = {
  HOME: 3,
  BACK: 4,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
  DEL: 67,
  ENTER: 66,
  TAB: 61,
  ESCAPE: 111,
  FORWARD_DEL: 112,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  APP_SWITCH: 187,
} as const;

const u16fp = (f: number) => Math.min(0xffff, Math.max(0, Math.floor(f * 0x10000)));
const i16fp = (f: number) => {
  const c = Math.max(-1, Math.min(1, f));
  return Math.max(-0x8000, Math.min(0x7fff, Math.trunc(c * 0x8000)));
};

function position(dv: DataView, off: number, x: number, y: number, w: number, h: number) {
  dv.setInt32(off, x);
  dv.setInt32(off + 4, y);
  dv.setUint16(off + 8, w);
  dv.setUint16(off + 10, h);
}

export function touchMessage(action: number, x: number, y: number, w: number, h: number, pressure = action === MotionAction.UP ? 0 : 1): Uint8Array {
  const b = new Uint8Array(32);
  const dv = new DataView(b.buffer);
  dv.setUint8(0, ControlType.INJECT_TOUCH_EVENT);
  dv.setUint8(1, action);
  dv.setBigUint64(2, POINTER_ID_MOUSE);
  position(dv, 10, x, y, w, h);
  dv.setUint16(22, u16fp(pressure));
  dv.setUint32(24, action === MotionAction.MOVE ? 0 : BUTTON_PRIMARY); // action button
  dv.setUint32(28, action === MotionAction.UP ? 0 : BUTTON_PRIMARY); // buttons held
  return b;
}

/** hscroll/vscroll in [-16, 16]. */
export function scrollMessage(x: number, y: number, w: number, h: number, hscroll: number, vscroll: number): Uint8Array {
  const b = new Uint8Array(21);
  const dv = new DataView(b.buffer);
  dv.setUint8(0, ControlType.INJECT_SCROLL_EVENT);
  position(dv, 1, x, y, w, h);
  dv.setInt16(13, i16fp(hscroll / 16));
  dv.setInt16(15, i16fp(vscroll / 16));
  dv.setUint32(17, 0);
  return b;
}

export function keyMessage(action: number, keycode: number, repeat = 0, metastate = 0): Uint8Array {
  const b = new Uint8Array(14);
  const dv = new DataView(b.buffer);
  dv.setUint8(0, ControlType.INJECT_KEYCODE);
  dv.setUint8(1, action);
  dv.setUint32(2, keycode);
  dv.setUint32(6, repeat);
  dv.setUint32(10, metastate);
  return b;
}

export function textMessage(text: string): Uint8Array {
  let bytes = new TextEncoder().encode(text);
  if (bytes.length > TEXT_MAX_LENGTH) bytes = bytes.slice(0, TEXT_MAX_LENGTH);
  const b = new Uint8Array(5 + bytes.length);
  const dv = new DataView(b.buffer);
  dv.setUint8(0, ControlType.INJECT_TEXT);
  dv.setUint32(1, bytes.length);
  b.set(bytes, 5);
  return b;
}

export function backOrScreenOnMessage(action: number): Uint8Array {
  return Uint8Array.of(ControlType.BACK_OR_SCREEN_ON, action);
}

export function displayPowerMessage(on: boolean): Uint8Array {
  return Uint8Array.of(ControlType.SET_DISPLAY_POWER, on ? 1 : 0);
}
