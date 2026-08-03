import { readdir, readFile } from "node:fs/promises";
import { optimizeSvg } from "./svg-optimizer.mjs";

const root = new URL("../", import.meta.url);
const files = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
  .map((entry) => entry.name)
  .sort();

function nestedSvgDocuments(source) {
  const documents = [source];
  const pattern = /href="data:image\/svg\+xml;base64,([^"]+)"/g;

  for (const match of source.matchAll(pattern)) {
    documents.push(Buffer.from(match[1], "base64").toString("utf8"));
  }

  return documents;
}

function validateReferences(source, name) {
  const ids = new Set([...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const references = [
    ...source.matchAll(/url\(#([^)]+)\)/g),
    ...source.matchAll(/(?:href|xlink:href)="#([^"]+)"/g),
  ].map((match) => match[1]);

  const missing = [...new Set(references.filter((reference) => !ids.has(reference)))];
  if (missing.length) {
    throw new Error(`${name}: missing references: ${missing.join(", ")}`);
  }
}

for (const name of files) {
  const source = await readFile(new URL(name, root), "utf8");
  const documents = nestedSvgDocuments(source);

  for (const [index, document] of documents.entries()) {
    optimizeSvg(document);
    validateReferences(document, `${name}${index ? ` embedded-${index}` : ""}`);
  }

  if (!/<title\b/.test(source) || !/<desc\b/.test(source) || !/aria-labelledby=/.test(source)) {
    throw new Error(`${name}: accessibility metadata is incomplete`);
  }
}

const bio = await readFile(new URL("bio-code.svg", root), "utf8");
if (!bio.includes('xml:space="preserve"') || (bio.match(/<animate\b/g) ?? []).length !== 16) {
  throw new Error("bio-code.svg: animation or preserved text spacing was changed");
}

console.log(`Validated ${files.length} SVG files and their embedded SVG documents`);
