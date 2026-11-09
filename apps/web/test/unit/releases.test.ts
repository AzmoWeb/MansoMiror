import { test } from "node:test";
import assert from "node:assert/strict";
import { latestRelease, isValidRelease, formatSize, releases, platforms, type Release } from "../../src/content/releases.ts";

const base: Release = {
  platform: "windows",
  version: "1.0.0",
  publishedAt: "2027-01-10",
  sizeBytes: 42_000_000,
  url: "https://example.org/mm.exe",
  sha256: "a".repeat(64),
};

test("no release is published yet, so every platform shows no download", () => {
  assert.equal(releases.length, 0);
  for (const p of platforms) assert.equal(latestRelease(p.id), null);
});

test("latestRelease picks the highest semver and ignores other platforms", () => {
  const list: Release[] = [
    base,
    { ...base, version: "1.2.0" },
    { ...base, version: "1.10.0" },
    { ...base, version: "2.0.0", platform: "macos" },
  ];
  assert.equal(latestRelease("windows", list)?.version, "1.10.0");
  assert.equal(latestRelease("android", list), null);
});

test("a stable release outranks its pre-release", () => {
  const list = [{ ...base, version: "1.0.0-beta.2" }, base];
  assert.equal(latestRelease("windows", list)?.version, "1.0.0");
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
