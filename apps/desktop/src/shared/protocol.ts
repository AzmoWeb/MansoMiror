/**
 * MansoMirror LAN pairing protocol, version 1.
 *
 *   viewer → host  hello      { name, nonce }
 *   host   → viewer challenge { hostName, salt, nonce }
 *   viewer → host  offer      { sdp, mac = HMAC(K, "mm1|offer|nV|nH|sdp") }
 *   host   → viewer answer    { sdp, mac = HMAC(K, "mm1|answer|nV|nH|sdp") }   (after the user accepts)
 *   either side    recording  { on }
 *   either side    bye        {}
 *   host   → viewer error     { code, remaining? }
 *
 * K = scrypt(PIN, salt). Both SDPs carry the DTLS fingerprints of the WebRTC
 * connection, so MAC-ing them with a PIN-derived key authenticates the media
 * channel end to end: a relay that does not know the PIN cannot substitute its
 * own fingerprints.
 */

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 47800;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_SDP_LENGTH = 32 * 1024;
export const MAX_NAME_LENGTH = 64;

export type ErrorCode =
  | "not-accepting"
  | "busy"
  | "bad-pin"
  | "locked"
  | "expired"
  | "refused"
  | "timeout"
  | "protocol"
  | "version";

export type Message =
  | { t: "hello"; v: number; name: string; nonce: string }
  | { t: "challenge"; v: number; hostName: string; salt: string; nonce: string }
  | { t: "offer"; sdp: string; mac: string }
  | { t: "answer"; sdp: string; mac: string }
  | { t: "recording"; on: boolean }
  | { t: "bye" }
  | { t: "error"; code: ErrorCode; remaining?: number };

const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

/** Strict parser: anything malformed returns null and the connection is dropped. */
export function parseMessage(raw: string): Message | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let m: Record<string, unknown>;
  try {
    const v = JSON.parse(raw);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    m = v;
  } catch {
    return null;
  }
  switch (m.t) {
    case "hello":
      return typeof m.v === "number" && isStr(m.name, MAX_NAME_LENGTH) && typeof m.nonce === "string" && HEX32.test(m.nonce)
        ? { t: "hello", v: m.v, name: cleanName(m.name), nonce: m.nonce }
        : null;
    case "challenge":
      return typeof m.v === "number" &&
        isStr(m.hostName, MAX_NAME_LENGTH) &&
        typeof m.salt === "string" &&
        HEX32.test(m.salt) &&
        typeof m.nonce === "string" &&
        HEX32.test(m.nonce)
        ? { t: "challenge", v: m.v, hostName: cleanName(m.hostName), salt: m.salt, nonce: m.nonce }
        : null;
    case "offer":
    case "answer":
      return isStr(m.sdp, MAX_SDP_LENGTH) && typeof m.mac === "string" && HEX64.test(m.mac)
        ? { t: m.t, sdp: m.sdp, mac: m.mac }
        : null;
    case "recording":
      return typeof m.on === "boolean" ? { t: "recording", on: m.on } : null;
    case "bye":
      return { t: "bye" };
    case "error":
      return typeof m.code === "string"
        ? { t: "error", code: m.code as ErrorCode, remaining: typeof m.remaining === "number" ? m.remaining : undefined }
        : null;
    default:
      return null;
  }
}

/** Device names are shown in consent dialogs: strip control and bidi characters. */
export function cleanName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH) || "Appareil";
}

export const errorText: Record<ErrorCode, string> = {
  "not-accepting": "Cet ordinateur ne partage pas son écran en ce moment.",
  busy: "Cet ordinateur est déjà en session avec un autre appareil.",
  "bad-pin": "Code incorrect.",
  locked: "Trop d'essais. Un nouveau code doit être généré sur l'ordinateur partagé.",
  expired: "Le code a expiré. Demandez-en un nouveau.",
  refused: "La personne a refusé la connexion.",
  timeout: "Pas de réponse à temps.",
  protocol: "Échange invalide. Vérifiez que les deux applications sont à jour.",
  version: "Versions de MansoMirror incompatibles.",
};
