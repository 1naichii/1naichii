// Hand-placed pixel sprites. Each row is a string of palette keys, "." is transparent.

export const palette = {
  night: "#1f0b19",
  ink: "#33132a",
  plum: "#4a1b3d",
  outline: "#170712",
  pink: "#ff8ec6",
  hot: "#ff5fa2",
  rose: "#e0478f",
  berry: "#a8336f",
  blush: "#ffc2dc",
  sakura: "#ffe0ee",
  white: "#fff4fa",
  mist: "#f6d9e8",
  muted: "#c98aab",
  lilac: "#d9a0f0",
  violet: "#9a4f9e",
  gold: "#ffd66b",
  amber: "#c9963b",
  red: "#e3263d",
  blue: "#5fa8ff",
  yellow: "#ffe27a",
  crimson: "#ff5a5a",
};

/** Draws a sprite as merged horizontal runs, one <path> per colour. */
export function sprite(rows, keys, x, y, scale = 4, extra = "") {
  const width = rows[0].length;
  rows.forEach((row, index) => {
    if (row.length !== width) throw new Error(`pixel-sprites: row ${index} is ${row.length} wide, expected ${width}`);
  });
  const paths = {};
  rows.forEach((row, rowIndex) => {
    for (const match of row.matchAll(/([^.])\1*/g)) {
      const key = match[1];
      if (!keys[key]) throw new Error(`pixel-sprites: no colour for "${key}"`);
      paths[key] = (paths[key] || "") + `M${x + match.index * scale} ${y + rowIndex * scale}h${match[0].length * scale}v${scale}h-${match[0].length * scale}z`;
    }
  });
  return `<g${extra}>${Object.entries(paths).map(([key, d]) => `<path fill="${keys[key]}" d="${d}"/>`).join("")}</g>`;
}

/** Mirrors left halves into symmetric rows; `mid` repeats the centre column when the width is odd. */
export const mirror = (rows, mid = false) => rows.map((row) => row + [...row].reverse().join("").slice(mid ? 1 : 0));

// Soul gem: gold crown, egg-shaped gem, highlight on the upper left.
export const soulGem = [
  "......a......",
  ".....aga.....",
  "..a..aga..a..",
  "..agaagaaga..",
  "...aggggga...",
  "..aaaaaaaaa..",
  ".aLLLPPPPPpa.",
  "aLWWLPPPPPPpa",
  "aLWLPPPPPPPpa",
  "aLLPPPPPPPPpa",
  "aLPPPPPPPPppa",
  "aPPPPPPPPPppa",
  ".aPPPPPPPppa.",
  ".apPPPPPpppa.",
  "..appPPpppa..",
  "...apppppa...",
  "....aaaaa....",
  ".....aga.....",
  "......a......",
];

export const gemKeys = (main, dark, light) => ({ a: palette.amber, g: palette.gold, P: main, p: dark, L: light, W: palette.white });

// Small gem used for the five-colour divider and stat icons.
export const miniGem = [
  "..aga..",
  ".aLPPa.",
  "aLWPPpa",
  "aLPPPpa",
  "aPPPppa",
  ".aPppa.",
  "..apa..",
  "...a...",
];

// A white incubator homage: cat ears, red eyes, ringed ear tufts.
export const incubator = mirror([
  "..o.....",
  ".oko....",
  ".okko...",
  ".okwoooo",
  "owwwwwww",
  "owwwwwww",
  "owwrrwww",
  "owwrRwww",
  "owwwwwww",
  "owwwwwww",
  "owwwwwwm",
  "oGowwwww",
  "okowwwww",
  "oGowwwww",
  "oko.owww",
  "oko..oww",
  ".o....oo",
]);
export const incubatorKeys = { o: palette.outline, w: palette.white, m: palette.mist, k: palette.pink, r: palette.red, R: "#ff8f9e", G: palette.gold };

// Pink hair ribbon: two loops, a knot and notched tails.
export const ribbon = mirror([
  "oo......",
  "oRoo....",
  "oRrro...",
  "orrrrooo",
  "orrrrodd",
  "orrrrodd",
  "odrrrooo",
  "oddoorro",
  "ooo.orro",
  "...orro.",
  "...oroo.",
  "...oo...",
]);
export const ribbonKeys = { o: palette.berry, r: palette.hot, R: palette.blush, d: palette.rose };

// Four-point sparkle, used for twinkling stars.
export const sparkle = ["..w..", "..w..", "wwWww", "..w..", "..w.."];
export const sparkleKeys = (color) => ({ w: color, W: palette.white });

// Chibi magical girl: short pink hair, low twin tails tied with red ribbons, big pink eyes. Left half, mirrored.
export const heroine = mirror([
  "........oooooo",
  "......ooHHHHHH",
  ".....oHHHHLLHH",
  "....oHHHHLLHHH",
  "rr..oHHHHHHHHH",
  "rRroHHHHHHHHHH",
  "rRRrHHHhHHHHhH",
  "rRroHHhsHHHhss",
  "rr.oHhssHHhsss",
  "..oHHsssshssss",
  ".oHHhssooossss",
  ".oHhssEwwessss",
  ".oHhssEweessss",
  ".oHhsseeeessss",
  "oHHhsseLLessss",
  "oHHhsssEEsssss",
  "oHHhssbbssssss",
  "oHHhsssssssssm",
  "oHHhoossssssss",
  ".oHhoooooooooo",
  ".oHho.........",
  "..oho.........",
  "...o..........",
]);
export const heroineKeys = { o: palette.outline, H: palette.pink, h: palette.rose, L: palette.blush, s: "#ffe4d8", E: palette.berry, e: palette.hot, w: palette.white, b: "#ff9fb8", m: palette.rose, r: palette.red, R: "#a8243a" };

// Falling cherry-blossom petal.
export const petal = ["pp.", "pPp", ".pp"];
export const petalKeys = { p: palette.pink, P: palette.blush };
