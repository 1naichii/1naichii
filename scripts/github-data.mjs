// Fetches the contribution calendar and profile numbers shown in the activity panel.

const token = process.env.GITHUB_TOKEN;
export const today = new Date().toISOString().slice(0, 10);
const contributionLevels = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

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

async function fetchFromGitHub(username) {
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
      level: contributionLevels[day.contributionLevel] ?? (day.contributionCount > 0 ? 1 : 0),
    })),
  };
}

async function fetchPublicData(username) {
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

export function calculateStreaks(contributions) {
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
  const response = await request(`${url}${url.includes("?") ? "&" : "?"}size=132`);
  const contentType = response.headers.get("content-type") || "image/png";
  const encoded = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${encoded}`;
}

/** Days since the last day with at least one contribution (0 = contributed today). */
export function daysIdle(contributions) {
  const last = [...contributions].filter((day) => day.count > 0 && day.date <= today).map((day) => day.date).sort().at(-1);
  if (!last) return Infinity;
  return Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${last}T00:00:00Z`)) / 86400000);
}

export async function loadGitHubActivity(username) {
  const data = token ? await fetchFromGitHub(username) : await fetchPublicData(username);
  const avatar = await avatarDataUri(data.avatarUrl);
  return { ...data, avatar, streaks: calculateStreaks(data.contributions), idle: daysIdle(data.contributions) };
}
