// Windows firewall rule for the AirPlay receiver.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureFirewallRule, ruleScript, RULE_NAME } from "../../src/main/firewall.ts";

const BIN = "C:\\Users\\Léa Martin\\AppData\\Local\\Programs\\MansoMirror\\resources\\uxplay\\bin\\uxplay.exe";

test("script removes any rule for the receiver (incl. Windows' auto block rules) and allows it on every profile", () => {
  const s = ruleScript(BIN);
  assert.ok(s.includes(`delete rule name=all program="${BIN}"`));
  assert.ok(s.includes(`add rule name="${RULE_NAME}" dir=in action=allow program="${BIN}" enable=yes profile=any`));
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

test("rule already there for this exact binary: no UAC prompt", async () => {
  const calls: string[] = [];
  const r = await ensureFirewallRule(BIN, tmpdir(), {
    platform: "win32",
    run: async (f) => (calls.push(f), { code: 0, out: `Nom de la règle: ${RULE_NAME}\nProgramme: ${BIN.toUpperCase()}\n` }),
  });
  assert.equal(r, "already");
  assert.deepEqual(calls, ["netsh"]);
});

test("missing rule: elevated script is run, then the rule is checked again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mm-fw-"));
  let added = false;
  let scriptEnv: string | undefined;
  const r = await ensureFirewallRule(BIN, dir, {
    platform: "win32",
    run: async (f, args, env) => {
      if (f === "netsh") return added ? { code: 0, out: `Program: ${BIN}` } : { code: 1, out: "No rules match" };
      assert.equal(f, "powershell.exe");
      assert.match(args.join(" "), /-Verb RunAs/);
      scriptEnv = env?.MM_FW_SCRIPT;
      added = true;
      return { code: 0, out: "" };
    },
  });
  assert.equal(r, "added");
  assert.equal(scriptEnv, join(dir, "mansomirror-firewall.cmd"));
  assert.equal(readFileSync(scriptEnv!, "utf8"), ruleScript(BIN));
});

test("user says no to the Windows prompt: reported as refused", async () => {
  const r = await ensureFirewallRule(BIN, mkdtempSync(join(tmpdir(), "mm-fw-")), {
    platform: "win32",
    run: async (f) => (f === "netsh" ? { code: 1, out: "" } : { code: 1223, out: "" }),
  });
  assert.equal(r, "refused");
});

test("a rule for another (old) install path does not count", async () => {
  const r = await ensureFirewallRule(BIN, mkdtempSync(join(tmpdir(), "mm-fw-")), {
    platform: "win32",
    run: async (f) => (f === "netsh" ? { code: 0, out: "Program: D:\\Old\\uxplay.exe" } : { code: 0, out: "" }),
  });
  assert.equal(r, "failed");
});
