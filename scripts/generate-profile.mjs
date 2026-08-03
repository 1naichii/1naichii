import { readFile, writeFile } from "node:fs/promises";
import { optimizeSvg, stripSvgShell } from "./svg-optimizer.mjs";

const root = new URL("../", import.meta.url);
const output = new URL("profile.svg", root);

const asDataUri = (content, type) => `data:${type};base64,${Buffer.from(content).toString("base64")}`;

async function localAsset(name, type = "image/svg+xml") {
  const content = await readFile(new URL(name, root), type === "image/svg+xml" ? "utf8" : undefined);
  return asDataUri(type === "image/svg+xml" ? optimizeSvg(content) : content, type);
}

async function remoteSvg(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer()).toString("utf8");
  return asDataUri(optimizeSvg(source), "image/svg+xml");
}

async function inlineSvg(name, prefix) {
  const source = await readFile(new URL(name, root), "utf8");
  return stripSvgShell(optimizeSvg(source, { prefixIds: prefix }));
}

const [header, terminal, gif, bio, project, github, connect, languages, frameworks, data, tools, platforms] = await Promise.all([
  localAsset("profile-header.svg"),
  localAsset("terminal.svg"),
  localAsset("Tumblr.gif", "image/gif"),
  inlineSvg("bio-code.svg", "bio-"),
  localAsset("project-card.svg"),
  inlineSvg("github-streak.svg", "github-"),
  localAsset("connect-card.svg"),
  remoteSvg("https://skillicons.dev/icons?i=ts,js,php,py,c,cpp&theme=dark&perline=6"),
  remoteSvg("https://go-skill-icons.vercel.app/api/icons?i=express,laravel,react,tailwind,hono,elysia&theme=dark"),
  remoteSvg("https://go-skill-icons.vercel.app/api/icons?i=mysql,mongodb,postgres,redis,prisma,drizzle&theme=dark"),
  remoteSvg("https://skillicons.dev/icons?i=nodejs,bun,vite,npm,docker,git,github,postman&theme=dark&perline=8"),
  remoteSvg("https://skillicons.dev/icons?i=vercel,discord,arduino&theme=dark&perline=3"),
]);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="2690" viewBox="0 0 680 2690" role="img" aria-labelledby="title description">
  <title id="title">Mochaa's full developer profile</title>
  <desc id="description">A pink developer profile with an animated GIF, biography, current project, technology icons, GitHub activity, and social links.</desc>
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#241a22"/>
      <stop offset=".5" stop-color="#2b1f28"/>
      <stop offset="1" stop-color="#1e151c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#e96a9d"/>
      <stop offset="1" stop-color="#f7c5d8"/>
    </linearGradient>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#f29ab7" stroke-opacity=".025"/>
    </pattern>
    <clipPath id="gif-clip"><rect x="70" y="584" width="540" height="304" rx="8"/></clipPath>
    <style>
      text { font-family: "JetBrains Mono", Consolas, monospace; }
      .section { fill: #f29ab7; font-size: 10px; font-weight: 700; letter-spacing: 1.4px; }
      .stack-label { fill: #f7c5d8; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
    </style>
  </defs>

  <rect width="680" height="2690" rx="18" fill="url(#page)"/>
  <rect width="680" height="2690" rx="18" fill="url(#grid)"/>
  <path d="M16 0H664Q680 0 680 16V2674Q680 2690 664 2690H16Q0 2690 0 2674V16Q0 0 16 0Z" fill="none" stroke="#f29ab7" stroke-opacity=".38" stroke-width="2"/>

  <image href="${header}" x="0" y="20" width="680" height="220"/>
  <image href="${terminal}" x="0" y="260" width="680" height="250"/>

  <g>
    <rect x="1" y="530" width="678" height="378" rx="14" fill="#2b1f28" stroke="#f29ab7" stroke-width="2"/>
    <circle cx="22" cy="551" r="6" fill="#e96a9d"/>
    <circle cx="42" cy="551" r="6" fill="#f29ab7"/>
    <circle cx="62" cy="551" r="6" fill="#f7c5d8"/>
    <text x="340" y="556" fill="#fde8ef" fill-opacity=".72" font-size="13" text-anchor="middle">now-playing.gif</text>
    <path d="M1 570H679" stroke="#f29ab7" stroke-opacity=".25"/>
    <rect x="65" y="579" width="550" height="314" rx="11" fill="#1e151c" stroke="#f29ab7" stroke-opacity=".32"/>
    <image href="${gif}" x="70" y="584" width="540" height="304" preserveAspectRatio="xMidYMid slice" clip-path="url(#gif-clip)"/>
  </g>

  <g transform="translate(0 928)">${bio}</g>
  <image href="${project}" x="0" y="1338" width="680" height="230"/>

  <g transform="translate(0 1588)">
    <rect x="1" y="1" width="678" height="520" rx="16" fill="#2b1f28" stroke="#f29ab7" stroke-width="2"/>
    <text x="30" y="43" fill="#fde8ef" font-size="20" font-weight="700">~/technology-stack</text>
    <rect x="30" y="55" width="620" height="2" rx="1" fill="url(#accent)"/>

    <text x="30" y="88" class="stack-label">LANGUAGES</text>
    <image href="${languages}" x="30" y="100" width="330" height="48" preserveAspectRatio="xMinYMid meet"/>

    <text x="30" y="178" class="stack-label">FRAMEWORKS &amp; LIBRARIES</text>
    <image href="${frameworks}" x="30" y="190" width="330" height="48" preserveAspectRatio="xMinYMid meet"/>

    <text x="30" y="268" class="stack-label">DATABASES &amp; ORM</text>
    <image href="${data}" x="30" y="280" width="330" height="48" preserveAspectRatio="xMinYMid meet"/>

    <text x="30" y="358" class="stack-label">RUNTIMES &amp; TOOLS</text>
    <image href="${tools}" x="30" y="370" width="440" height="48" preserveAspectRatio="xMinYMid meet"/>

    <text x="30" y="448" class="stack-label">PLATFORMS &amp; HARDWARE</text>
    <image href="${platforms}" x="30" y="460" width="165" height="48" preserveAspectRatio="xMinYMid meet"/>
  </g>

  <g transform="translate(0 2129)">${github}</g>
  <image href="${connect}" x="0" y="2509" width="680" height="170"/>
</svg>`;

const optimized = optimizeSvg(svg);
await writeFile(output, optimized, "utf8");
console.log(`Generated profile.svg (${Buffer.byteLength(optimized)} bytes)`);
