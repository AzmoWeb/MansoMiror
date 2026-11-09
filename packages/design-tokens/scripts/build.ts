import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCss } from "../src/css.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "tokens.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buildCss());
console.log(`wrote ${out}`);
