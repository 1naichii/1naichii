// Type for both SVGs. Cinzel is the Latin face on the anime's official site
// (titles, small capitals); EB Garamond is the book face for everything else.
// Both are SIL OFL 1.1 (assets/fonts/OFL-*.txt). The sources are static Latin
// cuts; each SVG embeds only the glyphs its own text uses, as WOFF2 data URIs,
// because GitHub's image proxy will not fetch a web font.
import { readFile } from "node:fs/promises";
import * as hb from "harfbuzzjs";
import fontverter from "fontverter";
import subsetFont from "subset-font";

const DIR = new URL("../assets/fonts/", import.meta.url);

export const FACES = {
  body: { file: "EBGaramond-Regular.woff2", family: "EB Garamond", weight: 400, style: "normal" },
  italic: { file: "EBGaramond-Italic.woff2", family: "EB Garamond", weight: 400, style: "italic" },
  label: { file: "Cinzel-SemiBold.woff2", family: "Cinzel", weight: 600, style: "normal" },
  display: { file: "Cinzel-Bold.woff2", family: "Cinzel", weight: 700, style: "normal" },
};

/** The root font for the SVG, and the attributes that switch a <text> or <tspan> to each face. */
export const ROOT_FAMILY = "'EB Garamond', Garamond, Georgia, serif";
const CINZEL = "Cinzel, 'Trajan Pro', Georgia, serif";
export const FACE_ATTRS = {
  body: "",
  italic: 'font-style="italic"',
  label: `font-family="${CINZEL}" font-weight="600"`,
  display: `font-family="${CINZEL}" font-weight="700"`,
};

const loaded = {};
for (const [name, face] of Object.entries(FACES)) {
  const source = await readFile(new URL(face.file, DIR));
  const ttf = await fontverter.convert(source, "truetype");
  const hbFace = new hb.Face(new hb.Blob(ttf));
  loaded[name] = { source, font: new hb.Font(hbFace), upem: hbFace.upem };
}

const widths = new Map();
/** Advance width of a string set in one face, shaped with kerning, in px. */
export function advance(value, size, face = "body", spacing = 0) {
  const key = `${face}\u0000${value}`;
  if (!widths.has(key)) {
    const { font, upem } = loaded[face];
    const buffer = new hb.Buffer();
    buffer.addText(value);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer);
    const units = buffer.getGlyphPositions().reduce((sum, p) => sum + p.xAdvance, 0);
    buffer.destroy?.();
    widths.set(key, units / upem);
  }
  return widths.get(key) * size + spacing * [...value].length;
}

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

function faceOf(attrs, inherited) {
  const family = /font-family="([^"]*)"/.exec(attrs)?.[1];
  const weight = /font-weight="(\d+)"/.exec(attrs)?.[1];
  const style = /font-style="(\w+)"/.exec(attrs)?.[1];
  const base = FACES[inherited];
  const want = {
    family: family ? (family.includes("Cinzel") ? "Cinzel" : "EB Garamond") : base.family,
    weight: weight ? Number(weight) : family ? 400 : base.weight,
    style: style || base.style,
  };
  const match = Object.entries(FACES).find(([, f]) => f.family === want.family && f.weight === want.weight && f.style === want.style);
  if (!match) throw new Error(`no font face for ${JSON.stringify(want)} in <text ${attrs}>`);
  return match[0];
}

/** An @font-face rule per face the SVG uses, each cut down to the characters set in it. */
export async function fontFaces(svg) {
  const used = {};
  const add = (face, value) => {
    used[face] ??= new Set();
    for (const ch of decode(value)) used[face].add(ch);
  };
  for (const [, attrs, inner] of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const face = faceOf(attrs, "body");
    for (const [, spanAttrs, spanText, loose] of inner.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>|([^<]+)/g)) {
      if (loose !== undefined) add(face, loose);
      else add(faceOf(spanAttrs, face), spanText);
    }
  }
  const rules = [];
  // Digits always travel with each face, so a new date or count does not reshuffle the subset every day.
  for (const chars of Object.values(used)) for (const ch of "0123456789-") chars.add(ch);
  for (const [name, chars] of Object.entries(used)) {
    const { family, weight, style } = FACES[name];
    // Only kerning and standard ligatures: the full layout closure drags in every swash and alternate, four times the bytes.
    const woff2 = await subsetFont(loaded[name].source, [...chars].join(""), { targetFormat: "woff2", keepFeatures: ["kern", "liga"] });
    rules.push(`@font-face{font-family:${family};font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${woff2.toString("base64")})}`);
  }
  return rules.join("");
}
