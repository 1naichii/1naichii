// Builds profile.svg: one pixel-art, magical-girl themed SVG drawn top to bottom
// in a single coordinate space. Text is rendered with the bitmap fonts in
// pixel-font.mjs, sprites come from pixel-sprites.mjs, and the activity panel
// uses live GitHub data from github-data.mjs.
import { readFile, writeFile } from "node:fs/promises";
import { optimizeSvg } from "./svg-optimizer.mjs";
import { fonts, hasGlyph, textPath, textWidth } from "./pixel-font.mjs";
import { loadGitHubActivity, today } from "./github-data.mjs";
import {
  heroine, heroineKeys, incubator, incubatorKeys, miniGem, palette as c, petal, petalKeys,
  ribbon, ribbonKeys, gemKeys, soulGem, sparkle, sparkleKeys, sprite,
} from "./pixel-sprites.mjs";

const username = process.argv[2] || process.env.GITHUB_USERNAME || "1naichii";
const root = new URL("../", import.meta.url);
const W = 680;
const PANEL_X = 20;
const PANEL_W = 640;
const GAP = 44;

// ---------- primitives ----------

const dataUri = (content, type) => `data:${type};base64,${Buffer.from(content).toString("base64")}`;
const rect = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const snap = (value, unit = 2) => Math.round(value / unit) * unit;

/** Pixel text. `font` is "small" (3x5 body) or "large" (5x7 headings). */
const text = (value, x, y, fill, { scale = 2, font = "small" } = {}) => `<path fill="${fill}" d="${textPath(value, x, y, scale, font)}"/>`;
const centered = (value, cx, y, fill, options = {}) => text(value, snap(cx - textWidth(value, options.scale, options.font) / 2, options.scale || 2), y, fill, options);
const rightAligned = (value, right, y, fill, options = {}) => text(value, right - textWidth(value, options.scale, options.font), y, fill, options);

/** Text made of [string, colour] runs that share one baseline. */
function runs(parts, x, y, { scale = 2, font = "small" } = {}) {
  let cursor = x;
  return parts.map(([value, fill]) => {
    const out = value.trim() ? text(value, cursor, y, fill, { scale, font }) : "";
    cursor += textWidth(value, scale, font) + (fonts[font].advance - fonts[font].width) * scale;
    return out;
  }).join("");
}

/** Rectangle with notched pixel corners. */
function stepped(x, y, w, h, s = 4) {
  return `M${x + 2 * s} ${y}H${x + w - 2 * s}V${y + s}H${x + w - s}V${y + 2 * s}H${x + w}V${y + h - 2 * s}H${x + w - s}V${y + h - s}H${x + w - 2 * s}V${y + h}H${x + 2 * s}V${y + h - s}H${x + s}V${y + h - 2 * s}H${x}V${y + 2 * s}H${x + s}V${y + s}H${x + 2 * s}Z`;
}

/** Window-style panel with a name tab, drawn in panel-local coordinates. */
function panel(h, tab, accent = c.pink) {
  const tabW = textWidth(tab) + 34;
  return [
    `<path fill="${c.outline}" d="${stepped(6, 6, PANEL_W, h)}"/>`,
    `<path fill="${accent}" d="${stepped(0, 0, PANEL_W, h)}"/>`,
    `<path fill="${c.outline}" d="${stepped(4, 4, PANEL_W - 8, h - 8)}"/>`,
    `<path fill="${c.ink}" d="${stepped(6, 6, PANEL_W - 12, h - 12, 2)}"/>`,
    rect(14, 8, PANEL_W - 28, 2, c.white, ' fill-opacity=".12"'),
    `<path fill="${c.outline}" d="${stepped(20, -12, tabW + 4, 24, 2)}"/>`,
    `<path fill="${accent}" d="${stepped(22, -10, tabW, 20, 2)}"/>`,
    text("◆", 32, -5, c.night),
    text(tab, 46, -5, c.night),
  ].join("");
}

/** Small labelled chip with a pixel border. */
function chip(label, x, y, color, fill = c.plum, ink = color) {
  const w = textWidth(label) + 20;
  return { width: w, svg: `<path fill="${color}" d="${stepped(x, y, w, 20, 2)}"/><path fill="${fill}" d="${stepped(x + 2, y + 2, w - 4, 16, 2)}"/>${text(label, x + 10, y + 5, ink)}` };
}

function chips(items, x, y, gap = 8) {
  let cursor = x;
  return items.map(([label, color]) => {
    const { width, svg } = chip(label, cursor, y, color);
    cursor += width + gap;
    return svg;
  }).join("");
}

const blink = (dur = "1s", begin = "0s") => `<animate attributeName="opacity" values="1;0" dur="${dur}" begin="${begin}" calcMode="discrete" repeatCount="indefinite"/>`;

/** Discrete hop through translate offsets, for sprite-style motion. */
const hop = (values, dur, begin = "0s") => `<animateTransform attributeName="transform" type="translate" additive="sum" values="${values}" dur="${dur}" begin="${begin}" calcMode="discrete" repeatCount="indefinite"/>`;

// Clip paths for typewriter reveals, collected into <defs>.
const clipDefs = [];
/** Reveals `content` left to right between `start` and `end` (fractions of `dur`), holds, then resets. */
function typed(id, content, x, y, w, h, start, end, dur) {
  clipDefs.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="0" height="${h}"><animate attributeName="width" values="0;0;${w};${w};0" keyTimes="0;${start.toFixed(4)};${end.toFixed(4)};0.94;1" dur="${dur}s" repeatCount="indefinite"/></rect></clipPath>`);
  return `<g clip-path="url(#${id})">${content}</g>`;
}

// Deterministic pseudo-random numbers so daily rebuilds only change the data that changed.
function random(seed) {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const pinkGem = gemKeys(c.pink, c.rose, c.blush);

// ---------- assets ----------

/** Replaces one piece of icon markup, failing loudly if the upstream icon changed shape. */
function patchIcon(svg, from, to, url) {
  const patched = svg.replace(from, to);
  if (patched === svg) throw new Error(`${url}: icon markup changed, patch did not apply`);
  return patched;
}

async function remoteIcon(url, attempts = 3) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    // Swap the icons' slate tile for plum so the arsenal stays pink.
    let svg = (await response.text()).replaceAll("#242938", "#5c2449");
    // The MySQL dolphin is a hairline outline that the 2px grid drops; stroke it so every line covers whole cells.
    if (/i=mysql&/.test(url)) svg = patchIcon(svg, 'fill="#fff" fill-rule="evenodd"', 'fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round" fill-rule="evenodd"', url);
    // The Elysia logo is greys (plus two near-flat grey gradients) that blur into one blob on the plum tile; recolour it as a pink ramp.
    if (/i=elysia&/.test(url)) {
      for (const [from, to] of [[/fill="#333333"/g, c.berry], [/fill="#666666"/g, c.rose], [/fill="#999999"/g, c.pink], [/fill="#CCCCCC"/g, c.white], [/fill="url\(#paint[01]_linear_\w+\)"/g, c.rose]]) {
        svg = patchIcon(svg, from, `fill="${to}"`, url);
      }
    }
    return dataUri(optimizeSvg(svg), "image/svg+xml");
  } catch (error) {
    if (attempts <= 1) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return remoteIcon(url, attempts - 1);
  }
}

const skillIcons = (ids) => ids.map((id) => `https://skillicons.dev/icons?i=${id}&theme=dark`);
const goSkillIcons = (ids) => ids.map((id) => `https://go-skill-icons.vercel.app/api/icons?i=${id}&theme=dark`);
const stack = [
  { label: "SPELLS / LANGUAGES", urls: skillIcons(["ts", "js", "php", "py"]) },
  { label: "CHARMS / FRONTEND", urls: skillIcons(["react", "svelte", "astro"]) },
  { label: "WANDS / BACKEND", urls: goSkillIcons(["express", "laravel", "elysia", "hono"]) },
  { label: "VAULTS / SQL, NOSQL & CACHE", urls: goSkillIcons(["mysql", "mongodb", "redis"]) },
  { label: "MAGIC CIRCLE / TOOLING", urls: [...skillIcons(["nodejs", "bun", "vite", "npm"]), ...goSkillIcons(["composer"])] },
  { label: "FAMILIARS / DEV & DEPLOY", urls: skillIcons(["git", "docker", "nginx"]) },
];

// One request at a time: the icon services reset bursts of parallel connections.
async function loadIcons() {
  const groups = [];
  for (const { urls } of stack) {
    const group = [];
    for (const url of urls) group.push(await remoteIcon(url));
    groups.push(group);
  }
  return groups;
}

/** Retries flaky network work (connection resets mid-body are common on CI and locally). */
async function retry(work, attempts = 3) {
  try {
    return await work();
  } catch (error) {
    if (attempts <= 1) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return retry(work, attempts - 1);
  }
}

const [gif, activity, icons] = await Promise.all([
  readFile(new URL("pixel-transformation.gif", root)).then((content) => dataUri(content, "image/gif")),
  retry(() => loadGitHubActivity(username)),
  loadIcons(),
]);

// Soul gem purity drops 15% for every day without a contribution.
const purity = Number.isFinite(activity.idle) ? Math.max(0, 100 - activity.idle * 15) : 0;

// ---------- sections (each returns its height and panel-local markup) ----------

function header() {
  const h = 168;
  const out = [panel(h, "MAGICAL GIRL ID", c.hot)];

  // Shooting star crossing the sky every few seconds.
  out.push(`<g opacity="0">${rect(0, 0, 8, 2, c.white)}${rect(-8, 0, 8, 2, c.blush, ' fill-opacity=".6"')}${rect(-16, 0, 8, 2, c.pink, ' fill-opacity=".3"')}<animateTransform attributeName="transform" type="translate" values="260 18;400 38" dur="7s" keyTimes="0;.12" calcMode="linear" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" keyTimes="0;.12" dur="7s" calcMode="discrete" repeatCount="indefinite"/></g>`);

  out.push(text("MOCHAA", 32, 40, c.pink, { scale: 5, font: "large" }));
  out.push(runs([["a.k.a.", c.muted], ["naichii", c.blush], ["·", c.muted], ["1naichii", c.blush]].flatMap((part, i) => (i ? [[" ", c.muted], part] : [part])), 32, 98));
  out.push(text("VERSATILE SOFTWARE ENGINEER", 32, 122, c.white, { font: "large" }));

  // The heroine herself, bobbing in place, with a twinkle beside her.
  out.push(`<g>${sprite(heroine, heroineKeys, 488, 38, 4)}${hop("0 0;0 -3;0 -5;0 -3", "2.4s")}</g>`);
  [[452, 34, c.blush, "0s"], [600, 130, c.sakura, "1.2s"]].forEach(([x, y, color, begin]) => {
    out.push(`<g>${sprite(sparkle, sparkleKeys(color), x, y, 2)}${blink("2.4s", begin)}</g>`);
  });
  return { h, svg: out.join("") };
}

function contract() {
  const h = 246;
  const out = [panel(h, "THE CONTRACT", c.blush)];

  out.push(`<path fill="${c.blush}" d="${stepped(24, 24, 88, 88)}"/><path fill="${c.plum}" d="${stepped(28, 28, 80, 80)}"/>`);
  out.push(`<g>${sprite(incubator, incubatorKeys, 36, 32, 4)}${hop("0 0;0 0;0 -4;0 0", "3s")}</g>`);
  // It blinks, slowly. It never stops smiling.
  out.push(`<g opacity="0">${[48, 80].map((x) => rect(x, 56, 8, 8, c.white) + rect(x, 62, 8, 2, c.outline)).join("")}${hop("0 0;0 0;0 -4;0 0", "3s")}<animate attributeName="opacity" values="0;1;0" keyTimes="0;.9;.96" dur="4s" calcMode="discrete" repeatCount="indefinite"/></g>`);
  out.push(`<path fill="${c.blush}" d="${stepped(44, 100, 48, 20, 2)}"/>`, centered("???", 68, 107, c.night));

  const lines = ['"Make a contract with me,', 'and become a magical engineer!"'];
  lines.forEach((line, i) => out.push(typed(`dialog-${i}`, text(line, 136, 36 + i * 26, c.white, { font: "large" }), 136, 32 + i * 26, textWidth(line, 2, "large"), 24, i * 0.25, (i + 1) * 0.25, 8)));
  // The ▶ prompt waits for line 2 to finish typing, blinks through the hold, and hides again at the reset.
  const holdTimes = [0];
  for (let t = 0.5; t < 0.94; t += 0.05) holdTimes.push(t);
  holdTimes.push(0.94);
  const holdValues = holdTimes.map((t, i) => (i && i < holdTimes.length - 1 && (i - 1) % 2 === 0 ? 1 : 0));
  out.push(`<g opacity="0">${text("▶", 136 + textWidth(lines[1], 2, "large") + 10, 64, c.hot)}<animate attributeName="opacity" values="${holdValues.join(";")}" keyTimes="${holdTimes.map((t) => t.toFixed(2)).join(";")}" dur="8s" calcMode="discrete" repeatCount="indefinite"/></g>`);
  out.push(text("* terms and conditions: not disclosed.", 136, 96, c.muted));

  out.push(`<path fill="${c.plum}" d="${stepped(24, 140, 592, 86, 2)}"/>`);
  const terms = [["CLASS", "Versatile Software Engineer", c.white], ["ELEMENT", "Web development & workflow automation", c.white], ["WISH", "Open to collaboration", c.hot]];
  const valueX = 56 + Math.max(...terms.map(([label]) => textWidth(label))) + textWidth(" ...... ") + 2;
  terms.forEach(([label, value, color], i) => {
    const y = 154 + i * 24;
    out.push(text(label, 56, y, c.pink), rightAligned("......", valueX - 8, y, c.muted), text(value, valueX, y, color));
  });
  out.push(`<g>${text("▶", 40, 154, c.hot)}${hop("0 0;0 24;0 48", "3s")}</g>`);
  return { h, svg: out.join("") };
}

function transformation() {
  const h = 372;
  const out = [panel(h, "TRANSFORMATION!", c.pink)];
  out.push(`<path fill="${c.hot}" d="${stepped(42, 22, 556, 319)}"/><path fill="${c.outline}" d="${stepped(46, 26, 548, 311)}"/>`);
  // Drawn at the GIF's native 540x303 so no row is resampled.
  out.push(`<image href="${gif}" x="50" y="30" width="540" height="303" preserveAspectRatio="none" style="image-rendering:pixelated"/>`);
  [[38, 18], [588, 18], [38, 327], [588, 327]].forEach(([x, y]) => out.push(sprite(miniGem, pinkGem, x, y, 2)));
  // Sparkle bursts popping around the frame.
  [[22, 60, "0s"], [608, 120, ".7s"], [22, 250, "1.4s"], [608, 290, "2.1s"]].forEach(([x, y, begin]) => {
    out.push(`<g opacity="0">${sprite(sparkle, sparkleKeys(c.sakura), x, y, 2)}<animate attributeName="opacity" values="0;1;0" keyTimes="0;.1;.3" dur="2.8s" begin="${begin}" calcMode="discrete" repeatCount="indefinite"/></g>`);
  });
  out.push(centered("★ A WISH STRONG ENOUGH TO REWRITE FATE ★", 320, 350, c.blush));
  return { h, svg: out.join("") };
}

function bio() {
  const lines = [
    "#include <soul_gem.h>",
    "",
    "struct magical_girl mochaa = {",
    '  .class = "Versatile Software Engineer",',
    '  .element = "Web dev & workflow automation",',
    '  .ritual = "Spec-Driven Development",',
    '  .spells = {"REST APIs", "Bots", "Cron jobs"},',
    '  .off_duty = "Watching cozy anime",',
    "};",
    "",
    "/* looks cute. always read the fine print. */",
  ];
  const codeX = 60;
  const maxW = PANEL_W - 24 - codeX;
  const tooWide = lines.find((line) => textWidth(line) > maxW);
  if (tooWide) throw new Error(`bio line is wider than ${maxW}px: ${tooWide}`);

  const top = 30;
  const step = 20;
  const statusY = top + lines.length * step + 8;
  const h = statusY + 30;
  const out = [panel(h, "GRIMOIRE.C", c.hot)];
  out.push(rect(8, 18, 40, statusY - 20, c.outline, ' fill-opacity=".6"'));

  // Typing animation: each line types in turn, holds, then resets.
  const per = 0.55;
  const dur = Math.round(lines.length * per + 8);
  lines.forEach((line, i) => {
    const y = top + i * step;
    out.push(rightAligned(String(i + 1), 38, y, c.muted));
    if (line) out.push(typed(`line-${i}`, runs(highlight(line), codeX, y), codeX, y - 4, textWidth(line), step, i * per / dur, (i + 1) * per / dur, dur));
  });

  out.push(rect(8, statusY, PANEL_W - 16, 20, c.rose, ' fill-opacity=".4"'));
  out.push(text(`main   C   UTF-8   ♥ purity: ${purity}%`, 18, statusY + 7, c.sakura));
  out.push(`<g>${rect(614, statusY + 6, 8, 8, c.hot)}${blink("1.2s")}</g>`);
  return { h, svg: out.join("") };
}

/** Tiny C highlighter: comments, strings, keywords, headers, designators, punctuation. */
function highlight(line) {
  const tokens = [];
  const pattern = /(\/\*.*?\*\/)|("[^"]*")|(#include|static|const|struct|char)\b|(<[^>]+>)|(\.[a-z_]+)|([A-Za-z_]+)|(\s+)|(.)/g;
  for (const match of line.matchAll(pattern)) {
    const [value, comment, string, keyword, header, field, word] = match;
    const color = comment ? c.muted : string ? c.blush : keyword ? c.hot : header ? c.gold : field ? c.lilac : word ? c.white : c.mist;
    tokens.push([value, color]);
  }
  return tokens;
}

function currentArc() {
  const missions = ["Modernize an internal web app", "Summon bots for recurring operations", "Purify automation & cron jobs"];
  const top = 120;
  const step = 44;
  // Last bar ends 24px below its label; leave 30px under it.
  const h = top + (missions.length - 1) * step + 24 + 30;
  const out = [panel(h, "CURRENT ARC", c.blush)];
  out.push(text("★ ARC 04 · SINCE AUG 2026", 32, 28, c.pink));
  out.push(text("FULL-STACK ENGINEER", 32, 48, c.white, { font: "large" }));
  out.push(text("on assignment for an enterprise client", 32, 78, c.muted));

  missions.forEach((mission, i) => {
    const y = top + i * step;
    out.push(sprite(miniGem, pinkGem, 32, y - 2, 2));
    out.push(text(mission, 54, y, c.mist));
    // Charging bar: fills in 8px steps, then starts over.
    const steps = Array.from({ length: 70 }, (_, n) => n * 8).join(";");
    out.push(rect(54, y + 20, 552, 4, c.outline), `<rect x="54" y="${y + 20}" width="0" height="4" fill="${[c.hot, c.pink, c.blush][i]}"><animate attributeName="width" values="${steps}" dur="${6 + i}s" calcMode="discrete" repeatCount="indefinite"/></rect>`);
  });

  out.push(`<g>${rightAligned("▶ ONGOING", 608, 28, c.hot)}${blink("1s")}</g>`);
  return { h, svg: out.join("") };
}

function battleLog() {
  const entries = [
    ["NOW", "FULL-STACK ENGINEER · ENTERPRISE CLIENT", true],
    ["2026", "FREELANCE FULL-STACK · AI SECURITY PLATFORM"],
    ["2025", "FREELANCE BACKEND · NEWS PLATFORM"],
    ["2025", "BACKEND INTERN"],
    ["2024-25", "LAB, TEACHING & RESEARCH ASSISTANT"],
    ["2024", "TRAINING ARC · FULL-STACK BOOTCAMP"],
    ["2021-25", "ORIGIN ARC · COMPUTER ENGINEERING"],
  ];
  const step = 30;
  const h = 40 + entries.length * step;
  const out = [panel(h, "BATTLE LOG", c.pink)];
  out.push(rect(117, 36, 2, (entries.length - 1) * step, c.pink, ' fill-opacity=".4"'));
  const tagX = 608 - Math.max(textWidth("▶ ONGOING"), textWidth("CLEARED ♥")) - 16;
  entries.forEach(([when, title, ongoing], i) => {
    const y = 32 + i * step;
    if (136 + textWidth(title) > tagX) throw new Error(`battle log line runs into its tag: ${title}`);
    out.push(rightAligned(when, 96, y, ongoing ? c.hot : c.muted));
    const gem = sprite(miniGem, ongoing ? pinkGem : gemKeys(c.berry, "#6b2352", c.muted), 111, y - 4, 2);
    out.push(ongoing ? `<g>${gem}${hop("0 0;0 -2;0 0", "1s")}</g>` : gem);
    out.push(text(title, 136, y, ongoing ? c.white : c.mist));
    out.push(ongoing ? `<g>${rightAligned("▶ ONGOING", 608, y, c.hot)}${blink("1s")}</g>` : rightAligned("CLEARED ♥", 608, y, c.rose));
  });
  return { h, svg: out.join("") };
}

function sideQuests() {
  const [boxX, boxW, labelX] = [448, 160, 482];
  const blurb = ["A practical starter for building", "reliable AI software."];
  const tags = [["SPEC-DRIVEN", c.hot], ["MULTI-AGENT", c.pink], ["MIT", c.blush]];
  const blurbY = 80;
  const chipsY = blurbY + blurb.length * 20 + 8;
  const statusY = chipsY + 40;
  const h = statusY + 34;

  // Every left-column line must stay clear of the spell chain.
  const left = [
    ["ai-engineering-starter", textWidth("ai-engineering-starter", 2, "large")],
    ...blurb.map((line) => [line, textWidth(line)]),
    [tags.map(([label]) => label).join(" "), tags.reduce((sum, [label]) => sum + textWidth(label) + 28, -8)],
  ];
  const tooWide = left.find(([, width]) => 32 + width > boxX - 24);
  if (tooWide) throw new Error(`side quest line runs into the spell chain: ${tooWide[0]}`);

  const out = [panel(h, "SIDE QUEST", c.rose)];
  out.push(text("★ OPEN-SOURCE QUEST", 32, 28, c.pink));
  out.push(text("ai-engineering-starter", 32, 48, c.white, { font: "large" }));
  blurb.forEach((line, i) => out.push(text(line, 32, blurbY + i * 20, c.mist)));
  out.push(chips(tags, 32, chipsY));
  // Only the ▶ blinks; the status itself stays readable.
  const arrowX = 32 + textWidth("STATUS: ");
  out.push(text("STATUS:", 32, statusY, c.blush), `<g>${text("▶", arrowX, statusY, c.hot)}${blink("1s")}</g>`, text("IN PROGRESS", arrowX + textWidth("▶ "), statusY, c.hot));

  out.push(text("SPELL CHAIN", boxX, 28, c.pink));
  const boxY = (i) => 48 + i * 46;
  out.push(rect(462, boxY(0) + 16, 4, boxY(2) - boxY(0), c.pink, ' fill-opacity=".35"'));
  const markerX = boxX + boxW - 10 - textWidth("◆");
  [["CHANT: SPEC", c.hot], ["CAST: BUILD", c.pink], ["SEAL: REVIEW", c.blush]].forEach(([label, color], i) => {
    if (labelX + textWidth(label) > markerX - 6) throw new Error(`spell chain label runs into its marker: ${label}`);
    const y = boxY(i);
    out.push(`<path fill="${color}" d="${stepped(boxX, y, boxW, 30, 2)}"/><path fill="${c.plum}" d="${stepped(boxX + 2, y + 2, boxW - 4, 26, 2)}"/>`);
    out.push(sprite(miniGem, pinkGem, 458, y + 7, 2));
    out.push(text(label, labelX, y + 10, c.white));
    out.push(`<g>${text("◆", markerX, y + 10, color)}<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;${(i / 3).toFixed(3)};${((i + 1) / 3).toFixed(3)};1" dur="3s" calcMode="discrete" repeatCount="indefinite"/></g>`);
  });
  return { h, svg: out.join("") };
}

function arsenal() {
  const h = 290;
  const out = [panel(h, "MAGIC ARSENAL", c.rose)];
  const placements = [[32, 28], [332, 28], [32, 112], [332, 112], [32, 196], [332, 196]];
  const slots = [];
  placements.forEach(([x, y], index) => {
    if (textWidth(stack[index].label) > 284) throw new Error(`arsenal label runs into its neighbour: ${stack[index].label}`);
    out.push(text(stack[index].label, x, y, c.blush));
    icons[index].forEach((icon, i) => {
      const slotX = x + i * 52;
      const slotY = y + 18;
      slots.push([slotX, slotY]);
      out.push(`<path fill="${c.rose}" fill-opacity=".7" d="${stepped(slotX, slotY, 46, 46, 2)}"/><path fill="${c.sakura}" fill-opacity=".14" d="${stepped(slotX + 2, slotY + 2, 42, 42, 2)}"/>`);
      const filter = /i=(express|laravel)&/.test(stack[index].urls[i]) ? "pixelate-bold" : "pixelate-fine";
      out.push(`<g transform="translate(${slotX + 2} ${slotY + 2})"><image href="${icon}" width="42" height="42" filter="url(#${filter})"/></g>`);
    });
  });
  // Selection cursor hopping from slot to slot, like an inventory screen.
  const cursor = `<path fill="${c.white}" fill-rule="evenodd" d="${stepped(-2, -2, 50, 50, 2)}${stepped(0, 0, 46, 46, 2)}"/>`;
  out.push(`<g>${cursor}${hop(slots.map(([x, y]) => `${x} ${y}`).join(";"), `${slots.length * 0.7}s`)}</g>`);
  return { h, svg: out.join("") };
}

function status() {
  const h = 352;
  const out = [panel(h, "SOUL GEM STATUS", c.pink)];
  const name = [...activity.name].filter((char) => hasGlyph(char, "large")).join("") || activity.login;

  out.push(`<path fill="${c.pink}" d="${stepped(24, 24, 74, 74)}"/>`);
  out.push(`<g transform="translate(28 28)"><image href="${activity.avatar}" width="66" height="66" filter="url(#pixelate-avatar)"/></g>`);
  out.push(text(name, 116, 28, c.white, { font: "large" }));
  out.push(text(`@${activity.login} / activity.log`, 116, 52, c.pink));
  out.push(runs([["♥ ", c.hot], [`updated ${today}`, c.muted]], 116, 68));
  const repos = `${activity.repositories} REPOS`;
  const followers = `${activity.followers} FOLLOWERS`;
  const chipsW = textWidth(repos) + textWidth(followers) + 48;
  out.push(chips([[repos, c.blush], [followers, c.blush]], 616 - chipsW, 24));

  const days = (n) => (n === 1 ? "DAY" : "DAYS");
  const stats = [["TRANSFORM STREAK", activity.streaks.current, days(activity.streaks.current)], ["LONGEST BATTLE", activity.streaks.longest, days(activity.streaks.longest)], ["SPELLS / YEAR", activity.total, "CONTRIBUTIONS"]];
  stats.forEach(([label, value, suffix], i) => {
    const x = 24 + i * 204;
    out.push(`<path fill="${c.berry}" d="${stepped(x, 110, 184, 78, 2)}"/><path fill="${c.plum}" d="${stepped(x + 2, 112, 180, 74, 2)}"/>`);
    out.push(centered(label, x + 92, 121, c.pink));
    out.push(centered(String(value), x + 92, 139, c.white, { font: "large", scale: 3 }));
    out.push(centered(suffix, x + 92, 168, c.muted));
  });

  // Soul gem purity: clouds over as days pass without a contribution.
  const mood = purity >= 70 ? ["RADIANT", c.hot] : purity >= 40 ? ["CLOUDING", c.pink] : purity > 0 ? ["DARKENING", c.berry] : ["WITCHING HOUR", c.muted];
  const clouded = purity >= 70 ? [c.pink, c.rose, c.blush] : purity >= 40 ? [c.berry, "#6b2352", c.muted] : ["#4a2140", "#2a0f22", "#6e4a62"];
  out.push(`<g>${sprite(soulGem, gemKeys(...clouded), 24, 200, 2)}${hop("0 0;0 -2;0 0;0 0", "2s")}</g>`);
  // Purity bar, calendar and legend share one column: 64 to EDGE, with 2px gaps throughout.
  const EDGE = 582;
  out.push(text("SOUL GEM PURITY", 64, 206, c.white));
  const reading = `${mood[0]} ${purity}%`;
  out.push(runs([[`${mood[0]} `, mood[1]], [`${purity}%`, c.white]], EDGE - textWidth(reading), 206));
  const lit = Math.round(purity / 5);
  for (let i = 0; i < 20; i++) out.push(rect(64 + i * 26, 220, 24, 10, i < lit ? (i < 7 ? c.rose : i < 14 ? c.hot : c.blush) : c.outline));
  // A glimmer runs along the lit part of the bar.
  if (lit) out.push(`<g>${rect(64, 220, 24, 10, c.white, ' fill-opacity=".45"')}${hop(Array.from({ length: lit }, (_, i) => `${i * 26} 0`).join(";"), `${(lit * 0.12).toFixed(2)}s`)}</g>`);

  // Contribution calendar, despair to hope.
  const levels = ["#4a1d3d", "#6b2352", "#a8336f", "#ff5fa2", "#ffc2dc"];
  const end = new Date(`${today}T00:00:00Z`);
  const gridStart = new Date(end);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay() - 51 * 7);
  const from = gridStart.toISOString().slice(0, 10);
  const cells = activity.contributions.filter(({ date }) => date >= from && date <= today).map((day) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const week = Math.floor((date - gridStart) / 604800000);
    const level = day.count > 0 ? Math.max(1, Math.min(Number(day.level) || 0, 4)) : 0;
    return rect(64 + week * 10, 250 + date.getUTCDay() * 10, 8, 8, levels[level]);
  });
  out.push(`<g>${cells.join("")}</g>`);
  const hope = EDGE - textWidth("HOPE");
  out.push(rightAligned("DESPAIR", hope - 72, 326, c.muted), text("HOPE", hope, 326, c.hot));
  levels.forEach((fill, i) => out.push(rect(hope - 64 + i * 12, 326, 8, 8, fill)));
  return { h, svg: out.join("") };
}

function connect() {
  const h = 150;
  const out = [panel(h, "JOIN THE TEAM", c.hot)];
  out.push(runs([["LET'S MAKE SOMETHING ", c.white], ["MAGICAL.", c.hot]], 32, 30, { font: "large" }));
  [["X", "@1naichii"], ["GITHUB", "github.com/1naichii"]].forEach(([label, value], i) => {
    out.push(text(label, 32, 62 + i * 20, c.pink), text(value, 32 + textWidth("GITHUB") + 16, 62 + i * 20, c.blush));
  });
  out.push(`<g>${sprite(ribbon, ribbonKeys, 552, 26, 3)}${hop("0 0;0 -3;0 0;0 0", "1.8s")}</g>`);
  out.push(`<path fill="${c.plum}" d="${stepped(24, 106, 592, 26, 2)}"/>`);
  out.push(centered('"wish with intention, ship with confidence."', 320, 114, c.blush));
  return { h, svg: out.join("") };
}

// ---------- assemble ----------

const sections = [header(), contract(), transformation(), bio(), currentArc(), battleLog(), sideQuests(), arsenal(), status(), connect()];
let y = 30;
const placed = sections.map((section) => {
  const at = y;
  y += section.h + GAP;
  return { ...section, y: at };
});
const footerY = y - GAP + 20;
const H = footerY + 28;

// Twinkling sparkles in the gutters between panels, pixel dust down both margins.
// Each sparkle gets its own lane right of the widest panel tab (which pokes up into the gutter), so they never touch.
const SPARKLE_LANES = { x: 216, w: 136, jitter: 108 };
const rand = random(1066);
const stars = [];
placed.slice(0, -1).forEach(({ y: top, h }) => {
  for (let i = 0; i < 3; i++) {
    const x = snap(SPARKLE_LANES.x + i * SPARKLE_LANES.w + rand() * SPARKLE_LANES.jitter);
    const color = [c.blush, c.pink, c.sakura, c.white][i];
    stars.push(`<g>${sprite(sparkle, sparkleKeys(color), x, top + h + 14 + snap(rand() * 8), 2)}${blink(`${(2 + rand() * 2).toFixed(1)}s`, `${(rand() * 2).toFixed(1)}s`)}</g>`);
  }
});
for (let yy = 40; yy < H - 40; yy += 46) {
  stars.push(rect(snap(6 + rand() * 6), snap(yy + rand() * 30), 2, 2, c.blush, ` fill-opacity="${(0.3 + rand() * 0.5).toFixed(2)}"`));
  stars.push(rect(snap(666 + rand() * 6), snap(yy + rand() * 30), 2, 2, c.pink, ` fill-opacity="${(0.3 + rand() * 0.5).toFixed(2)}"`));
}

// Petals drifting down the margins and through the gutters, behind the panels.
const petals = Array.from({ length: 14 }, (_, i) => {
  const x = i % 2 ? snap(664 + rand() * 6) : snap(6 + rand() * 6);
  const fall = 18 + rand() * 14;
  const sway = Array.from({ length: 12 }, (_, n) => `${n % 2 ? 2 : 0} ${snap((n / 11) * (H + 20)) - 20}`).join(";");
  return `<g>${sprite(petal, petalKeys, x, 0, 2)}${hop(sway, `${fall.toFixed(1)}s`, `${(-rand() * fall).toFixed(1)}s`)}</g>`;
});

// 2px pixelate: sample the top-left pixel of each 2x2 cell, then smear it right and down. `pre` may thicken thin strokes first.
const fineGrid = (id, pre = "") => `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">${pre}<feFlood width="1" height="1"/><feComposite width="2" height="2"/><feTile result="grid"/><feComposite in="${pre ? "source" : "SourceGraphic"}" in2="grid" operator="in" result="dots"/><feOffset dx="1" result="right"/><feMerge result="row"><feMergeNode in="dots"/><feMergeNode in="right"/></feMerge><feOffset dy="1" result="down"/><feMerge><feMergeNode in="row"/><feMergeNode in="down"/></feMerge></filter>`;
// The avatar is pale line-art: erode (darkest neighbour wins) so hairline strokes survive the grid, then deepen the midtones.
const deepen = ["R", "G", "B"].map((ch) => `<feFunc${ch} type="gamma" exponent="2"/>`).join("");
const avatarPre = `<feMorphology operator="erode" radius=".5"/><feComponentTransfer result="source">${deepen}</feComponentTransfer>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title description" shape-rendering="crispEdges">
<title id="title">Mochaa (naichii) — magical girl software engineer</title>
<desc id="description">A pink pixel-art magical girl profile for Mochaa, also known as naichii and 1naichii, a versatile software engineer working on web development and workflow automation: a contract dialog, a transformation GIF, an animated C grimoire, the current arc, a battle log of past roles, a side quest (an open-source AI engineering starter), a technology arsenal, a GitHub soul gem status with ${activity.streaks.current} day current streak, ${activity.streaks.longest} day longest streak and ${activity.total} yearly contributions, and links to X and GitHub.</desc>
<defs>
<pattern id="dither" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${c.plum}"/><rect x="4" y="4" width="2" height="2" fill="${c.plum}" fill-opacity=".5"/></pattern>
${fineGrid("pixelate-fine")}${fineGrid("pixelate-bold", '<feMorphology operator="dilate" radius=".5" result="source"/>')}${fineGrid("pixelate-avatar", avatarPre)}
${clipDefs.join("")}
</defs>
<rect width="${W}" height="${H}" fill="${c.night}"/>
<rect width="${W}" height="${H}" fill="url(#dither)" fill-opacity=".5"/>
${petals.join("")}
<path fill="${c.hot}" fill-rule="evenodd" d="${stepped(0, 0, W, H)}${stepped(4, 4, W - 8, H - 8)}"/>
${stars.join("")}
${placed.map((section) => `<g transform="translate(${PANEL_X} ${section.y})">${section.svg}</g>`).join("\n")}
${centered("♥ MADE WITH HOPE, NOT DESPAIR ♥", W / 2, footerY, c.muted)}
</svg>`;

const optimized = optimizeSvg(svg);
await writeFile(new URL("profile.svg", root), optimized, "utf8");
console.log(`Generated profile.svg (${W}x${H}, ${Buffer.byteLength(optimized)} bytes) for @${activity.login}: current ${activity.streaks.current}, longest ${activity.streaks.longest}, total ${activity.total}, idle ${activity.idle}d`);
