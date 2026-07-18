"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  isGameLocked,
  loadLeagueForStandings,
  requireMembership,
  usedSurvivorTeams,
} from "@/lib/league";

/** Saves picks from a slate form. Format-aware; skips locked games. */
export async function savePicks(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  const membership = await requireMembership(leagueId);
  const { league } = membership;
  const dest = `/leagues/${leagueId}/picks/${slateId}`;

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId },
    include: { games: true },
  });
  if (!slate) return;

  if (league.format === "survivor") {
    // One pick per slate: "gameId:CHOICE".
    const raw = String(formData.get("survivorPick") ?? "");
    const [gameId, choice] = raw.split(":");
    const game = slate.games.find((g) => g.id === gameId);
    if (!game || (choice !== "HOME" && choice !== "AWAY")) return;
    if (isGameLocked(game, slate.pickDeadline)) redirect(`${dest}?error=locked`);

    const team = choice === "HOME" ? game.homeTeam : game.awayTeam;
    const full = await loadLeagueForStandings(leagueId);
    if (usedSurvivorTeams(full, membership.id, slate.id).has(team)) {
      redirect(`${dest}?error=used-team`);
    }

    // Replace any other pick in this slate (only if it isn't locked in).
    const gameIds = slate.games.map((g) => g.id);
    const existing = await db.pick.findFirst({
      where: { membershipId: membership.id, gameId: { in: gameIds } },
      include: { game: true },
    });
    if (existing && existing.gameId !== game.id) {
      if (isGameLocked(existing.game, slate.pickDeadline)) redirect(`${dest}?error=locked`);
      await db.pick.delete({ where: { id: existing.id } });
    }
    await db.pick.upsert({
      where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
      update: { choice },
      create: { gameId: game.id, membershipId: membership.id, choice },
    });
    revalidatePath(dest);
    redirect(`${dest}?saved=1`);
  }

  // Classic / confidence / spread: a pick per game.
  const isConfidence = league.format === "confidence";

  // Validate confidence ranks first: unique across the member's slate picks.
  if (isConfidence) {
    const ranks: number[] = [];
    for (const game of slate.games) {
      const locked = isGameLocked(game, slate.pickDeadline);
      let rank: number | null = null;
      if (locked) {
        const existing = await db.pick.findUnique({
          where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
        });
        rank = existing?.confidence ?? null;
      } else {
        const raw = Number(formData.get(`conf_${game.id}`) ?? 0);
        if (raw >= 1 && raw <= slate.games.length) rank = raw;
      }
      if (rank != null) ranks.push(rank);
    }
    if (new Set(ranks).size !== ranks.length) {
      redirect(`${dest}?error=confidence`);
    }
  }

  for (const game of slate.games) {
    const choice = formData.get(`pick_${game.id}`);
    if (choice !== "HOME" && choice !== "AWAY") continue;
    if (isGameLocked(game, slate.pickDeadline)) continue;
    const rawConf = Number(formData.get(`conf_${game.id}`) ?? 0);
    const confidence =
      isConfidence && rawConf >= 1 && rawConf <= slate.games.length ? rawConf : null;
    await db.pick.upsert({
      where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
      update: { choice, confidence },
      create: { gameId: game.id, membershipId: membership.id, choice, confidence },
    });
  }

  // Tiebreaker guess (total points of the last game), if submitted.
  const tbRaw = String(formData.get("tiebreaker") ?? "").trim();
  if (tbRaw !== "") {
    const value = Math.round(Number(tbRaw));
    const lastGame = slate.games.reduce(
      (a, b) => (a && a.startTime > b.startTime ? a : b),
      slate.games[0]
    );
    if (value >= 0 && isFinite(value) && lastGame && !isGameLocked(lastGame, slate.pickDeadline)) {
      await db.tiebreakerGuess.upsert({
        where: { slateId_membershipId: { slateId: slate.id, membershipId: membership.id } },
        update: { value },
        create: { slateId: slate.id, membershipId: membership.id, value },
      });
    }
  }

  revalidatePath(dest);
  redirect(`${dest}?saved=1`);
}
