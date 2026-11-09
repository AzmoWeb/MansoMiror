// Bundles main, preload and renderer into dist/ with esbuild.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
const prod = process.env.NODE_ENV !== "development";

// The renderer imports the generated design-token CSS: build it first.
execFileSync(process.execPath, [join(root, "..", "..", "packages", "design-tokens", "scripts", "build.ts")], { stdio: "inherit" });
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "renderer"), { recursive: true });

const common = { bundle: true, sourcemap: !prod, minify: prod, logLevel: "warning", legalComments: "none" };

await Promise.all([
  build({ ...common, entryPoints: [join(root, "src/main/main.ts")], outfile: join(out, "main.js"), platform: "node", format: "cjs", target: "node22", external: ["electron"] }),
  build({ ...common, entryPoints: [join(root, "src/preload/preload.ts")], outfile: join(out, "preload.js"), platform: "node", format: "cjs", target: "node22", external: ["electron"] }),
  build({
    ...common,
    entryPoints: [join(root, "src/renderer/main.tsx")],
    outfile: join(out, "renderer", "renderer.js"),
    platform: "browser",
    format: "iife",
    target: "chrome130",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development") },
  }),
]);
cpSync(join(root, "src/renderer/index.html"), join(out, "renderer", "index.html"));
console.log("built", out);
