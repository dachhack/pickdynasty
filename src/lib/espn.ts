// Client for ESPN's public (undocumented but stable) scoreboard API.
// Used to import game schedules and sync final results automatically.

type EspnPathConfig = { path: string; groups?: string };

// Maps Epic Pick'em sport ids -> ESPN API paths.
// groups: 80 = all FBS college football, 50 = all D1 men's basketball
// (without it ESPN only returns Top 25 games).
const ESPN_PATHS: Record<string, EspnPathConfig> = {
  nfl: { path: "football/nfl" },
  cfb: { path: "football/college-football", groups: "80" },
  nba: { path: "basketball/nba" },
  cbb: { path: "basketball/mens-college-basketball", groups: "50" },
  "march-madness": { path: "basketball/mens-college-basketball", groups: "50" },
  mlb: { path: "baseball/mlb" },
  cws: { path: "baseball/college-baseball" },
  nhl: { path: "hockey/nhl" },
  mls: { path: "soccer/usa.1" },
};

export function espnSupported(sport: string): boolean {
  return sport in ESPN_PATHS;
}

// Sports whose schedules are organized in numbered weeks (ESPN supports
// querying them directly by week). Everything else imports by date range.
export const WEEKLY_SPORTS: Record<string, { maxWeek: number }> = {
  nfl: { maxWeek: 18 },
  cfb: { maxWeek: 15 },
};

export function isWeeklySport(sport: string): boolean {
  return sport in WEEKLY_SPORTS;
}

export type EspnGame = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  completed: boolean;
  started: boolean;
  winner: "HOME" | "AWAY" | "TIE" | null;
  homeScore: number | null;
  awayScore: number | null;
  // Home-perspective point spread from ESPN odds (pregame only).
  spread: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- At-scale fetch layer -------------------------------------------------
// Many leagues syncing the same slate would otherwise hit ESPN once per
// league. A short-TTL cache with in-flight deduplication makes each cron
// tick cost ESPN at most one request per unique (sport, query) — constant
// upstream load regardless of league count. Errors are never cached, and a
// single retry with backoff absorbs transient blips.

const SCOREBOARD_TTL_MS = 60_000;
const scoreboardCache = new Map<string, { at: number; promise: Promise<EspnGame[]> }>();
let upstreamFetches = 0;

/** Total ESPN requests since process start — cron reports the per-tick delta. */
export function espnFetchCount(): number {
  return upstreamFetches;
}

async function fetchWithRetry(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      upstreamFetches++;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    }
  }
}

async function espnScoreboard(sport: string, query: string): Promise<EspnGame[]> {
  const cfg = ESPN_PATHS[sport];
  if (!cfg) return [];
  const groups = cfg.groups ? `&groups=${cfg.groups}` : "";
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/scoreboard?${query}&limit=300${groups}`;

  const cached = scoreboardCache.get(url);
  if (cached && Date.now() - cached.at < SCOREBOARD_TTL_MS) return cached.promise;

  const promise = fetchAndParse(url);
  scoreboardCache.set(url, { at: Date.now(), promise });
  // Never cache a failure — evict so the next caller retries fresh.
  promise.catch(() => {
    if (scoreboardCache.get(url)?.promise === promise) scoreboardCache.delete(url);
  });
  // Opportunistic sweep so the map can't grow unbounded over a season.
  if (scoreboardCache.size > 200) {
    for (const [k, v] of scoreboardCache) {
      if (Date.now() - v.at >= SCOREBOARD_TTL_MS) scoreboardCache.delete(k);
    }
  }
  return promise;
}

async function fetchAndParse(url: string): Promise<EspnGame[]> {
  const data: any = await fetchWithRetry(url);

  const games: EspnGame[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const statusName: string = comp.status?.type?.name ?? "";
    const completed = Boolean(comp.status?.type?.completed);
    const started = completed || statusName === "STATUS_IN_PROGRESS" || statusName === "STATUS_HALFTIME" || statusName === "STATUS_END_PERIOD";
    const hs = home.score != null ? parseFloat(home.score) : NaN;
    const as = away.score != null ? parseFloat(away.score) : NaN;
    let winner: EspnGame["winner"] = null;
    if (completed && !isNaN(hs) && !isNaN(as)) {
      winner = hs > as ? "HOME" : as > hs ? "AWAY" : "TIE";
    }
    const rawSpread = comp.odds?.[0]?.spread;
    games.push({
      externalId: String(event.id),
      homeTeam: home.team?.displayName ?? "Home",
      awayTeam: away.team?.displayName ?? "Away",
      startTime: new Date(event.date),
      completed,
      started,
      winner,
      homeScore: started && !isNaN(hs) ? hs : null,
      awayScore: started && !isNaN(as) ? as : null,
      spread: typeof rawSpread === "number" ? rawSpread : null,
    });
  }
  games.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return games;
}

/** Games on a single day (`YYYYMMDD`) or range (`YYYYMMDD-YYYYMMDD`). */
export async function fetchScoreboard(sport: string, dates: string): Promise<EspnGame[]> {
  return espnScoreboard(sport, `dates=${dates}`);
}

/** All games in a numbered regular-season week (NFL / college football). */
export async function fetchWeekScoreboard(
  sport: string,
  season: string,
  week: number
): Promise<EspnGame[]> {
  return espnScoreboard(sport, `dates=${season}&seasontype=2&week=${week}`);
}

export type EspnTeam = { id: string; name: string; abbrev: string };

/** All teams in a sport (for the slate builder's by-team mode). */
export async function fetchTeams(sport: string): Promise<EspnTeam[]> {
  const cfg = ESPN_PATHS[sport];
  if (!cfg) return [];
  const data: any = await fetchWithRetry(
    `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/teams?limit=500`
  );
  const teams = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams
    .map((t: any) => ({
      id: String(t.team?.id ?? ""),
      name: t.team?.displayName ?? "",
      abbrev: t.team?.abbreviation ?? "",
    }))
    .filter((t: EspnTeam) => t.id && t.name)
    .sort((a: EspnTeam, b: EspnTeam) => a.name.localeCompare(b.name));
}

/** A team's full-season schedule, normalized to EspnGame. */
export async function fetchTeamSchedule(
  sport: string,
  teamId: string,
  season: string
): Promise<EspnGame[]> {
  const cfg = ESPN_PATHS[sport];
  if (!cfg || !/^\d+$/.test(teamId)) return [];
  const data: any = await fetchWithRetry(
    `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/teams/${teamId}/schedule?season=${season}`
  );
  const games: EspnGame[] = [];
  for (const event of data?.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const completed = Boolean(comp.status?.type?.completed);
    // Schedule endpoint nests scores as objects: {value, displayValue}.
    const hs = home.score?.value != null ? Number(home.score.value) : NaN;
    const as = away.score?.value != null ? Number(away.score.value) : NaN;
    let winner: EspnGame["winner"] = null;
    if (completed && !isNaN(hs) && !isNaN(as)) {
      winner = hs > as ? "HOME" : as > hs ? "AWAY" : "TIE";
    }
    games.push({
      externalId: String(event.id),
      homeTeam: home.team?.displayName ?? "Home",
      awayTeam: away.team?.displayName ?? "Away",
      startTime: new Date(event.date),
      completed,
      started: completed,
      winner,
      homeScore: completed && !isNaN(hs) ? hs : null,
      awayScore: completed && !isNaN(as) ? as : null,
      spread: null,
    });
  }
  games.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return games;
}

/** ESPN's notion of the current week for a weekly sport, or null off-season. */
export async function fetchCurrentWeek(sport: string): Promise<number | null> {
  const cfg = ESPN_PATHS[sport];
  if (!cfg) return null;
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/scoreboard`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const week = Number(data?.week?.number);
    return Number.isInteger(week) && week > 0 ? week : null;
  } catch {
    return null;
  }
}

const etDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ESPN's `dates` param is keyed to US Eastern days. */
export function toEspnDate(d: Date): string {
  return etDate.format(d).replaceAll("-", "");
}
