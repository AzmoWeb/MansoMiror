/**
 * Published releases. This list is the ONLY source for the download section.
 * Add an entry only after the file has been built, uploaded to a GitHub
 * release and its SHA-256 checksum taken from that release's SHA256SUMS.txt.
 * An empty platform renders an honest "not yet available" state.
 */

export type PlatformId = "windows" | "macos" | "linux" | "android" | "ios";

export interface Release {
  platform: PlatformId;
  version: string;
  /** Short label of the file format, e.g. "Installeur .exe". */
  format: string;
  /** ISO date, e.g. "2027-03-01". */
  publishedAt: string;
  sizeBytes: number;
  url: string;
  sha256: string;
  /** Beta builds: not code-signed, shown with a warning. */
  prerelease?: boolean;
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  app: string;
  /** Minimum requirements, derived from the capture APIs we rely on. */
  requirements: string;
  /** What the published build can do today on this platform. */
  scope?: string;
}

export const platforms: PlatformInfo[] = [
  { id: "windows", name: "Windows", app: "MansoMirror Desktop", requirements: "Windows 10 ou 11, 64 bits", scope: "Partage d'écran entre ordinateurs" },
  { id: "macos", name: "macOS", app: "MansoMirror Desktop", requirements: "macOS 12 ou plus récent, Intel ou Apple Silicon", scope: "Partage d'écran entre ordinateurs" },
  { id: "linux", name: "Linux", app: "MansoMirror Desktop", requirements: "64 bits, session X11 (Wayland : à l'étude)", scope: "Partage d'écran entre ordinateurs" },
  { id: "android", name: "Android", app: "MansoMirror Mobile", requirements: "Android 10 ou plus récent" },
  { id: "ios", name: "iOS / iPadOS", app: "MansoMirror Mobile", requirements: "iOS / iPadOS 15 ou plus récent" },
];

export const releases: Release[] = [];

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function isValidRelease(r: Release): boolean {
  return (
    SEMVER.test(r.version) &&
    r.format.length > 0 &&
    !Number.isNaN(Date.parse(r.publishedAt)) &&
    Number.isInteger(r.sizeBytes) &&
    r.sizeBytes > 0 &&
    /^https:\/\//.test(r.url) &&
    /^[0-9a-f]{64}$/.test(r.sha256)
  );
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split("-")[0].split(".").map(Number);
  const pb = b.split("-")[0].split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  const preA = a.includes("-") ? a.slice(a.indexOf("-") + 1) : null;
  const preB = b.includes("-") ? b.slice(b.indexOf("-") + 1) : null;
  if (preA === preB) return 0;
  if (preA === null) return 1; // stable outranks its pre-releases
  if (preB === null) return -1;
  return preA.localeCompare(preB, "en", { numeric: true });
}

/** Latest valid release for a platform, or null when nothing has been published. */
export function latestRelease(platform: PlatformId, list: Release[] = releases): Release | null {
  return latestFiles(platform, list)[0] ?? null;
}

/** All files (formats) of the latest valid version for a platform. */
export function latestFiles(platform: PlatformId, list: Release[] = releases): Release[] {
  const candidates = list.filter((r) => r.platform === platform && isValidRelease(r));
  if (candidates.length === 0) return [];
  const top = candidates.reduce((best, r) => (compareSemver(r.version, best.version) > 0 ? r : best)).version;
  return candidates.filter((r) => r.version === top);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
