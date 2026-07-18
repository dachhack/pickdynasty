import { redirect } from "next/navigation";
import { db } from "./db";
import { getCurrentUser } from "./auth";

export function makeInviteCode(): string {
  // Unambiguous alphabet (no 0/O, 1/I/L) for codes shared out loud.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++)
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** Loads the signed-in user's membership in a league, redirecting if absent. */
export async function requireMembership(leagueId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = await db.membership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId } },
    include: { league: true, user: true },
  });
  if (!membership) redirect("/dashboard");
  return membership;
}

export async function requireCommissioner(leagueId: string) {
  const membership = await requireMembership(leagueId);
  if (membership.role !== "COMMISSIONER") redirect(`/leagues/${leagueId}`);
  return membership;
}

export type StandingsRow = {
  membershipId: string;
  teamName: string;
  teamColor: string;
  teamEmoji: string;
  userName: string;
  correct: number;
  decided: number;
  pct: number;
};

/** 1 point per correct pick across all decided games in the league. */
export async function computeStandings(leagueId: string): Promise<StandingsRow[]> {
  const memberships = await db.membership.findMany({
    where: { leagueId },
    include: {
      user: true,
      picks: { include: { game: true } },
    },
  });
  const rows = memberships.map((m) => {
    const decidedPicks = m.picks.filter(
      (p) => p.game.winner && p.game.winner !== "TIE"
    );
    const correct = decidedPicks.filter((p) => p.choice === p.game.winner).length;
    return {
      membershipId: m.id,
      teamName: m.teamName,
      teamColor: m.teamColor,
      teamEmoji: m.teamEmoji,
      userName: m.user.name,
      correct,
      decided: decidedPicks.length,
      pct: decidedPicks.length ? correct / decidedPicks.length : 0,
    };
  });
  rows.sort((a, b) => b.correct - a.correct || b.pct - a.pct || a.teamName.localeCompare(b.teamName));
  return rows;
}

/** A game locks at its start time; a slate deadline (if set) locks the whole slate. */
export function isGameLocked(game: { startTime: Date }, slateDeadline: Date | null): boolean {
  const now = new Date();
  if (slateDeadline && now >= slateDeadline) return true;
  return now >= game.startTime;
}
