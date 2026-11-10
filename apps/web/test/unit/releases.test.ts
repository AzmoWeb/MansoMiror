import { test } from "node:test";
import assert from "node:assert/strict";
import { latestRelease, latestFiles, isValidRelease, formatSize, compareSemver, releases, platforms, type Release } from "../../src/content/releases.ts";

const base: Release = {
  platform: "windows",
  version: "1.0.0",
  format: "Installeur .exe",
  publishedAt: "2027-01-10",
  sizeBytes: 42_000_000,
  url: "https://example.org/mm.exe",
  sha256: "a".repeat(64),
};

test("every published entry is valid (https URL, real checksum, size)", () => {
  for (const r of releases) assert.ok(isValidRelease(r), `${r.platform} ${r.format}`);
});

test("downloads are for computers only (nothing to install on the phone)", () => {
  assert.deepEqual(platforms.map((p) => p.id), ["windows", "macos", "linux"]);
});

test("latestRelease picks the highest semver and ignores other platforms", () => {
  const list: Release[] = [base, { ...base, version: "1.2.0" }, { ...base, version: "1.10.0" }, { ...base, version: "2.0.0", platform: "macos" }];
  assert.equal(latestRelease("windows", list)?.version, "1.10.0");
  assert.equal(latestRelease("android", list), null);
});

test("pre-releases order correctly and rank below the stable version", () => {
  assert.ok(compareSemver("1.0.0-beta.2", "1.0.0-beta.10") < 0);
  assert.ok(compareSemver("1.0.0", "1.0.0-beta.10") > 0);
  assert.equal(latestRelease("windows", [{ ...base, version: "1.0.0-beta.2" }, base])?.version, "1.0.0");
});

test("latestFiles returns every format of the newest version only", () => {
  const list: Release[] = [
    { ...base, platform: "linux", version: "0.1.0", format: "AppImage" },
    { ...base, platform: "linux", version: "0.2.0", format: "AppImage" },
    { ...base, platform: "linux", version: "0.2.0", format: ".deb" },
  ];
  assert.deepEqual(latestFiles("linux", list).map((f) => f.format), ["AppImage", ".deb"]);
});

test("invalid entries are never offered for download", () => {
  assert.equal(isValidRelease({ ...base, url: "http://insecure/mm.exe" }), false);
  assert.equal(isValidRelease({ ...base, sha256: "123" }), false);
  assert.equal(isValidRelease({ ...base, sizeBytes: 0 }), false);
  assert.equal(isValidRelease({ ...base, version: "v1" }), false);
  assert.equal(latestRelease("windows", [{ ...base, sha256: "" }]), null);
});

test("formatSize uses French units", () => {
  assert.equal(formatSize(512 * 1024), "512 Ko");
  assert.equal(formatSize(42 * 1024 * 1024), "42,0 Mo");
});
