import { writeFile } from "node:fs/promises";

const username = process.argv[2] || process.env.GITHUB_USERNAME || "1naichii";
const output = process.argv[3] || "github-streak.svg";
const token = process.env.GITHUB_TOKEN;
const today = new Date().toISOString().slice(0, 10);

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "github-streak-svg-generator",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${await response.text()}`);
  }

  return response;
};

async function fetchFromGitHub() {
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        login
        name
        avatarUrl
        followers { totalCount }
        repositories(first: 1, ownerAffiliations: OWNER) { totalCount }
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { date contributionCount contributionLevel }
            }
          }
        }
      }
    }
  `;
  const response = await request("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { login: username, from: from.toISOString(), to: new Date().toISOString() },
    }),
  });
  const payload = await response.json();

  if (payload.errors?.length || !payload.data?.user) {
    throw new Error(payload.errors?.map(({ message }) => message).join("; ") || `User ${username} was not found`);
  }

  const user = payload.data.user;
  const calendar = user.contributionsCollection.contributionCalendar;
  return {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatarUrl,
    followers: user.followers.totalCount,
    repositories: user.repositories.totalCount,
    total: calendar.totalContributions,
    contributions: calendar.weeks.flatMap(({ contributionDays }) => contributionDays).map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: Number(day.contributionLevel.at(-1)) || 0,
    })),
  };
}

async function fetchPublicData() {
  const [profileResponse, contributionsResponse] = await Promise.all([
    request(`https://api.github.com/users/${encodeURIComponent(username)}`),
    request(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`),
  ]);
  const [profile, calendar] = await Promise.all([profileResponse.json(), contributionsResponse.json()]);

  return {
    login: profile.login,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    followers: profile.followers,
    repositories: profile.public_repos,
    total: calendar.total.lastYear,
    contributions: calendar.contributions,
  };
}

function calculateStreaks(contributions) {
  const days = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let running = 0;

  for (const day of days) {
    running = day.count > 0 ? running + 1 : 0;
    longest = Math.max(longest, running);
  }

  let index = days.findLastIndex((day) => day.date <= today);
  if (days[index]?.date === today && days[index].count === 0) index -= 1;

  let current = 0;
  while (index >= 0 && days[index].count > 0) {
    current += 1;
    index -= 1;
  }

  return { current, longest };
}

async function avatarDataUri(url) {
  const response = await request(`${url}${url.includes("?") ? "&" : "?"}size=160`);
  const contentType = response.headers.get("content-type") || "image/png";
  const encoded = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${encoded}`;
}

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function render(data, avatar, streaks) {
  const colors = ["#3a2935", "#704054", "#a94f73", "#e96a9d", "#f7c5d8"];
  const currentDate = new Date(`${today}T00:00:00Z`);
  const gridStart = new Date(currentDate);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay() - (51 * 7));
  const days = data.contributions.filter(({ date }) => date >= gridStart.toISOString().slice(0, 10) && date <= today);
  const cells = days.map((day) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const week = Math.floor((date - gridStart) / 604800000);
    const weekday = date.getUTCDay();
    return `<rect x="${107 + week * 9}" y="${267 + weekday * 9}" width="7" height="7" rx="2" fill="${colors[Math.min(day.level, 4)]}" aria-label="${day.date}: ${day.count} contributions"/>`;
  }).join("\n    ");

  const stat = (x, label, value, suffix = "") => `<g transform="translate(${x} 145)">
      <rect width="188" height="88" rx="12" fill="#34252f" stroke="#f29ab7" stroke-opacity=".2"/>
      <text x="94" y="24" class="label" text-anchor="middle">${label}</text>
      <text x="94" y="61" class="value" text-anchor="middle">${value}<tspan class="suffix">${suffix}</tspan></text>
      <rect x="64" y="76" width="60" height="2" rx="1" fill="url(#accent)"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="360" viewBox="0 0 680 360" role="img" aria-labelledby="title description">
  <title id="title">GitHub activity for @${escapeXml(data.login)}</title>
  <desc id="description">${streaks.current} day current streak, ${streaks.longest} day longest streak, and ${data.total} contributions in the last year.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2b1f28"/><stop offset="1" stop-color="#1e151c"/></linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#e96a9d"/><stop offset="1" stop-color="#f7c5d8"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#e96a9d" stop-opacity=".18"/><stop offset="1" stop-color="#e96a9d" stop-opacity="0"/></radialGradient>
    <clipPath id="avatar"><circle cx="67" cy="72" r="40"/></clipPath>
    <style>
      text { font-family: "JetBrains Mono", Consolas, monospace; }
      .label { fill: #f29ab7; font-size: 10px; font-weight: 700; letter-spacing: 1.2px; }
      .value { fill: #fde8ef; font-size: 29px; font-weight: 700; }
      .suffix { fill: #f7c5d8; font-size: 11px; font-weight: 600; }
    </style>
  </defs>
  <rect x="1" y="1" width="678" height="358" rx="16" fill="url(#background)" stroke="#f29ab7" stroke-width="2"/>
  <circle cx="630" cy="18" r="145" fill="url(#glow)"/>
  <path d="M24 126H656" stroke="#f29ab7" stroke-opacity=".14"/>

  <circle cx="67" cy="72" r="43" fill="none" stroke="url(#accent)" stroke-width="3"/>
  <image href="${avatar}" x="27" y="32" width="80" height="80" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)"/>
  <g transform="translate(128 0)">
    <text x="0" y="63" fill="#fde8ef" font-size="21" font-weight="700">${escapeXml(data.name)}</text>
    <text x="0" y="86" fill="#f29ab7" font-size="12">@${escapeXml(data.login)} / activity.log</text>
    <circle cx="5" cy="105" r="4" fill="#e96a9d"/><text x="16" y="109" fill="#f7c5d8" font-size="10">updated ${today}</text>
  </g>
  <g transform="translate(473 46)" font-size="10" font-weight="700">
    <rect width="76" height="27" rx="7" fill="#34252f" stroke="#f29ab7" stroke-opacity=".28"/><text x="38" y="18" fill="#fde8ef" text-anchor="middle">${data.repositories} REPOS</text>
    <rect x="84" width="90" height="27" rx="7" fill="#34252f" stroke="#f29ab7" stroke-opacity=".28"/><text x="129" y="18" fill="#fde8ef" text-anchor="middle">${data.followers} FOLLOWERS</text>
  </g>

  ${stat(34, "CURRENT STREAK", streaks.current, " DAYS")}
  ${stat(246, "LONGEST STREAK", streaks.longest, " DAYS")}
  ${stat(458, "YEARLY OUTPUT", data.total, " CONTRIBS")}

  <g>
    ${cells}
    <g transform="translate(537 344)"><text x="0" y="0" fill="#f7c5d8" font-size="9">LESS</text>${colors.map((color, index) => `<rect x="${31 + index * 12}" y="-8" width="8" height="8" rx="2" fill="${color}"/>`).join("")}<text x="96" y="0" fill="#f7c5d8" font-size="9">MORE</text></g>
  </g>
</svg>`;
}

const data = token ? await fetchFromGitHub() : await fetchPublicData();
const [avatar, streaks] = await Promise.all([
  avatarDataUri(data.avatarUrl),
  Promise.resolve(calculateStreaks(data.contributions)),
]);
await writeFile(output, render(data, avatar, streaks), "utf8");
console.log(`Generated ${output} for @${data.login}: current ${streaks.current}, longest ${streaks.longest}, total ${data.total}`);
