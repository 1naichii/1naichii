// Reads the numbers for the "Mana Reading" section: contribution calendar,
// streaks, idle days, repo/follower counts and a small avatar.

const token = process.env.GITHUB_TOKEN;
export const today = new Date().toISOString().slice(0, 10);

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function get(url, init = {}, attempts = 3) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      ...init,
      headers: { Accept: "application/vnd.github+json", "User-Agent": "profile-svg-builder", ...init.headers },
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}: ${await response.text()}`);
    return response;
  } catch (error) {
    if (attempts <= 1) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return get(url, init, attempts - 1);
  }
}

async function viaGraphQL(login) {
  const to = new Date();
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login name avatarUrl
      followers { totalCount }
      repositories(ownerAffiliations: OWNER) { totalCount }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
      }
    }
  }`;
  const response = await get("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
  });
  const { data, errors } = await response.json();
  if (errors?.length || !data?.user) throw new Error(errors?.map((e) => e.message).join("; ") || `no user ${login}`);
  const { user } = data;
  const calendar = user.contributionsCollection.contributionCalendar;
  return {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatarUrl,
    followers: user.followers.totalCount,
    repositories: user.repositories.totalCount,
    total: calendar.totalContributions,
    days: calendar.weeks.flatMap((week) => week.contributionDays).map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: LEVELS[day.contributionLevel] ?? 0,
    })),
  };
}

async function viaPublicApis(login) {
  const [profile, calendar] = await Promise.all([
    get(`https://api.github.com/users/${encodeURIComponent(login)}`).then((r) => r.json()),
    get(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=last`).then((r) => r.json()),
  ]);
  return {
    login: profile.login,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    followers: profile.followers,
    repositories: profile.public_repos,
    total: calendar.total.lastYear,
    days: calendar.contributions.map(({ date, count, level }) => ({ date, count, level: Number(level) || 0 })),
  };
}

/** Current streak (today may still be empty), longest streak, and days since the last contribution. */
export function streaks(days) {
  const sorted = days.filter((day) => day.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let run = 0;
  for (const day of sorted) {
    run = day.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let i = sorted.length - 1;
  if (sorted[i]?.date === today && sorted[i].count === 0) i -= 1;
  let current = 0;
  while (i >= 0 && sorted[i].count > 0) {
    current += 1;
    i -= 1;
  }
  const last = sorted.findLast((day) => day.count > 0);
  const idle = last ? Math.round((Date.parse(today) - Date.parse(last.date)) / 86400000) : Infinity;
  return { current, longest, idle };
}

export async function readMana(login) {
  const data = token ? await viaGraphQL(login) : await viaPublicApis(login);
  const avatarResponse = await get(`${data.avatarUrl}${data.avatarUrl.includes("?") ? "&" : "?"}s=96`);
  const type = avatarResponse.headers.get("content-type") || "image/png";
  const avatar = `data:${type};base64,${Buffer.from(await avatarResponse.arrayBuffer()).toString("base64")}`;
  return { ...data, avatar, ...streaks(data.days) };
}
