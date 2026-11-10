/**
 * Release check (run on the Windows build machine): starts the bundled AirPlay
 * receiver with the app's own code (AirPlayReceiver, same arguments and
 * environment as the installed app) and fails unless it keeps running in
 * in-app mode with its local video port open.
 *   node scripts/check-airplay.ts <path to uxplay(.exe)>
 */
import { connect } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AirPlayReceiver, type AirPlayState } from "../src/main/airplay.ts";

const bin = process.argv[2];
if (!bin) throw new Error("usage: check-airplay.ts <uxplay binary>");

const r = new AirPlayReceiver(bin, mkdtempSync(join(tmpdir(), "mm-gst-")));
const log: string[] = [];
r.on("log", (l) => log.push(l));
let last: AirPlayState = r.current;
r.on("state", (s) => (last = s));

const started = await r.start("CI");
console.log("start →", JSON.stringify(started));
await new Promise((res) => setTimeout(res, 10_000));
console.log("after 10 s →", JSON.stringify(last));
console.log("--- receiver output ---\n" + log.join("\n"));

let ok = last.status === "running" && last.inApp === true;
if (ok && last.status === "running") {
  ok = await new Promise<boolean>((res) => {
    const s = connect((last as { videoPort: number }).videoPort, "127.0.0.1", () => {
      s.destroy();
      res(true);
    });
    s.on("error", () => res(false));
  });
  console.log("video port reachable:", ok);
}
await r.stop();
if (!ok) {
  console.error("AirPlay receiver check FAILED");
  process.exit(1);
}
console.log("AirPlay receiver check OK");
