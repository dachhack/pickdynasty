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
  players: number;
  finished: boolean; // has games and every one is decided
  live: boolean; // has games, some undecided
  winners: string[]; // team names topping a finished night (ties share it)
};

export type VenueBoard = {
  regulars: RegularRow[];
  nights: NightSummary[]; // newest first
};

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

  const rows = new Map<string, RegularRow>();
  const nights: NightSummary[] = [];
  for (const night of nightIds) {
    const league = await loadLeagueForStandings(night.id);
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
      players: league.memberships.length,
      finished,
      live: games.length > 0 && !finished,
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
  return { regulars, nights: nights.reverse() };
}

/** The venue's newest night — what the TV board features and the QR joins. */
export async function latestNight(venueId: string) {
  return db.league.findFirst({
    where: { venueId },
    orderBy: { createdAt: "desc" },
  });
}
