import type { PlatformId, Release } from "./releases.ts";

/** Minimal shape of the GitHub REST "release" object we rely on. */
export interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: { name: string; size: number; browser_download_url: string }[];
}

export const DESKTOP_TAG = /^desktop-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

/** File name → platform and label. Anything unknown is ignored. */
const FORMATS: { test: RegExp; platform: PlatformId; format: string }[] = [
  { test: /\.exe$/i, platform: "windows", format: "Installeur .exe" },
  { test: /-arm64\.dmg$/i, platform: "macos", format: "Apple Silicon (.dmg)" },
  { test: /-x64\.dmg$/i, platform: "macos", format: "Intel (.dmg)" },
  { test: /\.AppImage$/i, platform: "linux", format: "AppImage" },
  { test: /\.deb$/i, platform: "linux", format: "Paquet .deb" },
];

/** Parse a `sha256sum` output ("<hex>  <file>" per line). */
export function parseSha256Sums(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim());
    if (m) out.set(m[2].trim(), m[1]);
  }
  return out;
}

/**
 * Turn the newest published desktop release into download entries.
 * A file is only listed if the release also published its checksum.
 */
export function releasesFromGithub(list: GithubRelease[], sums: Map<string, string>): Release[] {
  const desktop = list.filter((r) => !r.draft && r.published_at && DESKTOP_TAG.test(r.tag_name));
  if (desktop.length === 0) return [];
  const latest = desktop.reduce((a, b) => (Date.parse(b.published_at!) > Date.parse(a.published_at!) ? b : a));
  const version = DESKTOP_TAG.exec(latest.tag_name)![1];
  const out: Release[] = [];
  for (const asset of latest.assets) {
    const f = FORMATS.find((x) => x.test.test(asset.name));
    const sha256 = sums.get(asset.name);
    if (!f || !sha256) continue;
    out.push({
      platform: f.platform,
      version,
      format: f.format,
      publishedAt: latest.published_at!.slice(0, 10),
      sizeBytes: asset.size,
      url: asset.browser_download_url,
      sha256,
      prerelease: latest.prerelease,
    });
  }
  return out;
}

export function latestDesktopRelease(list: GithubRelease[]): GithubRelease | null {
  const desktop = list.filter((r) => !r.draft && r.published_at && DESKTOP_TAG.test(r.tag_name));
  if (desktop.length === 0) return null;
  return desktop.reduce((a, b) => (Date.parse(b.published_at!) > Date.parse(a.published_at!) ? b : a));
}
