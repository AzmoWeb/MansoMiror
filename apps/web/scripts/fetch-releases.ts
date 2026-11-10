/**
 * Build-time step: reads the repository's published desktop releases from the
 * GitHub API and writes src/content/releases.generated.json.
 *
 * Runs in CI (GITHUB_REPOSITORY and GITHUB_TOKEN set). Without them, or on any
 * error, the existing file is kept: the site never invents a download.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UPDATE_FEEDS, latestDesktopRelease, parseSha256Sums, releasesFromGithub, rewriteUpdateFeed, type GithubRelease } from "../src/content/github-releases.ts";
import { isValidRelease } from "../src/content/releases.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "releases.generated.json");
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

async function main() {
  if (!repo) {
    console.log("fetch-releases: GITHUB_REPOSITORY not set, keeping current releases.generated.json");
    return;
  }
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const list = (await res.json()) as GithubRelease[];
  const latest = latestDesktopRelease(list);
  if (!latest) {
    writeFileSync(out, "[]\n");
    console.log("fetch-releases: no published desktop release");
    return;
  }
  const sumsAsset = latest.assets.find((a) => a.name === "SHA256SUMS.txt");
  if (!sumsAsset) throw new Error(`${latest.tag_name} has no SHA256SUMS.txt`);
  const sumsRes = await fetch(sumsAsset.browser_download_url);
  if (!sumsRes.ok) throw new Error(`SHA256SUMS.txt ${sumsRes.status}`);
  const entries = releasesFromGithub(list, parseSha256Sums(await sumsRes.text())).filter(isValidRelease);
  writeFileSync(out, JSON.stringify(entries, null, 2) + "\n");
  console.log(`fetch-releases: ${entries.length} file(s) from ${latest.tag_name}`);

  // Auto-update feeds for the desktop app, served at /updates/.
  const updates = join(dirname(out), "..", "..", "public", "updates");
  mkdirSync(updates, { recursive: true });
  const base = `https://github.com/${repo}/releases/download/${latest.tag_name}`;
  for (const name of UPDATE_FEEDS) {
    const asset = latest.assets.find((a) => a.name === name);
    if (!asset) continue;
    const r = await fetch(asset.browser_download_url);
    if (!r.ok) throw new Error(`${name} ${r.status}`);
    writeFileSync(join(updates, name), rewriteUpdateFeed(await r.text(), base));
    console.log(`fetch-releases: update feed ${name}`);
  }
}

main().catch((e) => {
  // Fail the build rather than publish a site with stale or partial download data.
  console.error("fetch-releases failed:", e.message);
  process.exit(1);
});
