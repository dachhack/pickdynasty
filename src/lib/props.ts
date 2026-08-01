// 🎯 Player props (over/under on one player's stat line), mixed into slates
// as Game rows with kind "prop" — see the Game model comment for how they
// piggyback on the HOME/AWAY machinery. This module owns:
//   - the stat catalog (what's proppable per sport family),
//   - line suggestions from Sleeper's free weekly projections (NFL),
//   - grading from ESPN game-summary boxscores (football + basketball).

import { db } from "./db";
import { fetchSummary } from "./espn";

// awayTeam renders first everywhere, so Over lives on the AWAY side.
export const OVER = "AWAY";
export const UNDER = "HOME";

type Family = "football" | "basketball";

const FAMILY_OF_SPORT: Record<string, Family> = {
  nfl: "football",
  cfb: "football",
  nba: "basketball",
  wnba: "basketball",
  cbb: "basketball",
  "march-madness": "basketball",
  wcbb: "basketball",
};

export function propFamily(sport: string): Family | null {
  return FAMILY_OF_SPORT[sport] ?? null;
}

export type PropStatDef = {
  key: string;
  label: string;
  family: Family;
  // ESPN boxscore extraction: football stats live in a named category
  // (passing/rushing/receiving); basketball has one flat stat table.
  espnCategory?: string;
  espnLabel: string;
  // Sleeper weekly-projection field (NFL only) for suggested lines.
  sleeper?: string;
};

export const PROP_STATS: PropStatDef[] = [
  { key: "passYds", label: "Passing yards", family: "football", espnCategory: "passing", espnLabel: "YDS", sleeper: "pass_yd" },
  { key: "passTds", label: "Passing TDs", family: "football", espnCategory: "passing", espnLabel: "TD", sleeper: "pass_td" },
  { key: "rushYds", label: "Rushing yards", family: "football", espnCategory: "rushing", espnLabel: "YDS", sleeper: "rush_yd" },
  { key: "recYds", label: "Receiving yards", family: "football", espnCategory: "receiving", espnLabel: "YDS", sleeper: "rec_yd" },
  { key: "receptions", label: "Receptions", family: "football", espnCategory: "receiving", espnLabel: "REC", sleeper: "rec" },
  { key: "points", label: "Points", family: "basketball", espnLabel: "PTS" },
  { key: "rebounds", label: "Rebounds", family: "basketball", espnLabel: "REB" },
  { key: "assists", label: "Assists", family: "basketball", espnLabel: "AST" },
];

export function propStatsFor(sport: string): PropStatDef[] {
  const family = propFamily(sport);
  return family ? PROP_STATS.filter((s) => s.family === family) : [];
}

export function propStat(key: string): PropStatDef | null {
  return PROP_STATS.find((s) => s.key === key) ?? null;
}

// ---------------- Name matching ----------------

const normName = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

/** "J. Allen" ~ "Josh Allen": same last name + same first initial. */
function looseMatch(a: string, b: string): boolean {
  const [aw, bw] = [a.split(" "), b.split(" ")];
  if (aw.length < 2 || bw.length < 2) return false;
  return (
    aw[aw.length - 1] === bw[bw.length - 1] && aw[0][0] === bw[0][0]
  );
}

// ---------------- Grading from ESPN boxscores ----------------

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Pulls one player's stat from a game summary. Returns the value (null if
 * the player or stat isn't in the boxscore — e.g. a healthy scratch) and
 * whether the game is final. Grade only when completed: boxscores exist
 * mid-game and would grade an over "under" at halftime.
 */
export function statFromSummary(
  summary: any,
  sport: string,
  playerName: string,
  statKey: string
): { value: number | null; completed: boolean; headshot: string | null } {
  const completed =
    summary?.header?.competitions?.[0]?.status?.type?.completed === true;
  const def = propStat(statKey);
  const family = propFamily(sport);
  if (!def || def.family !== family) return { value: null, completed, headshot: null };

  const target = normName(playerName);
  for (const team of summary?.boxscore?.players ?? []) {
    for (const cat of team.statistics ?? []) {
      if (family === "football" && cat.name !== def.espnCategory) continue;
      const labels: string[] = cat.labels ?? cat.names ?? [];
      const idx = labels.indexOf(def.espnLabel);
      if (idx < 0) continue;
      for (const a of cat.athletes ?? []) {
        const names = [a.athlete?.displayName, a.athlete?.shortName]
          .filter(Boolean)
          .map((n: string) => normName(n));
        const hit =
          names.includes(target) || names.some((n) => looseMatch(n, target));
        if (!hit) continue;
        const raw = a.stats?.[idx];
        const value = Number.parseFloat(String(raw ?? ""));
        const h = a.athlete?.headshot;
        const headshot =
          typeof h === "string" ? h : typeof h?.href === "string" ? h.href : null;
        return { value: Number.isFinite(value) ? value : null, completed, headshot };
      }
    }
  }
  return { value: null, completed, headshot: null };
}

/**
 * Grades every due prop in a league from ESPN boxscores: prop rows whose
 * real game (externalId) is FINAL get winner Over/Under/Push + the actual
 * stat value. Props without an externalId (hand-entered games) are the
 * commissioner's to grade manually. Returns rows updated.
 */
export async function gradeLeagueProps(leagueId: string, leagueSport: string): Promise<number> {
  const due = await db.game.findMany({
    where: {
      slate: { leagueId },
      kind: "prop",
      winner: null,
      externalId: { not: null },
      propPlayer: { not: null },
      propStat: { not: null },
      line: { not: null },
      startTime: { lt: new Date() },
    },
  });

  let updated = 0;
  for (const prop of due) {
    const sport = prop.sport ?? leagueSport;
    let summary: any = null;
    try {
      summary = await fetchSummary(sport, prop.externalId!);
    } catch {
      continue; // transient ESPN failure — next tick retries
    }
    if (!summary) continue;
    const { value, completed, headshot } = statFromSummary(
      summary,
      sport,
      prop.propPlayer!,
      prop.propStat!
    );
    // Headshot backfill (non-NFL props get faces once the game starts) —
    // worthwhile even when the game isn't final yet.
    const imageFill =
      !prop.propImage && headshot ? { propImage: headshot } : {};
    if (!completed || value == null) {
      if (imageFill.propImage) {
        await db.game.update({ where: { id: prop.id }, data: imageFill });
      }
      continue;
    }
    const winner = value > prop.line! ? OVER : value < prop.line! ? UNDER : "TIE";
    await db.game.update({
      where: { id: prop.id },
      data: { winner, propActual: value, ...imageFill },
    });
    updated++;
  }
  return updated;
}

// ---------------- Suggested lines (Sleeper weekly projections, NFL) ----------------

const SLEEPER = "https://api.sleeper.app/v1";
// The players blob is ~5 MB — cache the slimmed name index for a day.
// espn_id rides along: it's the bridge to ESPN's headshot CDN (the same
// trick Drip's player index uses).
type SleeperEntry = { id: string; espnId: string | null };
let sleeperNameIndex: { at: number; map: Map<string, SleeperEntry> } | null = null;

async function sleeperJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`sleeper ${res.status}`);
  return res.json();
}

async function sleeperIndex(): Promise<Map<string, SleeperEntry>> {
  if (sleeperNameIndex && Date.now() - sleeperNameIndex.at < 24 * 3600 * 1000) {
    return sleeperNameIndex.map;
  }
  const players = await sleeperJson(`${SLEEPER}/players/nfl`);
  const map = new Map<string, SleeperEntry>();
  for (const [id, p] of Object.entries<any>(players)) {
    if (!p?.full_name || !["QB", "RB", "WR", "TE"].includes(p.position)) continue;
    map.set(normName(p.full_name), {
      id,
      espnId: p.espn_id != null ? String(p.espn_id) : null,
    });
  }
  sleeperNameIndex = { at: Date.now(), map };
  return map;
}

/**
 * ESPN headshot URL for an NFL player, via the Sleeper espn_id bridge.
 * Null for unknown names or non-NFL — other sports backfill from the
 * boxscore once the game starts (gradeLeagueProps).
 */
export async function nflHeadshot(playerName: string): Promise<string | null> {
  try {
    const entry = (await sleeperIndex()).get(normName(playerName));
    return entry?.espnId
      ? `https://a.espncdn.com/i/headshots/nfl/players/full/${entry.espnId}.png`
      : null;
  } catch {
    return null;
  }
}

/**
 * Suggested O/U line from Sleeper's free weekly projections (NFL only) —
 * rounded to a half so it can't push. Null whenever anything is missing
 * (offseason, unknown player, non-NFL): the caller falls back to asking
 * for a manual line.
 */
export async function suggestLine(input: {
  sport: string;
  playerName: string;
  statKey: string;
}): Promise<number | null> {
  const def = propStat(input.statKey);
  if (input.sport !== "nfl" || !def?.sleeper) return null;
  try {
    const state = await sleeperJson(`${SLEEPER}/state/nfl`);
    const season = state?.season;
    const week = state?.season_type === "regular" ? Math.max(1, Number(state?.week) || 1) : 1;
    if (!season) return null;

    const [proj, index] = await Promise.all([
      sleeperJson(`${SLEEPER}/projections/nfl/regular/${season}/${week}`),
      sleeperIndex(),
    ]);
    const id = index.get(normName(input.playerName))?.id;
    if (!id) return null;
    // The endpoint has returned both shapes over time: {id: stats} and
    // [{player_id, stats}] — handle either.
    const stats = Array.isArray(proj)
      ? (proj.find((p: any) => p?.player_id === id)?.stats ?? null)
      : (proj?.[id] ?? null);
    const v = Number(stats?.[def.sleeper]);
    if (!Number.isFinite(v) || v <= 0) return null;
    const line = Math.round(v * 2) / 2;
    return Number.isInteger(line) ? line + 0.5 : line;
  } catch {
    return null;
  }
}
