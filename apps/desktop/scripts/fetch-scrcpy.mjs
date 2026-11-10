// Downloads the pinned scrcpy 3.3.1 components shipped inside MansoMirror and
// verifies them against hard-coded SHA-256 digests (taken from the official
// release's SHA256SUMS.txt). Output: vendor/scrcpy/ (git-ignored).
//   - scrcpy-server (all platforms): runs on the phone, Apache-2.0
//   - adb + DLLs (Windows only), from the official scrcpy-win64 bundle
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const VERSION = "3.3.1";
const BASE = `https://github.com/Genymobile/scrcpy/releases/download/v${VERSION}`;
const SHA = {
  [`scrcpy-server-v${VERSION}`]: "a0f70b20aa4998fbf658c94118cd6c8dab6abbb0647a3bdab344d70bc1ebcbb8",
  [`scrcpy-win64-v${VERSION}.zip`]: "4fcad494772a3ae5de9a133149f8856d2fc429b41795f7cf7c754e0c1bb6fbc0",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "vendor", "scrcpy");
const withWindowsAdb = process.argv.includes("--win") || process.platform === "win32";

async function download(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const digest = createHash("sha256").update(buf).digest("hex");
  if (digest !== SHA[name]) throw new Error(`${name}: checksum mismatch (${digest})`);
  return buf;
}

mkdirSync(out, { recursive: true });

const serverPath = join(out, "scrcpy-server");
if (!existsSync(serverPath) || createHash("sha256").update(readFileSync(serverPath)).digest("hex") !== SHA[`scrcpy-server-v${VERSION}`]) {
  writeFileSync(serverPath, await download(`scrcpy-server-v${VERSION}`));
  console.log(`scrcpy-server ${VERSION}: OK`);
} else console.log(`scrcpy-server ${VERSION}: already present`);

if (withWindowsAdb && !existsSync(join(out, "adb.exe"))) {
  const zipName = `scrcpy-win64-v${VERSION}.zip`;
  const tmp = join(tmpdir(), `mm-scrcpy-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const zip = join(tmp, zipName);
  writeFileSync(zip, await download(zipName));
  // Windows 10+ ships bsdtar (reads zip); elsewhere use unzip.
  if (process.platform === "win32") execFileSync("tar", ["-xf", zip, "-C", tmp]);
  else execFileSync("unzip", ["-q", "-o", zip, "-d", tmp]);
  const dir = join(tmp, `scrcpy-win64-v${VERSION}`);
  for (const f of ["adb.exe", "AdbWinApi.dll", "AdbWinUsbApi.dll"]) copyFileSync(join(dir, f), join(out, f));
  rmSync(tmp, { recursive: true, force: true });
  console.log("adb (Windows): OK");
}
