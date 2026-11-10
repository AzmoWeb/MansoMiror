// Windows firewall rule for the AirPlay receiver.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureFirewallRule, ruleScript, RULE_NAME } from "../../src/main/firewall.ts";

const BIN = "C:\\Users\\Léa Martin\\AppData\\Local\\Programs\\MansoMirror\\resources\\uxplay\\bin\\uxplay.exe";

test("script removes any rule for the receiver (incl. Windows' auto block rules), allows it on every profile, logs netsh output", () => {
  const s = ruleScript(BIN, "C:\\t\\fw.log");
  assert.ok(s.includes(`delete rule name=all program="${BIN}"`));
  assert.ok(s.includes(`add rule name="${RULE_NAME}" dir=in action=allow program="${BIN}" enable=yes profile=any >> "C:\\t\\fw.log" 2>&1`));
  assert.ok(s.indexOf("delete rule name=all") < s.indexOf("add rule"));
  assert.ok(s.includes("chcp 65001"), "UTF-8 so accented user folders work");
  assert.ok(s.includes("\r\n"));
});

test("not Windows: nothing is done", async () => {
  let called = false;
  const r = await ensureFirewallRule(BIN, tmpdir(), { platform: "linux", run: async () => ((called = true), { code: 0, out: "" }) });
  assert.equal(r, "not-windows");
  assert.equal(called, false);
});

test("rule already there: no UAC prompt; the path is normalised to backslashes", async () => {
  const calls: (string | undefined)[] = [];
  const r = await ensureFirewallRule("C:/Users/x/uxplay/bin/uxplay.exe", tmpdir(), {
    platform: "win32",
    run: async (f, _a, env) => (calls.push(env?.MM_FW_BIN), { code: 0, out: "" }),
  });
  assert.equal(r, "already");
  assert.deepEqual(calls, ["C:\\Users\\x\\uxplay\\bin\\uxplay.exe"]);
});

test("missing rule: elevated script is run, then the rule is checked again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mm-fw-"));
  let added = false;
  let scriptEnv: string | undefined;
  const r = await ensureFirewallRule(BIN, dir, {
    platform: "win32",
    run: async (_f, args, env) => {
      const cmd = args.at(-1)!;
      if (!cmd.includes("RunAs")) return { code: added ? 0 : 1, out: "" };
      scriptEnv = env?.MM_FW_SCRIPT;
      added = true;
      return { code: 0, out: "" };
    },
  });
  assert.equal(r, "added");
  assert.equal(scriptEnv, join(dir, "mansomirror-firewall.cmd"));
  assert.equal(readFileSync(scriptEnv!, "utf8"), ruleScript(BIN, `${scriptEnv}.log`));
});

test("user says no to the Windows prompt: reported as refused", async () => {
  const r = await ensureFirewallRule(BIN, mkdtempSync(join(tmpdir(), "mm-fw-")), {
    platform: "win32",
    run: async (_f, args) => (args.at(-1)!.includes("RunAs") ? { code: 1223, out: "" } : { code: 1, out: "" }),
  });
  assert.equal(r, "refused");
});

test("rule still missing after the script: failed, with the netsh output in the log", async () => {
  const logs: string[] = [];
  const r = await ensureFirewallRule(BIN, mkdtempSync(join(tmpdir(), "mm-fw-")), {
    platform: "win32",
    run: async () => ({ code: 1, out: "" }),
    log: (l) => logs.push(l),
  });
  assert.equal(r, "failed");
  assert.match(logs.at(-1)!, /rule not added/);
});
