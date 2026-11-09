import { test } from "node:test";
import assert from "node:assert/strict";
import { themes, contrastRatio, buildCss, palette } from "../src/index.ts";

const AA_TEXT = 4.5;
const AA_UI = 3;

test("contrastRatio matches known WCAG values", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF") * 100) / 100, 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
});

for (const [name, t] of Object.entries(themes)) {
  test(`${name}: body and muted text meet WCAG AA on every background`, () => {
    for (const bg of [t.bg, t.bgSubtle, t.surface, t.surfaceRaised]) {
      for (const fg of [t.text, t.textMuted, t.accentText, t.dangerText, t.liveText, t.warningText, t.successText]) {
        const r = contrastRatio(fg, bg);
        assert.ok(r >= AA_TEXT, `${name}: ${fg} on ${bg} = ${r.toFixed(2)} < ${AA_TEXT}`);
      }
    }
  });

  test(`${name}: subtle text and focus ring meet the 3:1 non-text minimum`, () => {
    for (const bg of [t.bg, t.surface]) {
      assert.ok(contrastRatio(t.textSubtle, bg) >= AA_UI, `textSubtle on ${bg}`);
      assert.ok(contrastRatio(t.focusRing, bg) >= AA_UI, `focusRing on ${bg}`);
      assert.ok(contrastRatio(t.live, bg) >= AA_UI, `live indicator on ${bg}`);
    }
  });

  test(`${name}: text on accent buttons is readable`, () => {
    for (const fill of [t.accent, t.accentHover]) {
      const r = contrastRatio(t.onAccent, fill);
      assert.ok(r >= AA_TEXT, `${name}: onAccent on ${fill} = ${r.toFixed(2)}`);
    }
  });
}

test("every palette entry is a valid 6-digit hex", () => {
  for (const scale of Object.values(palette)) {
    for (const v of Object.values(scale)) assert.match(v, /^#[0-9A-F]{6}$/);
  }
});

test("generated CSS covers both themes, forced themes and reduced motion", () => {
  const css = buildCss();
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  for (const key of Object.keys(themes.light)) {
    const varName = `--mm-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:`;
    assert.equal(css.split(varName).length - 1, 3, `${varName} should appear in light, auto-dark and forced-dark`);
  }
});
