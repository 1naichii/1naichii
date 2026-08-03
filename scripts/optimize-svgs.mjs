import { readdir, readFile, writeFile } from "node:fs/promises";
import { optimizeSvg } from "./svg-optimizer.mjs";

const root = new URL("../", import.meta.url);
const files = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
  .map((entry) => entry.name)
  .sort();

let changed = 0;

for (const name of files) {
  const file = new URL(name, root);
  const source = await readFile(file, "utf8");
  const optimized = optimizeSvg(source);

  if (optimized === source) {
    console.log(`${name}: unchanged (${Buffer.byteLength(source)} bytes)`);
    continue;
  }

  await writeFile(file, optimized, "utf8");
  changed += 1;
  console.log(`${name}: ${Buffer.byteLength(source)} -> ${Buffer.byteLength(optimized)} bytes`);
}

console.log(`Optimized ${changed} of ${files.length} SVG files`);
