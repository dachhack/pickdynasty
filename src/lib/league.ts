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

/** A game locks at its start time; a slate deadline (if set) locks the whole slate. */
export function isGameLocked(game: { startTime: Date }, slateDeadline: Date | null): boolean {
  const now = new Date();
  if (slateDeadline && now >= slateDeadline) return true;
  return now >= game.startTime;
}

// ---------------- Standings ----------------

export type StandingsRow = {
  membershipId: string;
  teamName: string;
  teamColor: string;
  teamEmoji: string;
  userName: string;
  points: number; // format-scored: correct picks, confidence sum, or weeks survived
  correct: number;
  decided: number;
  pct: number;
  // Survivor only:
  alive?: boolean;
  eliminatedIn?: string; // slate name
};

type LeagueForStandings = Awaited<ReturnType<typeof loadLeagueForStandings>>;

export async function loadLeagueForStandings(leagueId: string) {
  return db.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: {
      memberships: { include: { user: true } },
      slates: {
        orderBy: { order: "asc" },
        include: {
          games: { orderBy: { startTime: "asc" }, include: { picks: true } },
          tiebreakers: true,
        },
      },
    },
  });
}

export function computeStandingsFrom(league: LeagueForStandings): StandingsRow[] {
  const rows = league.memberships.map((m): StandingsRow => {
    const base = {
      membershipId: m.id,
      teamName: m.teamName,
      teamColor: m.teamColor,
      teamEmoji: m.teamEmoji,
      userName: m.user.name,
    };

    let points = 0;
    let correct = 0;
    let decided = 0;

    if (league.format === "survivor") {
      let alive = true;
      let eliminatedIn: string | undefined;
      for (const slate of league.slates) {
        if (!alive || slate.games.length === 0) continue;
        const pick = slate.games.flatMap((g) => g.picks).find((p) => p.membershipId === m.id);
        const game = pick ? slate.games.find((g) => g.id === pick.gameId) : undefined;
        const slateDone = slate.games.every((g) => g.winner);
        if (pick && game?.winner && game.winner !== "TIE") {
          decided++;
          if (pick.choice === game.winner) {
            correct++;
            points++; // weeks survived
          } else {
            alive = false;
            eliminatedIn = slate.name;
          }
        } else if (!pick && slateDone) {
          // Whole slate decided and never picked -> eliminated.
          alive = false;
          eliminatedIn = slate.name;
        }
      }
      return {
        ...base,
        points,
        correct,
        decided,
        pct: decided ? correct / decided : 0,
        alive,
        eliminatedIn,
      };
    }

    for (const slate of league.slates) {
      for (const game of slate.games) {
        const pick = game.picks.find((p) => p.membershipId === m.id);
        if (!pick || !game.winner || game.winner === "TIE") continue;
        decided++;
        if (pick.choice === game.winner) {
          correct++;
          points += league.format === "confidence" ? (pick.confidence ?? 1) : 1;
        }
      }
    }
    return { ...base, points, correct, decided, pct: decided ? correct / decided : 0 };
  });

  rows.sort((a, b) => {
    if (league.format === "survivor" && a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.points - a.points || b.pct - a.pct || a.teamName.localeCompare(b.teamName);
  });
  return rows;
}

export async function computeStandings(leagueId: string): Promise<StandingsRow[]> {
  return computeStandingsFrom(await loadLeagueForStandings(leagueId));
}

/** Team names a survivor member has already used (can't be picked again). */
export function usedSurvivorTeams(
  league: LeagueForStandings,
  membershipId: string,
  excludeSlateId?: string
): Set<string> {
  const used = new Set<string>();
  for (const slate of league.slates) {
    if (slate.id === excludeSlateId) continue;
    for (const game of slate.games) {
      const pick = game.picks.find((p) => p.membershipId === membershipId);
      if (pick) used.add(pick.choice === "HOME" ? game.homeTeam : game.awayTeam);
    }
  }
  return used;
}

// ---------------- Weekly recaps ----------------

export type Recap = { slateId: string; slateName: string; lines: string[] };

/** Story lines for every fully-decided slate, newest first. */
export function buildRecaps(league: LeagueForStandings): Recap[] {
  const nameOf = new Map(league.memberships.map((m) => [m.id, `${m.teamEmoji} ${m.teamName}`]));
  const recaps: Recap[] = [];

  for (const slate of league.slates) {
    if (slate.games.length === 0 || !slate.games.every((g) => g.winner)) continue;
    const lines: string[] = [];
    const gamesDecided = slate.games.filter((g) => g.winner && g.winner !== "TIE");

    if (league.format === "survivor") {
      const out: string[] = [];
      const through: string[] = [];
      for (const m of league.memberships) {
        const pick = slate.games.flatMap((g) => g.picks).find((p) => p.membershipId === m.id);
        const game = pick ? slate.games.find((g) => g.id === pick.gameId) : undefined;
        if (!pick || !game?.winner) out.push(nameOf.get(m.id)!);
        else if (game.winner === "TIE" || pick.choice === game.winner) through.push(nameOf.get(m.id)!);
        else out.push(nameOf.get(m.id)!);
      }
      if (through.length) lines.push(`Survived: ${through.join(", ")}.`);
      if (out.length) lines.push(`💀 Eliminated: ${out.join(", ")}.`);
    } else {
      // Per-member slate score.
      const scores = league.memberships.map((m) => {
        let pts = 0;
        let right = 0;
        for (const g of gamesDecided) {
          const p = g.picks.find((p) => p.membershipId === m.id);
          if (p && p.choice === g.winner) {
            right++;
            pts += league.format === "confidence" ? (p.confidence ?? 1) : 1;
          }
        }
        return { m, pts, right };
      });
      const best = Math.max(...scores.map((s) => s.pts), 0);
      const winners = scores.filter((s) => s.pts === best && best > 0);
      if (winners.length) {
        const label = league.format === "confidence" ? "pts" : `of ${gamesDecided.length}`;
        lines.push(
          `🏅 Best: ${winners.map((w) => `${nameOf.get(w.m.id)} (${league.format === "confidence" ? w.pts : w.right} ${label})`).join(", ")}.`
        );
      }
      // Biggest upset: decided game whose winning side was picked by the fewest.
      let upset: { g: (typeof gamesDecided)[number]; backers: number } | null = null;
      for (const g of gamesDecided) {
        if (g.picks.length < 2) continue;
        const backers = g.picks.filter((p) => p.choice === g.winner).length;
        if (backers / g.picks.length < 0.5 && (!upset || backers < upset.backers)) {
          upset = { g, backers };
        }
      }
      if (upset) {
        const winnerName = upset.g.winner === "HOME" ? upset.g.homeTeam : upset.g.awayTeam;
        const seers = upset.g.picks
          .filter((p) => p.choice === upset!.g.winner)
          .map((p) => nameOf.get(p.membershipId));
        lines.push(
          `😱 Upset: ${winnerName} beat ${upset.g.winner === "HOME" ? upset.g.awayTeam : upset.g.homeTeam} — ${
            seers.length ? `only ${seers.join(", ")} saw it coming` : "nobody saw it coming"
          }.`
        );
      }
      // Tiebreaker: closest guess to the last game's total.
      const last = slate.games[slate.games.length - 1];
      if (last?.homeScore != null && last?.awayScore != null && slate.tiebreakers.length > 0) {
        const total = last.homeScore + last.awayScore;
        const closest = [...slate.tiebreakers].sort(
          (a, b) => Math.abs(a.value - total) - Math.abs(b.value - total)
        )[0];
        lines.push(
          `🎯 Tiebreaker: ${last.awayTeam}/${last.homeTeam} totaled ${total} — closest was ${nameOf.get(closest.membershipId)} (${closest.value}).`
        );
      }
    }
    if (lines.length) recaps.push({ slateId: slate.id, slateName: slate.name, lines });
  }
  return recaps.reverse();
}

// ---------------- Slate status (shared by the card UIs) ----------------

export type SlateStatus = "upcoming" | "open" | "live" | "final";

export function slateStatus(
  slate: { pickDeadline: Date | null; games: { startTime: Date; winner: string | null }[] }
): SlateStatus {
  if (slate.games.length === 0) return "upcoming";
  if (slate.games.every((g) => g.winner)) return "final";
  const anyOpen = slate.games.some((g) => !isGameLocked(g, slate.pickDeadline));
  if (anyOpen) return "open";
  return "live";
}

export const SLATE_STATUS_UI: Record<SlateStatus, { label: string; cls: string }> = {
  upcoming: { label: "Draft", cls: "bg-slate-800 text-slate-400" },
  open: { label: "🟢 Open", cls: "bg-emerald-950 text-emerald-300" },
  live: { label: "🔒 In progress", cls: "bg-amber-950 text-amber-300" },
  final: { label: "✅ Final", cls: "bg-slate-800 text-slate-300" },
};
