// Checks banner.svg, profile.svg and footer.svg before they are committed:
// well-formed, accessible, every #reference resolves, ids are unique, and both stay small.
import { readFile } from "node:fs/promises";
import { optimize } from "svgo";

const ROOT = new URL("../", import.meta.url);
const BUDGET_KB = { "banner.svg": 160, "profile.svg": 460, "footer.svg": 120 };

for (const [name, budget] of Object.entries(BUDGET_KB)) {
  const svg = await readFile(new URL(name, ROOT), "utf8");
  const fail = (message) => {
    throw new Error(`${name}: ${message}`);
  };

  // svgo parses strictly, so a malformed document throws here.
  optimize(svg, { plugins: [] });

  const kb = Buffer.byteLength(svg) / 1024;
  if (kb > budget) fail(`${kb.toFixed(1)} KB is over the ${budget} KB budget`);
  if (!/<title\b/.test(svg) || !/<desc\b/.test(svg) || !/aria-labelledby=/.test(svg) || !/role="img"/.test(svg)) fail("missing title, desc, aria-labelledby or role");

  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(`duplicate ids: ${[...new Set(dupes)].join(", ")}`);

  const known = new Set(ids);
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g), ...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const missing = [...new Set(refs.filter((ref) => !known.has(ref)))];
  if (missing.length) fail(`missing references: ${missing.join(", ")}`);

  if (/href="https?:/.test(svg)) fail("external resources do not load in GitHub's image proxy; embed them instead");

  console.log(`${name}: ok, ${kb.toFixed(1)} KB`);
}
