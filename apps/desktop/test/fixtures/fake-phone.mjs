// A stand-in for scrcpy-server running on a phone: speaks the scrcpy 3.3.1
// socket protocol on a local TCP port and streams a real H.264 clip.
// Used by tests only; control messages it receives are recorded.
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Split an Annex-B stream into NAL units. */
function nals(buf) {
  const out = [];
  let i = 0;
  let start = -1;
  while (i + 3 <= buf.length) {
    const sc3 = buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1;
    const sc4 = i + 4 <= buf.length && buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 0 && buf[i + 3] === 1;
    if (sc3 || sc4) {
      if (start >= 0) out.push(buf.subarray(start, i));
      i += sc4 ? 4 : 3;
      start = i;
    } else i++;
  }
  if (start >= 0) out.push(buf.subarray(start));
  return out;
}

const SC = Buffer.from([0, 0, 0, 1]);

/** Group NALs into access units (split on AUD), like MediaCodec output. */
export function accessUnits(file = join(here, "phone-360x640.h264")) {
  const units = [];
  let cur = [];
  for (const n of nals(readFileSync(file))) {
    const type = n[0] & 0x1f;
    if (type === 9) {
      if (cur.length) units.push(cur);
      cur = [];
    } else cur.push(n);
  }
  if (cur.length) units.push(cur);
  const packets = [];
  for (const au of units) {
    const cfg = au.filter((n) => [7, 8].includes(n[0] & 0x1f));
    const rest = au.filter((n) => ![7, 8, 6].includes(n[0] & 0x1f));
    if (cfg.length) packets.push({ config: true, key: false, data: Buffer.concat(cfg.flatMap((n) => [SC, n])) });
    if (rest.length) packets.push({ config: false, key: rest.some((n) => (n[0] & 0x1f) === 5), data: Buffer.concat(rest.flatMap((n) => [SC, n])) });
  }
  return packets;
}

function frame(p, pts) {
  const h = Buffer.alloc(12);
  let v = BigInt(pts);
  if (p.config) v |= 1n << 63n;
  if (p.key) v |= 1n << 62n;
  h.writeBigUInt64BE(v, 0);
  h.writeUInt32BE(p.data.length, 8);
  return Buffer.concat([h, p.data]);
}

/** Start the fake phone. Resolves with { port, control: Buffer[], close() }. */
export function startFakePhone({ name = "Téléphone de test", width = 360, height = 640, fps = 30 } = {}) {
  const packets = accessUnits();
  const control = [];
  const sockets = [];
  let timer = null;
  let i = 0;
  const server = createServer((sock) => {
    sockets.push(sock);
    sock.on("error", () => {});
    if (sockets.length === 1) {
      sock.write(Buffer.from([0])); // "ready" dummy byte
    } else if (sockets.length === 2) {
      sock.on("data", (d) => {
        control.push(Buffer.from(d));
        // RESET_VIDEO (type 17): like scrcpy-server, restart from parameters + a key frame.
        if (d.includes(17)) i = 0;
      });
      const video = sockets[0];
      const head = Buffer.alloc(76);
      head.write(name, 0, "utf8");
      head.writeUInt32BE(0x68323634, 64);
      head.writeUInt32BE(width, 68);
      head.writeUInt32BE(height, 72);
      video.write(head);
      i = 0;
      let pts = 0;
      timer = setInterval(() => {
        // Loop the clip; restart from the first config packet.
        const p = packets[i % packets.length];
        video.write(frame(p, pts));
        if (!p.config) pts += Math.round(1e6 / fps);
        i++;
        if (packets[i % packets.length].config === false && i % packets.length === 0) i = 0;
      }, 1000 / fps);
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: server.address().port,
        control,
        close: () =>
          new Promise((r) => {
            clearInterval(timer);
            for (const s of sockets) s.destroy();
            server.close(() => r());
          }),
      }),
    ),
  );
}
