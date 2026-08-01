// 🍻 Venue tier v2: cross-night "bar regulars" standings.
// Each event night is its own League (League.venueId); regulars aggregate
// per USER across nights, so a guest who claims an account keeps their
// record (adoptGuestAccounts moves memberships onto the claimed user).

import { db } from "./db";
import { computeStandingsFrom, loadLeagueForStandings } from "./league";

export type RegularRow = {
  userId: string;
  // Display identity from the member's most recent night at this venue.
  teamName: string;
  teamColor: string;
  teamEmoji: string;
  isGuest: boolean;
  nights: number; // nights with at least one pick made
  nightWins: number; // finished nights topped (ties at the top all count)
  totalPoints: number;
  correct: number;
  decided: number;
  pct: number;
  lastPlayedAt: Date;
};

// Attendance tiers — show up enough and the board says so.
export const REGULAR_TIERS = [
  { minNights: 10, label: "Legend", emoji: "👑" },
  { minNights: 6, label: "Diehard", emoji: "🔥" },
  { minNights: 3, label: "Regular", emoji: "🍻" },
] as const;

export function regularTier(nights: number) {
  return REGULAR_TIERS.find((t) => nights >= t.minNights) ?? null;
}

export type NightSummary = {
  leagueId: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  // Scheduled date (League.eventAt, falling back to createdAt for legacy
  // nights) — nights can be planned days ahead with slates pre-built.
  eventAt: Date;
  upcoming: boolean; // eventAt is in the future (computed here — render is pure)
  players: number;
  finished: boolean; // has games and every one is decided
  live: boolean; // has games, some undecided
  winners: string[]; // team names topping a finished night (ties share it)
  // Events-grid columns:
  firstGameAt: Date | null; // earliest start on the slate
  items: number; // games + props on the night
  sports: string[]; // distinct sport ids across the slate
};

/** Today's date (ET) as yyyy-mm-dd — for date-input defaults (pure render). */
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
export function todayEt(): string {
  return isoDayFmt.format(new Date());
}

export type VenueBoard = {
  regulars: RegularRow[];
  nights: NightSummary[]; // by event date, newest first
};

// A night stays "current" this long past its scheduled date — covers the
// night itself plus games running past midnight.
const NIGHT_CURRENT_WINDOW_MS = 30 * 60 * 60 * 1000;

/**
 * Which night the TV board features and the console calls current:
 * tonight's (or the most recent within the 30h window), else the next
 * planned one, else the most recent past night.
 */
export function pickCurrentNight(nights: NightSummary[]): NightSummary | null {
  const now = Date.now();
  const past = nights.filter((n) => n.eventAt.getTime() <= now); // newest first
  const upcoming = [...nights].reverse().find((n) => n.eventAt.getTime() > now);
  const recent = past[0] ?? null;
  if (recent && now - recent.eventAt.getTime() < NIGHT_CURRENT_WINDOW_MS) return recent;
  return upcoming ?? recent ?? nights[0] ?? null;
}

/**
 * One pass over every linked night: the all-time regulars board plus a
 * per-night summary for the host console. Regulars aggregate by user, and
 * only players who made at least one pick on some night appear — a scanned
 * QR alone doesn't put you on the wall.
 */
export async function computeVenueBoard(venueId: string): Promise<VenueBoard> {
  const nightIds = await db.league.findMany({
    where: { venueId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  // Load every night in parallel — sequential loads made big venues
  // noticeably slow to render.
  const leagues = await Promise.all(
    nightIds.map((n) => loadLeagueForStandings(n.id))
  );

  const rows = new Map<string, RegularRow>();
  const nights: NightSummary[] = [];
  for (const league of leagues) {
    const standings = computeStandingsFrom(league);
    const games = league.slates.flatMap((s) => s.games);
    const finished = games.length > 0 && games.every((g) => g.winner);
    const topPoints = standings[0]?.points ?? 0;
    const userOf = new Map(league.memberships.map((m) => [m.id, m.user]));
    const picked = new Set(games.flatMap((g) => g.picks.map((p) => p.membershipId)));

    nights.push({
      leagueId: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      createdAt: league.createdAt,
      eventAt: league.eventAt ?? league.createdAt,
      upcoming: (league.eventAt ?? league.createdAt).getTime() > Date.now(),
      players: league.memberships.filter((m) => !m.spectator).length,
      finished,
      live: games.length > 0 && !finished,
      firstGameAt: games.length
        ? games.reduce((min, g) => (g.startTime < min ? g.startTime : min), games[0].startTime)
        : null,
      items: games.length,
      sports: [...new Set(games.map((g) => g.sport ?? league.sport))],
      winners: finished && topPoints > 0
        ? standings
            .filter((s) => s.points === topPoints)
            .map((s) => `${s.teamEmoji} ${s.teamName}`)
        : [],
    });

    for (const s of standings) {
      if (!picked.has(s.membershipId)) continue; // joined but never picked
      const user = userOf.get(s.membershipId);
      if (!user) continue;
      const prev = rows.get(user.id);
      const won = finished && topPoints > 0 && s.points === topPoints;
      const row: RegularRow = prev ?? {
        userId: user.id,
        teamName: s.teamName,
        teamColor: s.teamColor,
        teamEmoji: s.teamEmoji,
        isGuest: user.isGuest,
        nights: 0,
        nightWins: 0,
        totalPoints: 0,
        correct: 0,
        decided: 0,
        pct: 0,
        lastPlayedAt: league.createdAt,
      };
      row.nights++;
      if (won) row.nightWins++;
      row.totalPoints += s.points;
      row.correct += s.correct;
      row.decided += s.decided;
      // Nights iterate oldest→newest, so this ends on the latest identity.
      row.teamName = s.teamName;
      row.teamColor = s.teamColor;
      row.teamEmoji = s.teamEmoji;
      row.isGuest = user.isGuest;
      row.lastPlayedAt = league.createdAt;
      rows.set(user.id, row);
    }
  }

  const regulars = [...rows.values()];
  for (const r of regulars) r.pct = r.decided ? r.correct / r.decided : 0;
  regulars.sort(
    (a, b) =>
      b.nightWins - a.nightWins ||
      b.totalPoints - a.totalPoints ||
      b.nights - a.nights ||
      a.teamName.localeCompare(b.teamName)
  );
  nights.sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());
  return { regulars, nights };
}
