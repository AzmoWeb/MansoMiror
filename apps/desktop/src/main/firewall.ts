/**
 * Windows Defender Firewall: let the AirPlay receiver (uxplay.exe) be reached
 * from the local network. Without it the iPhone never sees the PC: the mDNS
 * announcement replies (UDP 5353) and the AirPlay connections (TCP 7000/7100)
 * are dropped silently, often without any Windows prompt.
 *
 * Adding a rule needs administrator rights: we ask once through the normal
 * Windows UAC prompt, then the rule stays.
 */
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const RULE_NAME = "MansoMirror AirPlay";

export type FirewallResult = "not-windows" | "already" | "added" | "refused" | "failed";

type Run = (file: string, args: string[], env?: NodeJS.ProcessEnv) => Promise<{ code: number; out: string }>;

const run: Run = (file, args, env) =>
  new Promise((res) => {
    execFile(file, args, { windowsHide: true, env: env ?? process.env, timeout: 120_000 }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === "number" ? ((err as { code: number }).code) : 1) : 0;
      res({ code, out: `${stdout}${stderr}` });
    });
  });

/** The batch file run elevated: removes any rule for the receiver (including a
 *  "block" rule Windows may have created) and adds one allow rule for it. */
export function ruleScript(bin: string): string {
  const p = bin.replace(/"/g, "");
  return [
    "@echo off",
    "chcp 65001 >nul",
    `netsh advfirewall firewall delete rule name="${RULE_NAME}" >nul 2>&1`,
    `netsh advfirewall firewall delete rule name=all program="${p}" >nul 2>&1`,
    `netsh advfirewall firewall add rule name="${RULE_NAME}" dir=in action=allow program="${p}" enable=yes profile=any`,
    "",
  ].join("\r\n");
}

/** True when an allow rule with our name exists for exactly this binary. */
export function ruleMatches(netshOutput: string, bin: string): boolean {
  return netshOutput.toLowerCase().includes(bin.toLowerCase());
}

export async function ensureFirewallRule(
  bin: string,
  workDir: string,
  opts: { platform?: NodeJS.Platform; run?: Run; log?: (l: string) => void } = {},
): Promise<FirewallResult> {
  const platform = opts.platform ?? process.platform;
  const exec = opts.run ?? run;
  const log = opts.log ?? (() => {});
  if (platform !== "win32") return "not-windows";

  const check = async () => {
    const r = await exec("netsh", ["advfirewall", "firewall", "show", "rule", `name=${RULE_NAME}`, "verbose"]);
    return r.code === 0 && ruleMatches(r.out, bin);
  };
  if (await check()) return "already";

  const script = join(workDir, "mansomirror-firewall.cmd");
  writeFileSync(script, ruleScript(bin), "utf8");
  log("firewall: asking Windows for permission (UAC) to allow the AirPlay receiver");
  const r = await exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "try { $p = Start-Process -FilePath $env:MM_FW_SCRIPT -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode } catch { exit 1223 }",
    ],
    { ...process.env, MM_FW_SCRIPT: script },
  );
  if (r.code === 1223) return "refused";
  if (await check()) return "added";
  log(`firewall: rule not added (code ${r.code}) ${r.out.trim()}`);
  return "failed";
}
