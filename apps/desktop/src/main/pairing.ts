import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

export const PIN_TTL_MS = 120_000;
export const PIN_MAX_ATTEMPTS = 5;

/**
 * scrypt cost. ~50–100 ms per guess makes an offline search of the 10^6 PIN
 * space take hours, far longer than the 2-minute, single-use PIN lifetime.
 */
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export function deriveKey(pin: string, saltHex: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, Buffer.from(saltHex, "hex"), 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export function sdpMac(key: Buffer, kind: "offer" | "answer", nonceViewer: string, nonceHost: string, sdp: string): string {
  return createHmac("sha256", key).update(`mm1|${kind}|${nonceViewer}|${nonceHost}|${sdp}`).digest("hex");
}

export function macEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === 32 && bb.length === 32 && timingSafeEqual(ba, bb);
}

export type PinCheck = { ok: true } | { ok: false; reason: "none" | "expired" | "locked" | "bad-pin"; remaining?: number };

/**
 * One active PIN at a time: expires after PIN_TTL_MS, locks after
 * PIN_MAX_ATTEMPTS wrong guesses, and is consumed by the first success.
 */
export class PinManager {
  private pin: string | null = null;
  private expiresAt = 0;
  private attempts = 0;
  /** Fresh salt per PIN, so keys derived for an old PIN are useless. */
  salt = randomHex();

  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  issue(): { pin: string; expiresAt: number } {
    this.pin = generatePin();
    this.salt = randomHex();
    this.expiresAt = this.now() + PIN_TTL_MS;
    this.attempts = 0;
    return { pin: this.pin, expiresAt: this.expiresAt };
  }

  /** Returns the active PIN (for key derivation) or the reason there is none. */
  active(): { pin: string } | { reason: "none" | "expired" | "locked" } {
    if (this.pin === null) return { reason: this.attempts >= PIN_MAX_ATTEMPTS ? "locked" : "none" };
    if (this.now() > this.expiresAt) {
      this.pin = null;
      return { reason: "expired" };
    }
    return { pin: this.pin };
  }

  /** Record the outcome of a MAC check done with the active PIN's key. */
  record(success: boolean): PinCheck {
    if (this.pin === null) return { ok: false, reason: "none" };
    if (success) {
      this.pin = null; // single use
      return { ok: true };
    }
    this.attempts += 1;
    if (this.attempts >= PIN_MAX_ATTEMPTS) {
      this.pin = null;
      return { ok: false, reason: "locked", remaining: 0 };
    }
    return { ok: false, reason: "bad-pin", remaining: PIN_MAX_ATTEMPTS - this.attempts };
  }

  revoke(): void {
    this.pin = null;
  }
}
