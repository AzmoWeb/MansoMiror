// AirPlay receiver: argument building, binary lookup, and — when UxPlay and an
// mDNS responder are available — a real check that the receiver is announced
// on the network the way an iPhone discovers it (_airplay._tcp).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Bonjour, type Service } from "bonjour-service";
import { AirPlayReceiver, airplayArgs, findUxPlay } from "../../src/main/airplay.ts";

test("arguments: exact name, mandatory 4-digit code, stale session reset", () => {
  const a = airplayArgs("PC-Salon · MansoMirror", "0427");
  assert.deepEqual(a.slice(0, 3), ["-n", "PC-Salon · MansoMirror", "-nh"]);
  assert.equal(a[a.indexOf("-pin") + 1], "0427");
  assert.ok(a.includes("-reset"));
});

test("findUxPlay: explicit path wins, otherwise searched on PATH, null when absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "mm-uxplay-"));
  const bin = join(dir, process.platform === "win32" ? "uxplay.exe" : "uxplay");
  writeFileSync(bin, "#!/bin/sh\n");
  chmodSync(bin, 0o755);
  assert.equal(findUxPlay({ MM_UXPLAY_PATH: bin, PATH: "" }), bin);
  assert.equal(findUxPlay({ PATH: dir }), bin);
  assert.equal(findUxPlay({ PATH: join(dir, "nothing-here") }), null);
});

test("without UxPlay the receiver reports itself unavailable and start() is a no-op", () => {
  const r = new AirPlayReceiver(null);
  assert.deepEqual(r.current, { status: "unavailable", reason: "not-installed" });
  assert.deepEqual(r.start("PC"), { status: "unavailable", reason: "not-installed" });
});

const uxplay = findUxPlay();

test("real UxPlay: announced as an AirPlay receiver under our name, then stopped", { skip: !uxplay && "UxPlay not installed", timeout: 30_000 }, async () => {
  const r = new AirPlayReceiver(uxplay);
  const logs: string[] = [];
  r.on("log", (l) => logs.push(l));
  const name = `Test-${process.pid}`;
  const st = r.start(name);
  assert.equal(st.status, "running");
  assert.match((st as { pin: string }).pin, /^\d{4}$/);

  const bonjour = new Bonjour();
  try {
    const found = await new Promise<Service | null>((resolve) => {
      const browser = bonjour.find({ type: "airplay" });
      const t = setTimeout(() => resolve(null), 15_000);
      browser.on("up", (s: Service) => {
        if (s.name.startsWith(name)) {
          clearTimeout(t);
          resolve(s);
        }
      });
    });
    assert.ok(found, `receiver not announced on mDNS. UxPlay said:\n${logs.join("\n")}`);
    assert.equal(found.name, `${name} · MansoMirror`);
    // iOS uses these TXT records to list the device as a screen-mirroring target.
    assert.ok(found.txt && typeof found.txt === "object");
  } finally {
    bonjour.destroy();
    await r.stop();
  }
  assert.equal(r.current.status, "stopped");
});
