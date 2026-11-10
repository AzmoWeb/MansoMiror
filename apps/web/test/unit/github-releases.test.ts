import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSha256Sums, releasesFromGithub, rewriteUpdateFeed, type GithubRelease } from "../../src/content/github-releases.ts";
import { isValidRelease, latestFiles } from "../../src/content/releases.ts";

const H = (c: string) => c.repeat(64);
const dl = (n: string) => `https://github.com/AzmoWeb/MansoMiror/releases/download/desktop-v0.1.0-beta.1/${n}`;

const beta: GithubRelease = {
  tag_name: "desktop-v0.1.0-beta.1",
  draft: false,
  prerelease: true,
  published_at: "2026-11-10T09:00:00Z",
  assets: [
    { name: "MansoMirror-Setup-0.1.0-x64.exe", size: 120_000_000, browser_download_url: dl("MansoMirror-Setup-0.1.0-x64.exe") },
    { name: "MansoMirror-0.1.0-mac-arm64.dmg", size: 118_000_000, browser_download_url: dl("MansoMirror-0.1.0-mac-arm64.dmg") },
    { name: "MansoMirror-0.1.0-mac-x64.dmg", size: 125_000_000, browser_download_url: dl("MansoMirror-0.1.0-mac-x64.dmg") },
    { name: "MansoMirror-0.1.0-linux-x86_64.AppImage", size: 126_000_000, browser_download_url: dl("MansoMirror-0.1.0-linux-x86_64.AppImage") },
    { name: "MansoMirror-0.1.0-linux-amd64.deb", size: 101_000_000, browser_download_url: dl("MansoMirror-0.1.0-linux-amd64.deb") },
    { name: "SHA256SUMS.txt", size: 500, browser_download_url: dl("SHA256SUMS.txt") },
    { name: "latest.yml", size: 300, browser_download_url: dl("latest.yml") },
  ],
};

const sums = parseSha256Sums(
  [
    `${H("a")}  MansoMirror-Setup-0.1.0-x64.exe`,
    `${H("b")}  MansoMirror-0.1.0-mac-arm64.dmg`,
    `${H("c")}  MansoMirror-0.1.0-mac-x64.dmg`,
    `${H("d")}  MansoMirror-0.1.0-linux-x86_64.AppImage`,
    `${H("e")} *MansoMirror-0.1.0-linux-amd64.deb`,
    "garbage line",
  ].join("\n"),
);

test("parses sha256sum output, text and binary modes", () => {
  assert.equal(sums.size, 5);
  assert.equal(sums.get("MansoMirror-0.1.0-linux-amd64.deb"), H("e"));
});

test("maps every installer to its platform, with version, size and checksum", () => {
  const r = releasesFromGithub([beta], sums);
  assert.deepEqual(
    r.map((x) => [x.platform, x.format]),
    [
      ["windows", "Installeur .exe"],
      ["macos", "Apple Silicon (.dmg)"],
      ["macos", "Intel (.dmg)"],
      ["linux", "AppImage"],
      ["linux", "Paquet .deb"],
    ],
  );
  for (const x of r) {
    assert.ok(isValidRelease(x));
    assert.equal(x.version, "0.1.0-beta.1");
    assert.equal(x.publishedAt, "2026-11-10");
    assert.equal(x.prerelease, true);
  }
  assert.equal(latestFiles("linux", r).length, 2);
});

test("a file without a published checksum is never listed", () => {
  const partial = new Map(sums);
  partial.delete("MansoMirror-Setup-0.1.0-x64.exe");
  assert.equal(releasesFromGithub([beta], partial).some((x) => x.platform === "windows"), false);
});

test("drafts, unpublished and non-desktop releases are ignored", () => {
  assert.deepEqual(releasesFromGithub([{ ...beta, draft: true }], sums), []);
  assert.deepEqual(releasesFromGithub([{ ...beta, published_at: null }], sums), []);
  assert.deepEqual(releasesFromGithub([{ ...beta, tag_name: "mobile-v1.0.0" }], sums), []);
  assert.deepEqual(releasesFromGithub([], sums), []);
});

test("only the most recently published desktop release is used", () => {
  const older = { ...beta, tag_name: "desktop-v0.0.9", published_at: "2026-10-01T00:00:00Z" };
  const r = releasesFromGithub([older, beta], sums);
  assert.ok(r.every((x) => x.version === "0.1.0-beta.1"));
});

test("update feed: file names become absolute GitHub download URLs; hashes untouched", () => {
  const feed = `version: 0.3.0
files:
  - url: MansoMirror-Setup-0.3.0-x64.exe
    sha512: abc+/==
    size: 120
path: MansoMirror-Setup-0.3.0-x64.exe
sha512: abc+/==
releaseDate: '2026-11-10T12:17:41.271Z'
`;
  const base = "https://github.com/AzmoWeb/MansoMiror/releases/download/desktop-v0.3.0/";
  const out = rewriteUpdateFeed(feed, base);
  assert.match(out, /^  - url: https:\/\/github\.com\/AzmoWeb\/MansoMiror\/releases\/download\/desktop-v0\.3\.0\/MansoMirror-Setup-0\.3\.0-x64\.exe$/m);
  assert.match(out, /^path: https:\/\/github\.com\/.+\/MansoMirror-Setup-0\.3\.0-x64\.exe$/m);
  assert.match(out, /^sha512: abc\+\/==$/m);
  assert.match(out, /^releaseDate: '2026-11-10T12:17:41.271Z'$/m);
  assert.equal(rewriteUpdateFeed(out, base), out, "idempotent: absolute URLs are left alone");
  assert.throws(() => rewriteUpdateFeed(feed, "http://insecure/"));
});
