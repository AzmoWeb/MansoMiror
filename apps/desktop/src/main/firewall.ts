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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, win32 } from "node:path";

export const RULE_NAME = "MansoMirror AirPlay";

export type FirewallResult = "not-windows" | "already" | "added" | "refused" | "failed";

type Run = (file: string, args: string[], env?: NodeJS.ProcessEnv) => Promise<{ code: number; out: string }>;

const run: Run = (file, args, env) =>
  new Promise((res) => {
    execFile(file, args, { windowsHide: true, env: env ?? process.env, timeout: 120_000 }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : 1) : 0;
      res({ code, out: `${stdout}${stderr}` });
    });
  });

const PS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"];

/** Exit 0 when an enabled allow rule exists for exactly $env:MM_FW_BIN. */
export const CHECK_PS =
  "$ok = Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue | Where-Object { $_.Program -ieq $env:MM_FW_BIN } | " +
  "Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' }; " +
  "$block = Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue | Where-Object { $_.Program -ieq $env:MM_FW_BIN } | " +
  "Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' }; " +
  "if ($ok -and -not $block) { exit 0 } else { exit 1 }";

/** The batch file run elevated: removes any rule for the receiver (including a
 *  "block" rule Windows may have created) and adds one allow rule for it.
 *  Its output goes to <script>.log so a failure can be reported. */
export function ruleScript(bin: string, logFile: string): string {
  const p = bin.replace(/"/g, "");
  const l = logFile.replace(/"/g, "");
  return [
    "@echo off",
    "chcp 65001 >nul",
    `netsh advfirewall firewall delete rule name="${RULE_NAME}" > "${l}" 2>&1`,
    `netsh advfirewall firewall delete rule name=all program="${p}" >> "${l}" 2>&1`,
    `netsh advfirewall firewall add rule name="${RULE_NAME}" dir=in action=allow program="${p}" enable=yes profile=any >> "${l}" 2>&1`,
    "exit /b %errorlevel%",
    "",
  ].join("\r\n");
}

export async function ensureFirewallRule(
  binary: string,
  workDir: string,
  opts: { platform?: NodeJS.Platform; run?: Run; log?: (l: string) => void } = {},
): Promise<FirewallResult> {
  const platform = opts.platform ?? process.platform;
  const exec = opts.run ?? run;
  const log = opts.log ?? (() => {});
  if (platform !== "win32") return "not-windows";
  // Windows stores and compares the program path as written: always use backslashes.
  const bin = win32.normalize(binary);
  const env = { ...process.env, MM_FW_BIN: bin };

  const check = async () => (await exec("powershell.exe", [...PS, CHECK_PS], env)).code === 0;
  if (await check()) return "already";

  const script = join(workDir, "mansomirror-firewall.cmd");
  const logFile = `${script}.log`;
  writeFileSync(script, ruleScript(bin, logFile), "utf8");
  log("firewall: asking Windows for permission (UAC) to allow the AirPlay receiver");
  const r = await exec(
    "powershell.exe",
    [...PS, "try { $p = Start-Process -FilePath $env:MM_FW_SCRIPT -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode } catch { exit 1223 }"],
    { ...env, MM_FW_SCRIPT: script },
  );
  if (r.code === 1223) return "refused";
  if (await check()) return "added";
  const out = existsSync(logFile) ? readFileSync(logFile, "utf8").trim() : "";
  log(`firewall: rule not added (code ${r.code}) ${r.out.trim()} ${out}`);
  return "failed";
}
