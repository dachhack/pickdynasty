import { db } from "./db";
import {
  fetchCurrentWeek,
  fetchScoreboard,
  fetchTeams,
  fetchTeamSchedule,
  fetchWeekScoreboard,
  toEspnDate,
  WEEKLY_SPORTS,
  type EspnGame,
} from "./espn";

// Pick packs: curated bundles of games for the slate builder.
//
// Two curation channels:
//  1. RULE PACKS (below) — self-maintaining recipes resolved live against
//     ESPN. City packs match team names across every pro league; theme
//     packs sweep whole sports over a date window. Zero upkeep.
//  2. CURATED PACKS — hand-built in HQ by super admins (PickPack /
//     PickPackGame tables) and published platform-wide. Full editorial
//     control ("Top Games of September").

export type PackGame = EspnGame & { sport: string };

export type PackInfo = {
  id: string; // "philly" | "womens" | "db:<id>"
  title: string;
  emoji: string;
  description: string;
};

const PRO_SPORTS = ["nfl", "mlb", "nba", "wnba", "nhl", "mls", "nwsl"];

type CityPack = { title: string; emoji: string; matches: string[] };

const CITY_PACKS: Record<string, CityPack> = {
  philly: { title: "All Philly Teams", emoji: "🔔", matches: ["Philadelphia"] },
  atlanta: { title: "All Atlanta Teams", emoji: "🍑", matches: ["Atlanta"] },
  boston: { title: "All Boston Teams", emoji: "🦞", matches: ["Boston", "New England"] },
  chicago: { title: "All Chicago Teams", emoji: "🌆", matches: ["Chicago"] },
  "new-york": { title: "All New York Teams", emoji: "🗽", matches: ["New York", "Brooklyn"] },
  "los-angeles": { title: "All LA Teams", emoji: "🌴", matches: ["Los Angeles", "LA Galaxy", "Angel City"] },
};

const THEME_PACKS: Record<string, { title: string; emoji: string; sports: string[] }> = {
  womens: {
    title: "Women's Sports Spotlight",
    emoji: "🔥",
    sports: ["wnba", "nwsl", "wcbb"],
  },
  hoops: { title: "All Hoops", emoji: "🏀", sports: ["nba", "wnba", "cbb", "wcbb"] },
};

const PACK_WINDOW_DAYS = 30;
const PACK_MAX_GAMES = 60;

const TOP25_PACK: PackInfo = {
  id: "cfb-top25",
  title: "Top 25 College Football",
  emoji: "🏅",
  description: "This week's games with an AP Top 25 team — refreshes weekly",
};

export function rulePackList(): PackInfo[] {
  return [
    TOP25_PACK,
    ...Object.entries(CITY_PACKS).map(([id, p]) => ({
      id,
      title: p.title,
      emoji: p.emoji,
      description: `Every ${p.matches[0]} pro team, next ${PACK_WINDOW_DAYS} days`,
    })),
    ...Object.entries(THEME_PACKS).map(([id, p]) => ({
      id,
      title: p.title,
      emoji: p.emoji,
      description: `Across ${p.sports.length} leagues, next ${PACK_WINDOW_DAYS} days`,
    })),
  ];
}

function inWindow(g: EspnGame, start: Date, end: Date): boolean {
  return g.startTime >= start && g.startTime <= end;
}

function dedupe(games: PackGame[]): PackGame[] {
  const seen = new Set<string>();
  return games
    .filter((g) => {
      const key = `${g.sport}:${g.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, PACK_MAX_GAMES);
}

async function resolveCityPack(pack: CityPack, season: string): Promise<PackGame[]> {
  const now = new Date();
  const end = new Date(now.getTime() + PACK_WINDOW_DAYS * 86400000);
  const out: PackGame[] = [];
  // Per sport: find matching franchises, pull their schedules, keep the window.
  await Promise.all(
    PRO_SPORTS.map(async (sport) => {
      try {
        const teams = await fetchTeams(sport);
        const mine = teams.filter((t) => pack.matches.some((m) => t.name.includes(m)));
        for (const team of mine) {
          const schedule = await fetchTeamSchedule(sport, team.id, season);
          for (const g of schedule) {
            if (inWindow(g, now, end)) out.push({ ...g, sport });
          }
        }
      } catch {
        // One league failing (off-season, API blip) shouldn't kill the pack.
      }
    })
  );
  return dedupe(out);
}

async function resolveThemePack(sports: string[]): Promise<PackGame[]> {
  const now = new Date();
  const end = new Date(now.getTime() + PACK_WINDOW_DAYS * 86400000);
  const range = `${toEspnDate(now)}-${toEspnDate(end)}`;
  const out: PackGame[] = [];
  await Promise.all(
    sports.map(async (sport) => {
      try {
        for (const g of await fetchScoreboard(sport, range)) {
          if (inWindow(g, now, end)) out.push({ ...g, sport });
        }
      } catch {
        // Skip a struggling league rather than failing the pack.
      }
    })
  );
  return dedupe(out);
}

/**
 * This week's AP Top 25 college football games. Starts at ESPN's current
 * week (or week 1 pre-season) and scans forward a few weeks to skip
 * fully-finished ones — Sunday shares point at next Saturday's slate.
 * Ranked team names get their "#N" prefix so the pick board reads like
 * the poll. Empty until the preseason AP poll drops (mid-August).
 */
async function resolveTop25Pack(season: string): Promise<PackGame[]> {
  const start = (await fetchCurrentWeek("cfb").catch(() => null)) ?? 1;
  const max = WEEKLY_SPORTS.cfb.maxWeek;
  for (let week = start; week <= Math.min(start + 3, max); week++) {
    try {
      const games = await fetchWeekScoreboard("cfb", season, week);
      const ranked = games.filter(
        (g) => (g.homeRank ?? 99) <= 25 || (g.awayRank ?? 99) <= 25
      );
      if (ranked.length === 0 || ranked.every((g) => g.completed)) continue;
      return dedupe(
        ranked.map((g) => ({
          ...g,
          homeTeam: g.homeRank ? `#${g.homeRank} ${g.homeTeam}` : g.homeTeam,
          awayTeam: g.awayRank ? `#${g.awayRank} ${g.awayTeam}` : g.awayTeam,
          sport: "cfb",
        }))
      );
    } catch {
      // A bad week fetch shouldn't kill the pack — try the next week.
    }
  }
  return [];
}

export async function resolveRulePack(id: string, season: string): Promise<PackGame[] | null> {
  if (id === TOP25_PACK.id) return resolveTop25Pack(season);
  if (CITY_PACKS[id]) return resolveCityPack(CITY_PACKS[id], season);
  if (THEME_PACKS[id]) return resolveThemePack(THEME_PACKS[id].sports);
  return null;
}

/** Published curated packs (HQ-built), listed for every commissioner. */
export async function curatedPackList(includeUnpublished = false): Promise<PackInfo[]> {
  const packs = await db.pickPack.findMany({
    where: includeUnpublished ? {} : { published: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { games: true } } },
  });
  return packs.map((p) => ({
    id: `db:${p.id}`,
    title: p.title,
    emoji: p.emoji,
    description: `${p._count.games} hand-picked games${p.published ? "" : " · draft"}`,
  }));
}

export async function resolveCuratedPack(dbId: string, includeUnpublished = false): Promise<PackGame[] | null> {
  const pack = await db.pickPack.findUnique({
    where: { id: dbId },
    include: { games: { orderBy: { startTime: "asc" } } },
  });
  if (!pack || (!pack.published && !includeUnpublished)) return null;
  return pack.games.map((g) => ({
    sport: g.sport,
    externalId: g.externalId ?? "",
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    startTime: g.startTime,
    completed: Boolean(g.winner),
    started: Boolean(g.winner),
    winner: (g.winner as PackGame["winner"]) ?? null,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    spread: g.spread,
    homeRank: null,
    awayRank: null,
  }));
}
