/**
 * Published releases. This list is the ONLY source for the download section.
 * Add an entry only after the binary is built, signed, uploaded and its
 * checksum verified. An empty list renders an honest "not yet available" state.
 */

export type PlatformId = "windows" | "macos" | "android" | "ios";

export interface Release {
  platform: PlatformId;
  version: string;
  /** ISO date, e.g. "2027-03-01". */
  publishedAt: string;
  sizeBytes: number;
  url: string;
  sha256: string;
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  app: string;
  /** Planned minimum requirements, derived from the capture APIs we rely on. */
  requirements: string;
}

export const platforms: PlatformInfo[] = [
  { id: "windows", name: "Windows", app: "MansoMirror Desktop", requirements: "Windows 10 (1903) ou plus récent, 64 bits" },
  { id: "macos", name: "macOS", app: "MansoMirror Desktop", requirements: "macOS 12.3 ou plus récent (ScreenCaptureKit)" },
  { id: "android", name: "Android", app: "MansoMirror Mobile", requirements: "Android 10 ou plus récent" },
  { id: "ios", name: "iOS / iPadOS", app: "MansoMirror Mobile", requirements: "iOS / iPadOS 15 ou plus récent" },
];

export const releases: Release[] = [];

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function isValidRelease(r: Release): boolean {
  return (
    SEMVER.test(r.version) &&
    !Number.isNaN(Date.parse(r.publishedAt)) &&
    Number.isInteger(r.sizeBytes) &&
    r.sizeBytes > 0 &&
    /^https:\/\//.test(r.url) &&
    /^[0-9a-f]{64}$/.test(r.sha256)
  );
}

function compareSemver(a: string, b: string): number {
  const pa = a.split("-")[0].split(".").map(Number);
  const pb = b.split("-")[0].split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  // A release without pre-release tag ranks above one with it.
  return (a.includes("-") ? 0 : 1) - (b.includes("-") ? 0 : 1);
}

/** Latest valid release for a platform, or null when nothing has been published. */
export function latestRelease(platform: PlatformId, list: Release[] = releases): Release | null {
  const candidates = list.filter((r) => r.platform === platform && isValidRelease(r));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, r) => (compareSemver(r.version, best.version) > 0 ? r : best));
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
