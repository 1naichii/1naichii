// Builds banner.svg (title card), profile.svg (everything under the GIF) and
// footer.svg (the closing card).
//
// Theme: Frieren, Beyond Journey's End. The profile is a travel journal kept
// after the hero's journey is over. Scrolling down is travelling north: spring
// meadows and sunbeams at the top, flashbacks along the road in the middle,
// Himmel's statue at the bottom, then sunrise and snow over a winter harbour.
// Warm melancholy, small things that bring back a memory, the series' time-skip
// captions, and its deadpan humour (mimics, oversleeping, "useless" spells).
//
// The pictures are all official art from frieren-anime.jp (©K.Y.T.A/S/FP), cut down
// by scripts/prepare-art.py into assets/art: two art boards painted by Studio Wyeth,
// the journey map, gallery visuals, episode stills, the spell stills from the magic
// page, a magic circle, and the official chibi characters. This file adds the type (Cinzel and
// EB Garamond, cut to the glyphs used, see fonts.mjs), the journal's paper and gold
// rules, the data, and SMIL animation. Everything is embedded as data URIs because
// GitHub's image proxy fetches nothing.
import { readFile, writeFile } from "node:fs/promises";
import { optimize } from "svgo";
import { advance, fontFaces, FACE_ATTRS, ROOT_FAMILY } from "./fonts.mjs";
import { readMana, today } from "./github.mjs";

const LOGIN = process.argv[2] || process.env.GITHUB_USERNAME || "1naichii";
const ROOT = new URL("../", import.meta.url);
const W = 680;
const FONTS = "/*@font-face*/";

/** Pixel size from a WebP header (lossy, lossless or extended). */
function webpSize(b) {
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}
/** Width over height of each picture, so cut-out characters keep their proportions. */
const ASPECT = {};
const ART = {};
for (const [key, file] of Object.entries({
  flowerField: "banner-flower-field.webp",
  harbor: "footer-harbor.webp",
  map: "journey-map.webp",
  blueMoon: "blue-moon-weed.webp",
  north: "north.webp",
  mimic: "mimic.webp",
  exhibit: "exhibit-a.webp",
  circle: "magic-circle.webp",
  statue: "himmel-statue.webp",
  memory: "himmel-memory.webp",
  mana: "mana.webp",
  aura: "mana-aura.webp",
  ...Object.fromEntries(["zoltraak", "flowers", "accessories", "silver", "oil", "eggshell"].map((s) => [`spell-${s}`, `spell-${s}.webp`])),
  ...Object.fromEntries(["frieren", "stark", "fern", "asleep", "himmel"].map((c) => [`chibi-${c}`, `chibi-${c}.webp`])),
})) {
  const bytes = await readFile(new URL(`assets/art/${file}`, ROOT));
  const [w, h] = webpSize(bytes);
  ASPECT[key] = w / h;
  ART[key] = `data:image/webp;base64,${bytes.toString("base64")}`;
}
const CREDIT = "©K.Y.T.A/S/FP";

const C = {
  ink: "#2b3a36",
  soft: "#4a5a55",
  muted: "#5f6c67",
  paper: "#fbf8f0",
  paperEdge: "#e4dac3",
  sepia: "#f1e9d6",
  gold: "#a98236", // ornaments only; text uses goldText
  goldText: "#86652b",
  goldSoft: "#d8bd7d",
  teal: "#3f8f7d",
  flower: "#6a88dc",
  petal: "#bccdff",
  ruby: "#c8485a",
  pin: "#0da5af", // the journey map's own stop markers
  route: "#13133d", // and its route line
};

// ---------- helpers ----------

const fx = (n) => Number(n.toFixed(2));
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Set text: typographic apostrophes, then escaped. */
const typeset = (value) => esc(String(value).replace(/'/g, "’"));
const LOOP = 'repeatCount="indefinite"';
const EASE = 'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"';

/** Seeded random numbers, so a daily rebuild only changes what the data changed. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// EB Garamond has a small x-height, so body text is set a tenth larger than the size asked for.
const SCALE = { body: 1.1, italic: 1.1, label: 1, display: 1 };
const sized = (size, face) => fx(size * SCALE[face]);

/** Rendered width from the font itself, used to keep lines clear of their neighbours and to wrap. */
function measure(value, size, { face = "body", spacing = 0 } = {}) {
  return advance(value, sized(size, face), face, spacing);
}

function wrap(words, size, maxW, { face = "body", joiner = " " } = {}) {
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line}${joiner}${word}` : word;
    if (line && measure(next, size, { face }) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  // No lone word on the last line: bring one down from the line above when it still fits.
  if (lines.length > 1 && !lines.at(-1).includes(joiner)) {
    const above = lines.at(-2).split(joiner);
    const moved = `${above.at(-1)}${joiner}${lines.at(-1)}`;
    if (above.length > 2 && measure(moved, size, { face }) <= maxW) lines.splice(-2, 2, above.slice(0, -1).join(joiner), moved);
  }
  return lines;
}

/** Faces: body and italic (EB Garamond), label (Cinzel 600, small capitals) and display (Cinzel 700, titles). */
function text(value, x, y, { size = 14, fill = C.ink, anchor, italic, face = italic ? "italic" : "body", spacing, opacity, extra } = {}) {
  const attrs = [
    `x="${fx(x)}"`, `y="${fx(y)}"`, FACE_ATTRS[face], `font-size="${sized(size, face)}"`, `fill="${fill}"`,
    anchor && `text-anchor="${anchor}"`, spacing && `letter-spacing="${spacing}"`,
    opacity !== undefined && `opacity="${opacity}"`, extra,
  ].filter(Boolean).join(" ");
  return `<text ${attrs}>${Array.isArray(value) ? value.join("") : typeset(value)}</text>`;
}
const span = (value, attrs = "") => `<tspan ${attrs}>${typeset(value)}</tspan>`;
// Smallest sizes are chosen to survive GitHub mobile, which shows these 680px images at about half size.
const caps = (value, x, y, opts = {}) => text(value.toUpperCase(), x, y, { size: 11, spacing: 1.8, fill: C.goldText, face: "label", ...opts });
const diamond = (x, y, r, fill = C.gold, extra = "") => `<path d="M${fx(x)} ${fx(y - r)}l${r} ${r}-${r} ${r}-${r}-${r}z" fill="${fill}"${extra}/>`;

const bob = (dy, dur, begin = 0) => `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-dy};0 0" dur="${dur}s" begin="${begin}s" ${EASE} ${LOOP}/>`;
const spin = (cx, cy, dur, reverse = false) => `<animateTransform attributeName="transform" type="rotate" from="${reverse ? 360 : 0} ${cx} ${cy}" to="${reverse ? 0 : 360} ${cx} ${cy}" dur="${dur}s" ${LOOP}/>`;
const pulse = (x, y, color) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/><circle cx="${x}" cy="${y}" r="3.5" fill="none" stroke="${color}" opacity="0"><animate attributeName="r" values="3.5;7" dur="4s" ${LOOP}/><animate attributeName="opacity" values=".5;0" dur="4s" ${LOOP}/></circle>`;

function pills(labels, x, y, color, gap = 6) {
  let cx = x;
  return labels.map((label) => {
    const w = fx(measure(label, 12) + 22);
    const svg = `<rect x="${fx(cx)}" y="${y}" width="${w}" height="23" rx="11.5" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".5"/>${text(label, cx + w / 2, y + 16, { size: 12, fill: C.ink, anchor: "middle" })}`;
    cx += w + gap;
    return svg;
  }).join("");
}

/** A picture pasted into the journal: white border, soft shadow, a strip of tape, a slight tilt.
 *  `below` adds a deeper bottom margin, as on an instant photo; `layer` goes straight over the
 *  picture (a second one fading in, say); `extra` is drawn on top. Both tilt with it. */
function photo(href, x, y, w, h, { mat = 5, below = 0, tilt = 0, tape = true, layer = "", extra = "" } = {}) {
  const ow = w + mat * 2;
  const oh = h + mat * 2 + below;
  const cx = fx(x + ow / 2);
  const cy = fx(y + oh / 2);
  return [
    `<g transform="rotate(${tilt} ${cx} ${cy})">`,
    `<rect x="${fx(x + 1.5)}" y="${fx(y + 3)}" width="${ow}" height="${oh}" rx="2" fill="${C.ink}" opacity=".14"/>`,
    `<rect x="${x}" y="${y}" width="${ow}" height="${oh}" rx="2" fill="#fff" stroke="${C.paperEdge}"/>`,
    `<image href="${href}" x="${x + mat}" y="${y + mat}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`,
    layer,
    `<rect x="${x + mat}" y="${y + mat}" width="${w}" height="${h}" fill="none" stroke="${C.ink}" stroke-opacity=".12"/>`,
    tape ? `<rect x="${fx(cx - 20)}" y="${y - 7}" width="40" height="13" fill="${C.goldSoft}" opacity=".5" transform="rotate(${fx(3 - tilt)} ${cx} ${y})"/>` : "",
    extra,
    "</g>",
  ].join("");
}

// ---------- shared scenery ----------

function sharedDefs() {
  return `
<radialGradient id="petalFill" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="9.6"><stop offset=".12" stop-color="#fff"/><stop offset=".38" stop-color="#f3f8ff"/><stop offset=".62" stop-color="#a8cbf4"/><stop offset="1" stop-color="#5b93de"/></radialGradient>
<g id="bloom">${[0, 72, 144, 216, 288].map((a) => `<path d="M0 0C-4.6-1.6-6.2-6.4-4.4-8.6-2.8-10.2 2.8-10.2 4.4-8.6 6.2-6.4 4.6-1.6 0 0z" fill="url(#petalFill)" transform="rotate(${a})"/>`).join("")}<path d="${[0, 72, 144, 216, 288].map((a) => { const r = ((a - 90) * Math.PI) / 180; return `M${fx(Math.cos(r) * 3.4)} ${fx(Math.sin(r) * 3.4)}L${fx(Math.cos(r) * 7.6)} ${fx(Math.sin(r) * 7.6)}`; }).join("")}" stroke="#6d9fe2" stroke-width=".45" opacity=".7"/><path d="${Array.from({ length: 10 }, (_, i) => { const r = (i * 36 * Math.PI) / 180; return `M${fx(Math.cos(r) * 2.6)} ${fx(Math.sin(r) * 2.6)}h0`; }).join("")}" stroke="#2c3340" stroke-width=".7" stroke-linecap="round"/><circle r="1.3" fill="#e9f1d8"/></g>
<linearGradient id="ruleL"><stop offset="0" stop-color="${C.gold}" stop-opacity="0"/><stop offset="1" stop-color="${C.gold}" stop-opacity=".6"/></linearGradient>
<linearGradient id="ruleR"><stop offset="0" stop-color="${C.gold}" stop-opacity=".6"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient>
<linearGradient id="beam" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf0" stop-opacity=".8"/><stop offset="1" stop-color="#fffdf0" stop-opacity="0"/></linearGradient>
<filter id="soften" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
<path id="petal" d="M0 0C-4.6-1.6-6.2-6.4-4.4-8.6-2.8-10.2 2.8-10.2 4.4-8.6 6.2-6.4 4.6-1.6 0 0z" transform="matrix(.45 0 0 .45 0 2.2)"/>`;
}

/** Soft diagonal sunbeams falling from the upper right, breathing slowly. */
function sunbeams(rand, xs, len) {
  return xs.map((x, i) => {
    const w = fx(26 + rand() * 40);
    const dur = fx(7 + rand() * 5);
    return `<path d="M${x} -10h${w}l${fx(-len * 0.55)} ${len}h${fx(-w * 1.8)}z" fill="url(#beam)" filter="url(#soften)" opacity=".3"><animate attributeName="opacity" values=".1;.38;.1" dur="${dur}s" begin="${fx(-i * 2.3)}s" ${EASE} ${LOOP}/></path>`;
  }).join("");
}

/** One petal (the bloom's own shape) drifting from x y by dx dy and tumbling as it goes. */
function petal(rand, x, y, dx, dy, dur, begin, color, peak = 0.9) {
  return `<g opacity="0"><animateTransform attributeName="transform" type="translate" values="${x} ${y};${fx(x + dx)} ${fx(y + dy)}" dur="${dur}s" begin="${begin}s" ${LOOP}/><animate attributeName="opacity" values="0;${peak};${peak};0" keyTimes="0;.15;.8;1" dur="${dur}s" begin="${begin}s" ${LOOP}/><use href="#petal" fill="${color}"><animateTransform attributeName="transform" type="rotate" from="0" to="${rand() < 0.5 ? 360 : -360}" dur="${fx(2.5 + rand() * 3)}s" ${LOOP}/></use></g>`;
}

/** Petals carried on the wind; rising ones lift off a field. */
function petals(rand, count, w, top, h, { colors = ["#b9d6f8", "#eef5ff"], rise = false, lift = [30, 100] } = {}) {
  return Array.from({ length: count }, () => {
    const x = fx(-40 + rand() * w);
    const y = fx(top + rand() * h);
    const dx = fx(120 + rand() * 160);
    const dy = fx((lift[0] + rand() * (lift[1] - lift[0])) * (rise ? -1 : 1));
    const dur = fx(9 + rand() * 7);
    return petal(rand, x, y, dx, dy, dur, fx(-rand() * dur), colors[Math.floor(rand() * colors.length)]);
  }).join("");
}

/** A few blue-moon weed petals lifting off an open hand and drifting away to the right. */
function handPetals(rand, x, y, count) {
  return Array.from({ length: count }, (_, i) => {
    const dur = fx(7 + rand() * 3);
    return petal(rand, fx(x + rand() * 6), fx(y + rand() * 6), fx(70 + rand() * 90), fx(-12 - rand() * 40), dur, fx((-i * dur) / count), ["#a8cbf4", "#d9e8fb", "#7fb0ea"][i % 3], 0.85);
  }).join("");
}

/** Snow drifting down through a band of the picture. */
function snow(rand, count, x0, w, top, h) {
  return Array.from({ length: count }, () => {
    const x = fx(x0 + rand() * w);
    const y = fx(top + rand() * h * 0.5);
    const fall = fx(h * (0.4 + rand() * 0.5));
    const drift = fx((rand() - 0.5) * 40);
    const dur = fx(7 + rand() * 7);
    const begin = fx(-rand() * dur);
    return `<circle cx="${x}" cy="${y}" r="${fx(1 + rand() * 1.6)}" fill="#fff" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;${drift} ${fall}" dur="${dur}s" begin="${begin}s" ${LOOP}/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.8;1" dur="${dur}s" begin="${begin}s" ${LOOP}/></circle>`;
  }).join("");
}

/** Rounded frame with a gold hairline, shared by both files. */
function frame(h, background, body, defs, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-labelledby="t d" font-family="${ROOT_FAMILY}">
<title id="t">${esc(label.title)}</title>
<desc id="d">${esc(label.desc)}</desc>
<!--! Type: Cinzel and EB Garamond, SIL Open Font License 1.1 (assets/fonts/OFL-*.txt). Official art ©K.Y.T.A/S/FP. -->
<style>${FONTS}</style>
<defs>${defs}<clipPath id="round"><rect width="${W}" height="${h}" rx="18"/></clipPath></defs>
<g clip-path="url(#round)"><rect width="${W}" height="${h}" fill="${background}"/>
${body}
</g>
<rect x="7.5" y="7.5" width="${W - 15}" height="${h - 15}" rx="13" fill="none" stroke="${C.gold}" stroke-opacity=".4"/>
${[[11.3, 11.3], [W - 11.3, 11.3], [11.3, h - 11.3], [W - 11.3, h - 11.3]].map(([x, y]) => diamond(x, y, 4)).join("")}
</svg>`;
}

// ---------- banner.svg ----------

function banner() {
  const H = 340;
  const rand = seeded(2023);
  const defs = sharedDefs() + `
<radialGradient id="veil" cx=".74" cy=".44" r=".36"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="vignette" r=".72"><stop offset=".62" stop-color="#1d2b2a" stop-opacity="0"/><stop offset="1" stop-color="#1d2b2a" stop-opacity=".2"/></radialGradient>`;

  // Title block, centred over the open sky to the right of the church.
  const tx = 505;
  const cue = "Journey of a Lifetime";
  const tag = "Beyond Deploy's End";
  const tagHalf = measure(tag.toUpperCase(), 11, { face: "label", spacing: 4 }) / 2 + 14;
  const credit = `${CREDIT} · art board: Studio Wyeth`;
  const creditW = measure(credit, 9, { face: "italic" }) + 18;

  const body = [
    `<image href="${ART.flowerField}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`,
    `<rect width="${W}" height="${H}" fill="url(#veil)"/>`,
    sunbeams(rand, [600, 680, 760, 840], 460),
    petals(rand, 18, W, 282, 40, { colors: ["#fbd0da", "#fff1bd", "#ffffff", "#f7a9a0"], rise: true, lift: [8, 26] }),
    `<rect width="${W}" height="${H}" fill="url(#vignette)"/>`,
    note(fx(652 - measure(cue, 11, { face: "italic" }) - 16), 37), text(cue, 652, 37, { size: 11, italic: true, fill: C.soft, anchor: "end" }),
    diamond(tx - tagHalf, 92, 3), diamond(tx + tagHalf, 92, 3),
    caps(tag, tx, 96, { spacing: 4, anchor: "middle", fill: "#7a5a1e" }),
    text("Mochaa", tx + 1.5, 154.5, { face: "display", size: 56, fill: "#fff", opacity: 0.75, anchor: "middle" }),
    text("Mochaa", tx, 153, { face: "display", size: 56, fill: "#22343a", anchor: "middle" }),
    text([span("the ", `fill="${C.soft}"`), span("Bug Slayer", `fill="#7a5a1e"`)], tx, 183, { size: 20, italic: true, anchor: "middle" }),
    `<rect x="${tx - 112}" y="199" width="100" height="1" fill="url(#ruleL)"/><rect x="${tx + 12}" y="199" width="100" height="1" fill="url(#ruleR)"/>`, diamond(tx, 199.5, 3),
    text("naichii · 1naichii", tx, 224, { size: 14, fill: C.soft, anchor: "middle", spacing: 1 }),
    caps("Versatile Software Engineer", tx, 245, { anchor: "middle", fill: C.ink }),
    `<rect x="${fx(654 - creditW)}" y="306" width="${fx(creditW)}" height="18" rx="9" fill="#1d2b2a" opacity=".42"/>`,
    text(credit, 645, 319, { size: 9, italic: true, fill: "#fff", anchor: "end" }),
  ].join("\n");

  return frame(H, "#bfe3f1", body, defs, {
    title: "Mochaa — the Bug Slayer",
    desc: "A Frieren-themed title card for Mochaa (naichii, 1naichii), a versatile software engineer. Behind the title is the official art board of the ruined church in a flower field from the Episode 2 flashback (painted by Studio Wyeth, ©K.Y.T.A/S/FP), with soft sunbeams and petals lifting off the field.",
  });
}

// ---------- profile.svg chapters ----------

/** A journal page: paper card, gold hairline, and an episode-style chapter heading. */
const note = (x, y) => `<g><path d="M${x} ${y}v-8.5l6-1.6v7.2" fill="none" stroke="${C.gold}" stroke-width="1.1"/><ellipse cx="${x - 1.6}" cy="${y}" rx="2" ry="1.5" fill="${C.gold}"/><ellipse cx="${x + 4.4}" cy="${y - 1.4}" rx="2" ry="1.5" fill="${C.gold}"/></g>`;

function card(h, chapter, title, bgm, under = "") {
  const label = chapter.toUpperCase();
  const half = measure(label, 11, { face: "label", spacing: 3 }) / 2 + 12;
  return [
    `<rect y="3" width="632" height="${h}" rx="12" fill="${C.ink}" opacity=".07"/>`,
    `<rect width="632" height="${h}" rx="12" fill="${C.paper}" stroke="${C.paperEdge}"/>`,
    under,
    `<rect x="8.5" y="8.5" width="615" height="${h - 17}" rx="7" fill="none" stroke="${C.gold}" stroke-opacity=".25"/>`,
    [[10.6, 10.6], [621.4, 10.6], [10.6, h - 10.6], [621.4, h - 10.6]].map(([x, y]) => diamond(x, y, 3, C.gold, ' opacity=".6"')).join(""),
    `<rect x="${fx(316 - half - 96)}" y="37" width="90" height="1" fill="url(#ruleL)"/><rect x="${fx(316 + half + 6)}" y="37" width="90" height="1" fill="url(#ruleR)"/>`,
    diamond(316 - half, 37.5, 3), diamond(316 + half, 37.5, 3),
    caps(label, 316, 41, { spacing: 3, anchor: "middle" }),
    text(title, 316, 73, { face: "display", size: 21, fill: C.ink, anchor: "middle" }),
    bgm ? note(fx(606 - measure(bgm, 11, { face: "italic" }) - 16), 29) + text(bgm, 606, 29, { size: 11, italic: true, fill: C.muted, anchor: "end" }) : "",
  ].join("");
}

function journal() {
  const h = 386;
  const out = [card(h, "Chapter 1", "After the Journey's End", "Where the Blue-Moon Weed Grows")];

  // Himmel and Frieren with blue-moon weed (official visual), taped in like a keepsake.
  out.push(photo(ART.blueMoon, 44, 104, 124, 128, { mat: 6, tilt: -3 }));
  // He only said he would like to show it to her someday. She found it after he was gone.
  ["Himmel wanted to show her.", "She found it after he was gone."].forEach((line, i) => {
    if (measure(line, 12, { face: "italic" }) > 176) throw new Error(`photo caption too wide: ${line}`);
    out.push(text(line, 112, 272 + i * 15, { size: 12, italic: true, fill: C.muted, anchor: "middle" }));
  });

  out.push(text("Fifty years on, a new journey begins.", 206, 112, { size: 16, italic: true, fill: C.ink }));
  const rows = [
    ["Name", "Mochaa (naichii)"],
    ["Class", "Versatile Software Engineer"],
    ["Craft", "Web development & workflow automation"],
    ["Ritual", "Spec-Driven Development"],
    ["Spells", "REST APIs · Bots · Cron jobs"],
    ["Off-duty", "Watching cosy anime"],
  ];
  const vx = 296;
  rows.concat([["Status", ""]]).forEach(([label]) => {
    if (206 + measure(label.toUpperCase(), 12, { face: "label", spacing: 1.8 }) > vx - 8) throw new Error(`journal label too wide: ${label}`);
  });
  rows.forEach(([label, value], i) => {
    const y = 146 + i * 24;
    if (vx + measure(value, 14) > 604) throw new Error(`journal value too wide: ${value}`);
    out.push(caps(label, 206, y, { size: 12 }), text(value, vx, y, { size: 14, fill: C.soft }));
  });
  const sy = 146 + rows.length * 24;
  out.push(caps("Status", 206, sy, { size: 12 }), pulse(vx + 4, sy - 4, C.teal), text("Open to collaboration", vx + 16, sy, { size: 14, fill: C.teal }));

  // Her regret at his funeral was never trying to get to know him.
  out.push(`<rect x="40" y="316" width="552" height="1" fill="${C.gold}" opacity=".2"/>`);
  out.push(text("“This time, I'll get to know the people I build for.”", 316, 342, { size: 15, italic: true, fill: C.ink, anchor: "middle" }));
  out.push(text("Frieren learned it at Himmel's funeral. I'd rather learn it at kickoff.", 316, 362, { size: 12, italic: true, fill: C.muted, anchor: "middle" }));
  return { h, svg: out.join("") };
}

function road() {
  // Newest first; each stop is numbered from the oldest, like the stops on the official map.
  const past = [
    { when: "2026", title: "Freelance Full-Stack Engineer", where: "AI security platform", note: "raised barriers against intruders" },
    { when: "2025", title: "Freelance Backend Engineer", where: "news platform", note: "kept the town crier on schedule" },
    { when: "2025", title: "Backend Intern", note: "the first dungeon. As Eisen said, fear is what brought me this far" },
    { when: "2024–25", title: "Lab, Teaching & Research Assistant", note: "taught apprentices, as Flamme once taught Frieren" },
    { when: "2024", title: "Full-Stack Bootcamp", note: "practised daily, like Fern, until the spell hit the distant rock" },
    { when: "2021–25", title: "Computer Engineering", note: "where the first seeds were planted" },
  ];
  const quests = ["Modernize an internal web app", "Summon bots for recurring operations", "Tend the automation & cron jobs"];
  const bx = 74;
  const tx = 118;
  const out = [];

  // Present day, in full colour. This part sits where the map shows strongest, so its lines get a
  // halo of paper round each letter, the way names are set on a printed map, and darker ink.
  const halo = `stroke="${C.paper}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"`;
  const tealInk = "#2c7464";
  const nowY = 114;
  out.push(text([span("Full-Stack Engineer", `fill="${C.ink}"`), span(" · enterprise client", `fill="${C.soft}" font-style="italic"`)], tx, nowY, { size: 15.5, extra: halo }));
  out.push(caps("Now", 592, nowY, { anchor: "end", fill: tealInk, extra: halo }), pulse(fx(592 - measure("NOW", 10, { face: "label", spacing: 2 }) - 14), nowY - 4, C.teal));
  out.push(text("since Aug 2026 · heading north, one quest at a time", tx, nowY + 20, { size: 12, italic: true, fill: tealInk, extra: halo }));
  quests.forEach((quest, i) => {
    const y = nowY + 48 + i * 25;
    out.push(`<use href="#bloom" transform="translate(${tx + 6} ${y - 4}) scale(.5)"/>`, text(quest, tx + 20, y, { size: 13, fill: C.ink, extra: halo }));
    // Each thread is drawn once, then stays: progress, not a loading bar.
    out.push(`<rect x="${tx + 20}" y="${y + 6}" width="300" height="1" fill="${C.gold}" opacity=".5"><animate attributeName="width" values="0;0;300" keyTimes="0;${fx(0.1 + i * 0.15)};1" dur="3.5s" ${EASE} fill="freeze"/></rect>`);
  });
  // The party heading up into the snow (Episode 11), beside the road north.
  out.push(photo(ART.north, 455, 135, 130, 88, { mat: 5, tilt: 2 }));

  // The past, as a flashback: sepia, with soft edges.
  const top = nowY + 48 + quests.length * 25 + 40;
  const step = 52;
  const ys = past.map((_, i) => top + 32 + i * step);
  const bottom = ys.at(-1) + 32;
  out.push(`<rect x="28" y="${top - 8}" width="576" height="${bottom - top + 8}" rx="10" fill="${C.sepia}" opacity=".82" filter="url(#feather)"/>`);
  out.push(caps("Years earlier", tx, top + 10, { fill: C.muted }));
  past.forEach((entry, i) => {
    const y = ys[i];
    const line = entry.title + (entry.where ? ` · ${entry.where}` : "");
    if (tx + measure(line, 15) > 592 - measure(entry.when, 10, { face: "label", spacing: 2 }) - 14) throw new Error(`road line too wide: ${line}`);
    const title = [span(entry.title, `fill="${C.soft}"`)];
    if (entry.where) title.push(span(` · ${entry.where}`, `fill="${C.muted}" font-style="italic"`));
    out.push(text(title, tx, y, { size: 15 }), caps(entry.when, 592, y, { anchor: "end", fill: C.muted }));
    out.push(text(entry.note, tx, y + 18, { size: 12, italic: true, fill: C.muted }));
  });

  // The route through every stop, from the first village up to today, drawn the way the
  // official map draws the party's: a navy line and numbered teal markers.
  const nodes = [...ys].reverse().map((y) => y - 5).concat([nowY - 5]);
  let d = `M${bx} ${nodes[0]}`;
  for (let i = 1; i < nodes.length; i++) {
    const [y1, y2] = [nodes[i - 1], nodes[i]];
    const s = i % 2 ? 20 : -20;
    d += `C${bx + s} ${fx(y1 - (y1 - y2) * 0.35)} ${bx + s} ${fx(y2 + (y1 - y2) * 0.35)} ${bx} ${y2}`;
  }
  const marker = (y, n, r = 10) => `<circle cx="${bx}" cy="${y}" r="${r}" fill="${C.pin}" stroke="#fff" stroke-width="1.5"/>${text(String(n), bx, y + 3.9, { face: "label", size: r + 1, fill: "#fff", anchor: "middle" })}`;
  // A traveller's light retraces the old route, then rests at today.
  const motion = `<animateMotion path="${d}" keyPoints="0;1;1" keyTimes="0;.85;1" calcMode="linear" dur="12s" ${LOOP}/>`;
  const roadSvg = [
    `<path d="${d}" stroke="${C.route}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>`,
    past.map((_, i) => marker(ys[i] - 5, past.length - i)).join(""),
    `<circle cx="${bx}" cy="${nowY - 5}" r="12" fill="none" stroke="${C.pin}" opacity="0"><animate attributeName="r" values="12;20" dur="4s" ${LOOP}/><animate attributeName="opacity" values=".6;0" dur="4s" ${LOOP}/></circle>`,
    marker(nowY - 5, past.length + 1, 12),
    // Hidden unless animation runs, so a renderer without SMIL does not leave it parked at the corner.
    `<g opacity="0"><animate attributeName="opacity" values="1" dur="1s" fill="freeze"/><circle r="9" fill="${C.goldSoft}" opacity=".45">${motion}</circle><circle r="3.5" fill="#fff" stroke="${C.gold}">${motion}</circle></g>`,
  ].join("");

  const h = bottom + 58;
  // The official journey map, in its own colours, like a page pressed against the journal.
  const map = `<clipPath id="mapClip"><rect width="632" height="${h}" rx="12"/></clipPath><mask id="mapFade"><rect width="632" height="${h}" fill="url(#fade)"/></mask><image href="${ART.map}" width="632" height="${h}" preserveAspectRatio="xMidYMid slice" opacity=".3" clip-path="url(#mapClip)" mask="url(#mapFade)"/>`;
  const svg = [
    card(h, "Chapter 2", "Memories Along the Road", "Time Flows Ever Onward", map),
    out.join(""),
    roadSvg,
    text("A short nap, by an elf's count. Each stop meant more than it seemed.", 316, bottom + 30, { size: 12, italic: true, fill: C.muted, anchor: "middle" }),
    text(`map ${CREDIT}`, 604, h - 17, { size: 9, italic: true, fill: C.muted, anchor: "end" }),
  ].join("");
  return { h, svg };
}

function dungeon() {
  const h = 574;
  const out = [card(h, "Chapter 3", "A Chest in the Dungeon", "Drunkards and Mimics")];
  out.push(caps("Open-source side quest", 40, 112, { fill: C.teal }));
  out.push(text("ai-engineering-starter", 40, 141, { face: "display", size: 17, fill: C.ink }));
  out.push(text("A practical starter for building", 40, 170, { size: 14, fill: C.soft }), text("reliable AI software.", 40, 190, { size: 14, fill: C.soft }));
  out.push(pills(["Spec-driven", "Multi-agent", "MIT"], 40, 205, C.flower));
  out.push(pulse(45, 256, C.gold), text("In progress", 58, 260, { size: 13, italic: true, fill: C.goldText }));

  // The mimic (official visual): Frieren head first in a chest, which gives a hungry shudder now and then.
  const ax = 478;
  const cycle = `dur="8s" ${LOOP}`;
  const pivot = `${ax} 260`;
  const shudder = `<animateTransform attributeName="transform" type="rotate" values="0 ${pivot};0 ${pivot};-1.4 ${pivot};1.2 ${pivot};-.8 ${pivot};.5 ${pivot};0 ${pivot};0 ${pivot}" keyTimes="0;.5;.53;.56;.59;.62;.65;1" ${cycle}/>`;
  out.push(`<g>${photo(ART.mimic, 364, 102, 216, 180, { mat: 6, tilt: 2 })}${shudder}</g>`);
  // Episode 23: her detection spell is 99% sure it is a mimic; she opens it anyway.
  out.push(text("“It's dark! I'm scared!”", ax, 322, { size: 13, italic: true, fill: C.ink, anchor: "middle" }));
  out.push(text("The spell said 99% mimic.", ax, 346, { size: 12, italic: true, fill: C.soft, anchor: "middle" }));
  out.push(text("Her experience said grimoire.", ax, 363, { size: 12, italic: true, fill: C.soft, anchor: "middle" }));
  out.push(text("This repo is the other 1%.", ax, 380, { size: 12, italic: true, fill: C.goldText, anchor: "middle" }));

  // Exhibit A, from the Episode 23 records: Fern pulling her out of the last one.
  out.push(photo(ART.exhibit, 44, 292, 108, 80, { mat: 6, below: 22, tilt: -4, extra: text("Exhibit A", 104, 395, { size: 12.5, italic: true, fill: C.soft, anchor: "middle" }) }));

  // The running score. A new mark goes up every time the chest shudders.
  const tallyX = 252;
  const mark = (i) => {
    const x = tallyX + Math.floor(i / 5) * 30 + (i % 5) * 5;
    return i % 5 === 4 ? `M${x - 22} 335L${x + 1} 325` : `M${x} 320v16`;
  };
  out.push(caps("Tally", 190, 304, { fill: C.muted }));
  out.push(text("Mimics", 190, 334, { size: 13, fill: C.soft }), text("Frieren", 190, 366, { size: 13, fill: C.soft }));
  out.push(`<path d="${Array.from({ length: 12 }, (_, i) => mark(i)).join("")}" stroke="${C.ruby}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`);
  out.push(`<path d="${mark(12)}" stroke="${C.ruby}" stroke-width="1.6" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;0;.8;.8" keyTimes="0;.62;.64;1" ${cycle}/></path>`);
  out.push(text("0", tallyX, 366, { face: "display", size: 14, fill: C.muted }));
  out.push(text("Fern pulls her out every time.", 190, 397, { size: 12, italic: true, fill: C.muted }));

  // Spell chain: chant, cast, seal. Each is a magic circle from the series (#magic, rebuilt from
  // a Season 2 Episode 10 still) turning slowly, and each lights up in turn.
  out.push(`<rect x="40" y="448" width="552" height="1" fill="${C.gold}" opacity=".2"/>`);
  const xs = [156, 316, 476];
  const cy = 494;
  const r = 30;
  out.push(`<path d="M${xs[0] + r + 8} ${cy}H${xs[1] - r - 8}M${xs[1] + r + 8} ${cy}H${xs[2] - r - 8}" stroke="${C.gold}" stroke-opacity=".45" stroke-dasharray="3 4"/>`);
  [["Chant", "the spec"], ["Cast", "the build"], ["Seal", "with review"]].forEach(([verb, noun], i) => {
    const x = xs[i];
    const turn = `keyTimes="0;${fx(i / 3)};${fx(i / 3 + 0.1)};${fx(i / 3 + 0.3)};1" dur="6s" ${LOOP}`;
    out.push(`<circle cx="${x}" cy="${cy}" r="${r + 9}" fill="url(#circleGlow)" opacity="0"><animate attributeName="opacity" values="0;0;1;0;0" ${turn}/></circle>`);
    out.push(`<g opacity=".85"><animate attributeName="opacity" values=".85;.85;1;.85;.85" ${turn}/><g><use href="#magic" x="${x}" y="${cy}"/>${spin(x, cy, 40, i === 1)}</g></g>`);
    out.push(text([span(`${verb} `, `fill="${C.goldText}"`), span(noun, `fill="${C.soft}" font-style="italic"`)], x, cy + r + 22, { size: 12.5, anchor: "middle" }));
  });
  return { h, svg: out.join("") };
}

function grimoire() {
  // Each spell with its still from the official magic page. Zoltraak was Qual's, until he was
  // sealed for eighty years; the lost-accessories spell is the one that found Himmel's ring (Episode 14).
  const spells = [
    { art: "spell-zoltraak", name: "Zoltraak", note: "Qual's killing magic. Eighty years later, ordinary offensive magic.", tags: ["TypeScript", "JavaScript", "PHP", "Python"] },
    { art: "spell-flowers", name: "Spell to create a field of flowers", note: "Flamme's favourite. Himmel's too.", tags: ["React", "Svelte", "Astro"] },
    { art: "spell-accessories", name: "Spell to find lost accessories", note: "Once found Himmel's ring. Now it finds every route.", tags: ["Express", "Laravel", "Elysia", "Hono"] },
    { art: "spell-silver", name: "Spell to find silver ore deposits", note: "Digs up exactly the rows you need.", tags: ["MySQL", "MongoDB", "Redis"] },
    { art: "spell-oil", name: "Spell to remove stubborn oil stains", note: "Keeps the workshop clean between builds.", tags: ["Node.js", "Bun", "Vite", "npm", "Composer"] },
    { art: "spell-eggshell", name: "Spell to keep shell out of a cracked egg", note: "Nothing broken slips into the release.", tags: ["Git", "Docker", "Nginx"] },
  ];
  const colW = 168;
  const imgH = 94.5;
  const xs = [40, 232, 424];
  const out = [];
  let y = 104;
  for (let row = 0; row < spells.length / 3; row++) {
    let rowBottom = 0;
    spells.slice(row * 3, row * 3 + 3).forEach((spell, i) => {
      const x = xs[i];
      out.push(photo(ART[spell.art], x - 4, y, colW, imgH, { mat: 4, tape: false }));
      let ty = y + imgH + 30;
      out.push(`<use href="#bloom" transform="translate(${x + 5} ${ty - 5}) scale(.55)"/>`);
      wrap(spell.name.split(" "), 14, colW - 16, { face: "italic" }).forEach((line, n) => {
        if (n) ty += 18;
        out.push(text(line, x + 16, ty, { size: 14, italic: true, fill: C.goldText }));
      });
      ty += 19;
      for (const line of wrap(spell.note.split(" "), 12, colW, { face: "italic" })) {
        out.push(text(line, x, ty, { size: 12, italic: true, fill: C.muted }));
        ty += 16.5;
      }
      ty += 3;
      for (const line of wrap(spell.tags, 13, colW, { joiner: " · " })) {
        out.push(text(line, x, ty, { size: 13, fill: C.soft }));
        ty += 17.5;
      }
      rowBottom = Math.max(rowBottom, ty);
    });
    y = rowBottom + 20;
  }

  const fy = y + 22;
  const h = fy + 50;
  const svg = [
    card(h, "Chapter 4", "Useless Magic, Collected", "Zoltraak"),
    out.join(""),
    `<rect x="40" y="${y}" width="552" height="1" fill="${C.gold}" opacity=".2"/>`,
    // Episode 2: Fern doesn't see the appeal of these; Frieren says collecting them is a hobby.
    text("Also inside: turning sweet grapes sour, and removing rust from bronze statues.", 316, fy, { size: 12, italic: true, fill: C.muted, anchor: "middle" }),
    text("Fern doesn't see the appeal. Frieren calls it a hobby. I ship with them.", 316, fy + 19, { size: 12, italic: true, fill: C.soft, anchor: "middle" }),
  ].join("");
  return { h, svg };
}

function mana(data) {
  const out = [];
  const ax = 92;
  const ay = 148;
  out.push(`<clipPath id="avatar"><circle cx="${ax}" cy="${ay}" r="40"/></clipPath>`);
  out.push(`<circle cx="${ax}" cy="${ay}" r="58" fill="url(#halo)"/><image href="${data.avatar}" x="${ax - 40}" y="${ay - 40}" width="80" height="80" clip-path="url(#avatar)"/>`);
  out.push(`<circle cx="${ax}" cy="${ay}" r="40.5" fill="none" stroke="${C.gold}" stroke-opacity=".7"/><g><circle cx="${ax}" cy="${ay}" r="48" fill="none" stroke="${C.teal}" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="1 5 8 5"/>${spin(ax, ay, 30)}</g>`);

  // Leading punctuation in a display name reads as a stray mark in Cinzel capitals.
  const display = data.name.replace(/^[^\p{L}\p{N}]+/u, "") || data.login;
  const name = display.length > 24 ? data.login : display;
  out.push(text(name, 156, 140, { face: "display", size: 21, fill: C.ink }));
  out.push(text(`@${data.login}`, 156, 163, { size: 13, fill: C.goldText }));
  out.push(text(`${data.repositories} repositories · ${data.followers} followers`, 156, 183, { size: 12, fill: C.muted }));
  out.push(text(`read on ${today}`, 156, 205, { size: 12, italic: true, fill: C.muted }));

  // Episode 10, told in one 12 s loop. Frieren keeps her mana hidden and the bar shows only what
  // a demon would read. Aura weighs it on her scale; the bar floods to the real reading; then
  // Frieren hides it again. Without animation, the photo is Frieren and the bar the real reading.
  const cycle = `dur="12s" ${LOOP}`;
  const reveal = (a, b) => `values="${a};${a};${b};${b};${a};${a}" keyTimes="0;.66;.7;.88;.92;1" ${cycle}`;
  const aura = `<image href="${ART.aura}" x="415" y="103" width="172" height="97" preserveAspectRatio="xMidYMid slice" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.56;.6;.68;.72;1" ${cycle}/></image>`;
  out.push(photo(ART.mana, 410, 98, 172, 97, { mat: 5, tilt: 2, layer: aura }));

  const days = (n) => (n === 1 ? "day" : "days");
  [[data.current, `${days(data.current)} on the road`], [data.longest, "longest stretch"], [data.total, "spells cast this year"]].forEach(([value, label], i) => {
    const x = 112 + i * 204;
    if (measure(label.toUpperCase(), 12, { face: "label", spacing: 0.8 }) > 194) throw new Error(`stat label too wide: ${label}`);
    out.push(text(String(value), x, 254, { face: "display", size: 30, fill: C.ink, anchor: "middle" }), caps(label, x, 278, { size: 12, spacing: 0.8, anchor: "middle" }));
    if (i) out.push(`<rect x="${x - 102}" y="222" width="1" height="60" fill="${C.gold}" opacity=".22"/>`);
  });

  // Mana flows while contributions keep coming and ebbs 15% for every idle day.
  const pct = Number.isFinite(data.idle) ? Math.max(0, 100 - data.idle * 15) : 0;
  const mood = pct >= 70 ? "flowing" : pct >= 40 ? "steady" : pct > 0 ? "faint" : "asleep (Fern is on her way)";
  const shown = Math.min(10, pct);
  const hides = pct > shown;
  const full = fx((552 * pct) / 100);
  const low = fx((552 * shown) / 100);
  out.push(caps("Mana", 40, 322, { fill: C.ink }));
  const real = text([span(mood, `font-style="italic" fill="${C.teal}"`), span(` · ${pct}%`, `fill="${C.soft}"`)], 592, 322, { size: 12, anchor: "end" });
  if (hides) {
    const decoy = text([span("what a demon reads", `font-style="italic" fill="${C.muted}"`), span(` · ${shown}%`, `fill="${C.soft}"`)], 592, 322, { size: 12, anchor: "end" });
    out.push(`<g opacity="0"><animate attributeName="opacity" ${reveal(1, 0)}/>${decoy}</g><g><animate attributeName="opacity" ${reveal(0, 1)}/>${real}</g>`);
  } else out.push(real);
  // The full capacity as a faint dotted outline, the reading inside it.
  out.push(`<rect x="40" y="332" width="552" height="8" rx="4" fill="${C.paperEdge}" fill-opacity=".35" stroke="${C.gold}" stroke-opacity=".45" stroke-dasharray="2 3"/>`);
  if (pct) {
    out.push(`<rect x="40" y="332" width="${full}" height="8" rx="4" fill="url(#manaBar)">${hides ? `<animate attributeName="width" ${reveal(low, full)}/>` : ""}</rect>`);
    if (hides) out.push(`<rect x="38" y="329" width="${fx(full + 4)}" height="14" rx="7" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0;.85;0;0" keyTimes="0;.68;.7;.76;1" ${cycle}/></rect>`);
  }
  out.push(text("Suppressed, as always. A demon would read this and guess wrong.", 316, 364, { size: 12, italic: true, fill: C.muted, anchor: "middle" }));

  // A year as a flower field: bare ground on quiet days, buds, then full blue-moon weed.
  out.push(`<rect x="40" y="384" width="552" height="1" fill="${C.gold}" opacity=".2"/>`);
  out.push(text("A year of blue-moon weed: one bloom for every day of work.", 316, 410, { size: 12, italic: true, fill: C.soft, anchor: "middle" }));
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() - 52 * 7);
  const from = start.toISOString().slice(0, 10);
  const step = 10.4;
  const gx = fx(316 - (52 * step) / 2);
  const gy = 430;
  const dots = ["", "", "", "", ""];
  for (const day of data.days) {
    if (day.date < from || day.date > today) continue;
    const date = new Date(`${day.date}T00:00:00Z`);
    const week = Math.floor((date - start) / 604800000);
    const level = day.count > 0 ? Math.min(4, Math.max(1, day.level)) : 0;
    const x = fx(gx + week * step);
    const y = fx(gy + date.getUTCDay() * step);
    dots[level] += level ? `M${x} ${y}h0` : `M${x} ${fx(y + 2)}v-3.4`;
  }
  // Zero-length round-capped strokes draw each dot in a few bytes; quiet days are a blade of grass.
  // The field comes up once, grass first and full blooms last, then stays.
  const look = [["#d3dfcd", 1.3], ["#9fbd95", 3.6], ["#a8cbf4", 5], ["#7fb0ea", 6.4], ["#5b93de", 7.6]];
  const grow = (i) => `<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${fx(i * 0.15)};${fx(i * 0.15 + 0.3)};1" dur="2.4s" fill="freeze"/>`;
  dots.forEach((d, i) => d && out.push(`<path d="${d}" fill="none" stroke="${look[i][0]}" stroke-width="${look[i][1]}" stroke-linecap="round">${grow(i)}</path>`));
  // A small pale heart in each full bloom, so it reads as a flower rather than a ring.
  const heart = (d) => `<path d="${d}" fill="none" stroke="#e9f1d8" stroke-width="1.4" stroke-linecap="round"/>`;
  if (dots[4]) out.push(heart(dots[4]).replace("/>", `>${grow(4)}</path>`));
  const ly = gy + 6 * step + 28;
  out.push(text("bare ground", 470, ly + 4, { size: 12, italic: true, fill: C.muted, anchor: "end" }));
  look.forEach(([color, width], i) => out.push(`<path d="M${480 + i * 14} ${i ? ly : ly + 2}${i ? "h0" : "v-3.4"}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`));
  out.push(heart(`M536 ${ly}h0`));
  out.push(text("full bloom", 548, ly + 4, { size: 12, italic: true, fill: "#4d6fc0" }));
  const h = ly + 30;
  return { h, svg: card(h, "Chapter 5", "Concealed Mana", "Frieren the Slayer") + out.join("") };
}

function epilogue() {
  const h = 332;
  const out = [card(h, "Epilogue", "To the North", "Across the Northern Lands")];
  out.push(text("Room for one more in your party?", 40, 118, { size: 20, italic: true, fill: C.ink }));
  [["X", "@1naichii"], ["GitHub", "github.com/1naichii"]].forEach(([label, value], i) => {
    const y = 154 + i * 26;
    out.push(caps(label, 40, y), text(value, 116, y, { size: 14, fill: C.soft }));
  });
  out.push(`<rect x="40" y="202" width="330" height="1" fill="url(#ruleR)"/>`);
  out.push(text("Himmel had statues built so Frieren", 40, 229, { size: 14, italic: true, fill: C.soft }));
  out.push(text("wouldn't be alone in the future.", 40, 249.5, { size: 14, italic: true, fill: C.soft }));
  out.push(text("I write documentation for the same reason.", 40, 275, { size: 14, italic: true, fill: C.goldText }));
  out.push(text("(Need a hand? It's what Himmel the Hero would have done.)", 40, 300, { size: 12, italic: true, fill: C.muted }));

  // Himmel's statue, ivy and all (Episode 2). Now and then it brings back the man himself, toned
  // like a flashback (Season 2, Episode 2): 11 s of statue, 2 s to fade, 3 s of memory, 2 s back.
  const memory = `<image href="${ART.memory}" x="410" y="104" width="176" height="198" preserveAspectRatio="xMidYMid slice" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.611;.722;.889;1" dur="18s" ${LOOP}/></image>`;
  out.push(photo(ART.statue, 404, 98, 176, 198, { mat: 6, tilt: 2, layer: memory }));
  return { h, svg: out.join("") };
}

function profile(data) {
  const rand = seeded(1066);
  const chapters = [journal(), road(), dungeon(), grimoire(), mana(data), epilogue()];
  // Between chapters, one of the party (official chibi art) under a caption in the series' own
  // time-skip style: where and when in small capitals, then a line of narration.
  const interludes = [
    ["Central Lands · Strahl", "later, the long way north", "chibi-frieren", 50],
    ["Central Lands · a dungeon", "a detour underground", "chibi-stark", 50],
    ["Campsite, that night", "one more grimoire. Fern sulked.", "chibi-fern", 50],
    ["Granat Domain · next morning", "Fern got her up by noon", "chibi-asleep", 34],
    ["Northern Lands · 5 years after the first commit", "Himmel would have liked the view", "chibi-himmel", 50],
  ];
  const GAP = 68;
  let y = 30;
  const placed = [];
  chapters.forEach((chapter, i) => {
    placed.push(`<g transform="translate(24 ${y})">${chapter.svg}</g>`);
    y += chapter.h;
    if (i < interludes.length) {
      const [where, line, chibi, ch] = interludes[i];
      const cw = fx(ch * ASPECT[chibi]);
      const bw = Math.max(measure(where.toUpperCase(), 11, { face: "label", spacing: 1.8 }), measure(line, 12, { face: "italic" }));
      const x0 = fx(W / 2 - (cw + 14 + bw) / 2);
      const tx = x0 + cw + 14;
      const cy = y + GAP / 2 + 1;
      const asleep = chibi === "chibi-asleep";
      const ghost = chibi === "chibi-himmel";
      // Awake ones bob along; the sleeper just lets out the odd z; Himmel comes and goes, like a memory.
      const zs = asleep ? [0, 1.3].map((begin, k) => `<g opacity="0">${text("z", x0 + cw - 8 + k * 7, cy - 18 - k * 5, { size: 11 + k * 2, italic: true, fill: C.muted })}<animate attributeName="opacity" values="0;.9;0" dur="2.6s" begin="${begin}s" ${LOOP}/><animateTransform attributeName="transform" type="translate" values="0 4;3 -6" dur="2.6s" begin="${begin}s" ${LOOP}/></g>`).join("") : "";
      const motion = asleep ? "" : ghost ? `<animate attributeName="opacity" values=".5;.95;.5" dur="6s" ${EASE} ${LOOP}/>` : bob(1.5, 2.4, -i * 0.5);
      placed.push(`<g>${motion}<image href="${ART[chibi]}" x="${x0}" y="${fx(cy + 2 - ch / 2)}" width="${cw}" height="${ch}"/></g>${zs}`);
      placed.push(caps(where, tx, cy - 3, { fill: C.goldText }), text(line, tx, cy + 13, { size: 12, italic: true, fill: C.soft }));
      y += GAP;
    }
  });
  const H = y + 30;

  const defs = sharedDefs() + `
<linearGradient id="bg" x2="0" y2="1"><stop offset="0" stop-color="#dfe9dc"/><stop offset=".25" stop-color="#e5eee1"/><stop offset=".6" stop-color="#e8eee6"/><stop offset=".82" stop-color="#dfe7ee"/><stop offset="1" stop-color="#d3dde8"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="${C.teal}" stop-opacity=".22"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></radialGradient>
<radialGradient id="circleGlow"><stop offset=".55" stop-color="#9fd8ff" stop-opacity=".55"/><stop offset="1" stop-color="#9fd8ff" stop-opacity="0"/></radialGradient>
<linearGradient id="manaBar"><stop offset="0" stop-color="${C.teal}"/><stop offset=".6" stop-color="#7cc7a6"/><stop offset="1" stop-color="${C.petal}"/></linearGradient>
<radialGradient id="fade" cx=".4" cy=".35" r=".75"><stop offset=".25" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="feather" x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
<image id="magic" href="${ART.circle}" x="-30" y="-30" width="60" height="60"/>`;

  // Chapter 1's photo: where Himmel's open hand sits once the photo is taped in (tilted -3 degrees),
  // so a few petals can lift off it.
  const hand = [84.7, 180.6];
  const body = [
    sunbeams(rand, [460, 540, 620, 700, 780], 900),
    placed.join("\n"),
    handPetals(rand, hand[0], hand[1], 6),
  ].join("\n");

  return frame(H, "url(#bg)", body, defs, {
    title: "Mochaa (naichii) — a Frieren-themed travel journal",
    desc: `A Frieren-themed profile for Mochaa, a versatile software engineer, written as a travel journal that heads north, illustrated with official art (©K.Y.T.A/S/FP). Chapter 1, After the Journey's End: name, class, craft (web development and workflow automation), spec-driven development, open to collaboration, beside the official visual of Himmel and Frieren crowned with blue-moon weed, petals lifting off his hand. Chapter 2, Memories Along the Road, over the official journey map: the current full-stack role and its quests beside a still of the party heading into snowy peaks, then flashbacks of past roles back to computer engineering, numbered like the stops on the map. Chapter 3, A Chest in the Dungeon: the open-source side quest ai-engineering-starter, the official visual of Frieren head first in a mimic, an Episode 23 still of Fern pulling her out as Exhibit A, a tally of mimics against Frieren, and three magic circles from the series for chant the spec, cast the build, seal with review. Chapter 4, Useless Magic, Collected: the tech stack as six spells, each with its still from the official magic page (TypeScript, JavaScript, PHP, Python, React, Svelte, Astro, Express, Laravel, Elysia, Hono, MySQL, MongoDB, Redis, Node.js, Bun, Vite, npm, Composer, Git, Docker, Nginx). Chapter 5, Concealed Mana: GitHub activity with a ${data.current} day current streak, a ${data.longest} day longest streak and ${data.total} contributions this year, a mana bar that shows only what a demon would read until Aura weighs it on her scale, and the year drawn as a field of blue-moon weed. Epilogue, To the North: links to X and GitHub beside an Episode 2 still of Himmel's statue that now and then fades into a memory of Himmel himself. Between chapters, the party's official chibi characters with captions in the series' time-skip style.`,
  });
}

// ---------- footer.svg ----------

function footer() {
  const H = 280;
  const rand = seeded(1189);
  const defs = sharedDefs() + `
<radialGradient id="veil" cx=".5" cy=".2" r=".46"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="vignette" r=".72"><stop offset=".62" stop-color="#1d2b2a" stop-opacity="0"/><stop offset="1" stop-color="#1d2b2a" stop-opacity=".22"/></radialGradient>`;
  const tx = W / 2;
  const tag = "And so, the journey continues";
  const tagHalf = measure(tag.toUpperCase(), 11, { face: "label", spacing: 4 }) / 2 + 14;
  const line = "Well then, shall we go?";
  // The first track of the Season 2 soundtrack.
  const cue = "The Journey Continues";
  const credit = `${CREDIT} · art board: Studio Wyeth`;
  const creditW = measure(credit, 9, { face: "italic" }) + 18;
  const body = [
    `<image href="${ART.harbor}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`,
    `<rect width="${W}" height="${H}" fill="url(#veil)"/>`,
    snow(rand, 24, 0, W, -30, H + 30),
    `<rect width="${W}" height="${H}" fill="url(#vignette)"/>`,
    note(fx(652 - measure(cue, 11, { face: "italic" }) - 16), 37), text(cue, 652, 37, { size: 11, italic: true, fill: C.soft, anchor: "end" }),
    diamond(tx - tagHalf, 50, 3), diamond(tx + tagHalf, 50, 3),
    caps(tag, tx, 54, { spacing: 4, anchor: "middle", fill: "#6e4f18" }),
    text(line, tx + 1.2, 93.2, { size: 26, italic: true, fill: "#fff", opacity: 0.75, anchor: "middle" }),
    text(line, tx, 92, { size: 26, italic: true, fill: "#22343a", anchor: "middle" }),
    `<rect x="${fx(654 - creditW)}" y="${H - 34}" width="${fx(creditW)}" height="18" rx="9" fill="#1d2b2a" opacity=".42"/>`,
    text(credit, 645, H - 21, { size: 9, italic: true, fill: "#fff", anchor: "end" }),
  ].join("\n");
  return frame(H, "#f3d9c4", body, defs, {
    title: "And so, the journey continues",
    desc: "A closing card for Mochaa's Frieren-themed profile: the official art board of a village harbour on the Granz Strait at winter sunrise (painted by Studio Wyeth, ©K.Y.T.A/S/FP), with light snow falling, the music cue The Journey Continues, and the words: And so, the journey continues. Well then, shall we go?",
  });
}

// ---------- write ----------

const countAnimations = (svg) => (svg.match(/<animate(?:Transform|Motion)?\b/g) || []).length;

function compact(svg, name) {
  const result = optimize(svg, {
    multipass: true,
    js2svg: { pretty: false },
    plugins: [{
      name: "preset-default",
      // moveGroupAttrsToElems would push a group's translate down onto a child whose
      // animateTransform then replaces it, sending the bobbing characters to 0 0.
      params: { overrides: { cleanupIds: false, removeHiddenElems: false, convertShapeToPath: false, collapseGroups: false, mergePaths: false, moveGroupAttrsToElems: false, removeUnknownsAndDefaults: { keepRoleAttr: true } } },
    }],
  }).data;
  if (countAnimations(result) !== countAnimations(svg)) throw new Error(`${name}: optimizer dropped animations`);
  return result;
}

// The reading date alone is not news: when nothing else changed, keep the file (and skip a daily commit).
const withoutDate = (svg) => svg.replace(/read on \d{4}-\d{2}-\d{2}/g, "");

const data = await readMana(LOGIN);
for (const [name, raw] of [["banner.svg", banner()], ["profile.svg", profile(data)], ["footer.svg", footer()]]) {
  const svg = raw.replace(FONTS, await fontFaces(raw));
  const out = compact(svg, name);
  const url = new URL(name, ROOT);
  const previous = await readFile(url, "utf8").catch(() => "");
  if (previous && withoutDate(previous) === withoutDate(out)) {
    console.log(`${name}: unchanged apart from the date, kept`);
    continue;
  }
  await writeFile(url, out, "utf8");
  console.log(`${name}: ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
}
console.log(`@${data.login}: streak ${data.current}, longest ${data.longest}, total ${data.total}, idle ${data.idle}d`);
