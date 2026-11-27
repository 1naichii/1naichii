// Makes the static font sources in assets/fonts from Google Fonts' variable fonts
// (SIL OFL 1.1, no Reserved Font Names): each weight pinned and cut to Latin, as WOFF2.
// build.mjs then embeds only the glyphs each SVG uses.
//
// Download into one folder, from https://github.com/google/fonts/tree/main/ofl:
//   cinzel/Cinzel[wght].ttf                    -> Cinzel.ttf
//   ebgaramond/EBGaramond[wght].ttf            -> EBGaramond.ttf
//   ebgaramond/EBGaramond-Italic[wght].ttf     -> EBGaramond-Italic.ttf
// and keep each family's OFL.txt as assets/fonts/OFL-<Family>.txt.
//
// Usage: node scripts/prepare-fonts.mjs <folder>
import { readFile, writeFile } from "node:fs/promises";
import fontverter from "fontverter";
import subsetFont from "subset-font";

const source = process.argv[2];
if (!source) throw new Error("usage: node scripts/prepare-fonts.mjs <folder with the variable fonts>");

const ranges = [[0x20, 0x7e], [0xa0, 0xff], [0x2010, 0x2027], [0x2030, 0x203a], [0x2190, 0x2193], [0x2122, 0x2122], [0x2605, 0x2606]];
const latin = ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i))).join("");

const jobs = [
  ["Cinzel.ttf", "Cinzel-SemiBold", 600],
  ["Cinzel.ttf", "Cinzel-Bold", 700],
  ["EBGaramond.ttf", "EBGaramond-Regular", 400],
  ["EBGaramond-Italic.ttf", "EBGaramond-Italic", 400],
];
for (const [from, name, wght] of jobs) {
  const ttf = await subsetFont(await readFile(`${source}/${from}`), latin, { targetFormat: "truetype", variationAxes: { wght } });
  const woff2 = await fontverter.convert(ttf, "woff2");
  await writeFile(new URL(`../assets/fonts/${name}.woff2`, import.meta.url), woff2);
  console.log(`${name}.woff2: ${(woff2.length / 1024).toFixed(0)} KB`);
}
