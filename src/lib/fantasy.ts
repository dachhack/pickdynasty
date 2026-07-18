// Clients for fantasy platforms (Sleeper, ESPN Fantasy) used to import a
// fantasy league's weekly head-to-head matchups as pick'em games.
//
// Game.externalId encodings:
//   "sleeper:<week>:<matchupId>"   Sleeper matchup
//   "espnf:<week>:<scheduleId>"    ESPN fantasy schedule entry
// (Plain numeric ids are real-sport ESPN scoreboard events — see lib/espn.ts.)

export type FantasyProvider = "sleeper" | "espn";

export type FantasyLinkLike = {
  provider: string;
  providerLeagueId: string;
  season: string;
  espnS2?: string | null;
  swid?: string | null;
};

export type FantasyMatchup = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  final: boolean;
  winner: "HOME" | "AWAY" | "TIE" | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------- Sleeper (public API, no auth) ----------

const SLEEPER = "https://api.sleeper.app/v1";

async function sleeperJson(path: string): Promise<any> {
  const res = await fetch(`${SLEEPER}${path}`, { cache: "no-store" });
  if (res.status === 404) {
    throw new Error("Sleeper league not found — check the league ID.");
  }
  if (!res.ok) throw new Error(`Sleeper API returned ${res.status}`);
  return res.json();
}

async function sleeperTeamNames(leagueId: string): Promise<Map<number, string>> {
  const [rosters, users] = await Promise.all([
    sleeperJson(`/league/${leagueId}/rosters`),
    sleeperJson(`/league/${leagueId}/users`),
  ]);
  const byUser = new Map<string, string>(
    users.map((u: any) => [
      u.user_id,
      u.metadata?.team_name || u.display_name || "Unknown",
    ])
  );
  return new Map(
    rosters.map((r: any) => [
      r.roster_id,
      byUser.get(r.owner_id) ?? `Team ${r.roster_id}`,
    ])
  );
}

/** A Sleeper week is final once the NFL state has moved past it. */
async function sleeperWeekFinal(season: string, week: number): Promise<boolean> {
  const state = await sleeperJson(`/state/nfl`);
  if (String(state.league_season) > season) return true;
  return String(state.league_season) === season && Number(state.week) > week;
}

async function sleeperMatchups(
  link: FantasyLinkLike,
  week: number
): Promise<FantasyMatchup[]> {
  const [entries, names, final] = await Promise.all([
    sleeperJson(`/league/${link.providerLeagueId}/matchups/${week}`),
    sleeperTeamNames(link.providerLeagueId),
    sleeperWeekFinal(link.season, week),
  ]);
  const byMatchup = new Map<number, any[]>();
  for (const e of entries ?? []) {
    if (e.matchup_id == null) continue; // bye week
    const list = byMatchup.get(e.matchup_id) ?? [];
    list.push(e);
    byMatchup.set(e.matchup_id, list);
  }
  const games: FantasyMatchup[] = [];
  for (const [matchupId, pair] of [...byMatchup.entries()].sort((a, b) => a[0] - b[0])) {
    if (pair.length !== 2) continue;
    pair.sort((a, b) => a.roster_id - b.roster_id);
    const [home, away] = pair;
    const hp = home.points ?? 0;
    const ap = away.points ?? 0;
    games.push({
      externalId: `sleeper:${week}:${matchupId}`,
      homeTeam: names.get(home.roster_id) ?? `Team ${home.roster_id}`,
      awayTeam: names.get(away.roster_id) ?? `Team ${away.roster_id}`,
      final,
      winner: final ? (hp > ap ? "HOME" : ap > hp ? "AWAY" : "TIE") : null,
    });
  }
  return games;
}

// ---------- ESPN Fantasy (public leagues; private need espn_s2 + SWID) ----------

async function espnFantasyJson(link: FantasyLinkLike, views: string[]): Promise<any> {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${link.season}/segments/0/leagues/${link.providerLeagueId}?${views.map((v) => `view=${v}`).join("&")}`;
  const headers: Record<string, string> = {};
  if (link.espnS2 && link.swid) {
    headers.Cookie = `espn_s2=${link.espnS2}; SWID=${link.swid}`;
  }
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    throw new Error("ESPN says this league is private — espn_s2 and SWID cookies are required.");
  }
  if (res.status === 404) throw new Error("ESPN league not found — check the league ID and season.");
  if (!res.ok) throw new Error(`ESPN Fantasy API returned ${res.status}`);
  return res.json();
}

function espnTeamName(t: any): string {
  return t?.name || [t?.location, t?.nickname].filter(Boolean).join(" ") || `Team ${t?.id}`;
}

async function espnFantasyMatchups(
  link: FantasyLinkLike,
  week: number
): Promise<FantasyMatchup[]> {
  const data = await espnFantasyJson(link, ["mTeam", "mMatchupScore"]);
  const teams = new Map<number, string>(
    (data.teams ?? []).map((t: any) => [t.id, espnTeamName(t)])
  );
  const games: FantasyMatchup[] = [];
  for (const m of data.schedule ?? []) {
    if (m.matchupPeriodId !== week || !m.home || !m.away) continue; // skip byes
    const winner =
      m.winner === "HOME" || m.winner === "AWAY" || m.winner === "TIE" ? m.winner : null;
    games.push({
      externalId: `espnf:${week}:${m.id}`,
      homeTeam: teams.get(m.home.teamId) ?? `Team ${m.home.teamId}`,
      awayTeam: teams.get(m.away.teamId) ?? `Team ${m.away.teamId}`,
      final: winner !== null,
      winner,
    });
  }
  return games;
}

// ---------- Provider-agnostic entry points ----------

/** Validates a league link and returns the fantasy league's name. */
export async function fetchFantasyLeagueName(link: FantasyLinkLike): Promise<string> {
  if (link.provider === "sleeper") {
    const league = await sleeperJson(`/league/${link.providerLeagueId}`);
    if (!league?.name) throw new Error("Sleeper league not found — check the league ID.");
    return league.name;
  }
  const data = await espnFantasyJson(link, ["mSettings"]);
  return data?.settings?.name ?? `ESPN League ${link.providerLeagueId}`;
}

export async function fetchFantasyMatchups(
  link: FantasyLinkLike,
  week: number
): Promise<FantasyMatchup[]> {
  return link.provider === "sleeper"
    ? sleeperMatchups(link, week)
    : espnFantasyMatchups(link, week);
}

export function parseFantasyExternalId(
  externalId: string
): { kind: "fantasy"; week: number } | { kind: "scoreboard" } {
  const m = externalId.match(/^(?:sleeper|espnf):(\d+):/);
  return m ? { kind: "fantasy", week: Number(m[1]) } : { kind: "scoreboard" };
}
