"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  isGameLocked,
  loadLeagueForStandings,
  requireMembership,
  usedSurvivorTeams,
} from "@/lib/league";

// Instant-save actions called from the client pick boards. Each returns
// {ok} or {error} so the UI can show save state without a page reload.

export type QuickResult = { ok: true } | { ok: false; error: string };

/** Classic/spread: save one pick the moment it's tapped. */
export async function quickPick(input: {
  leagueId: string;
  slateId: string;
  gameId: string;
  choice: "HOME" | "AWAY";
}): Promise<QuickResult> {
  const membership = await requireMembership(input.leagueId);
  const slate = await db.slate.findFirst({
    where: { id: input.slateId, leagueId: input.leagueId },
    include: { games: true },
  });
  const game = slate?.games.find((g) => g.id === input.gameId);
  if (!slate || !game) return { ok: false, error: "Game not found." };
  if (isGameLocked(game, slate.pickDeadline)) return { ok: false, error: "That game is locked." };

  await db.pick.upsert({
    where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
    update: { choice: input.choice },
    create: { gameId: game.id, membershipId: membership.id, choice: input.choice },
  });
  revalidatePath(`/leagues/${input.leagueId}/picks/${input.slateId}`);
  return { ok: true };
}

/** Survivor: one pick per slate, burned teams rejected server-side. */
export async function quickSurvivorPick(input: {
  leagueId: string;
  slateId: string;
  gameId: string;
  choice: "HOME" | "AWAY";
}): Promise<QuickResult> {
  const membership = await requireMembership(input.leagueId);
  const slate = await db.slate.findFirst({
    where: { id: input.slateId, leagueId: input.leagueId },
    include: { games: true },
  });
  const game = slate?.games.find((g) => g.id === input.gameId);
  if (!slate || !game) return { ok: false, error: "Game not found." };
  if (isGameLocked(game, slate.pickDeadline)) return { ok: false, error: "That game is locked." };

  const team = input.choice === "HOME" ? game.homeTeam : game.awayTeam;
  const full = await loadLeagueForStandings(input.leagueId);
  if (usedSurvivorTeams(full, membership.id, slate.id).has(team)) {
    return { ok: false, error: `You've already burned ${team}.` };
  }

  const existing = await db.pick.findFirst({
    where: { membershipId: membership.id, gameId: { in: slate.games.map((g) => g.id) } },
    include: { game: true },
  });
  if (existing && existing.gameId !== game.id) {
    if (isGameLocked(existing.game, slate.pickDeadline)) {
      return { ok: false, error: "Your current pick is locked in." };
    }
    await db.pick.delete({ where: { id: existing.id } });
  }
  await db.pick.upsert({
    where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
    update: { choice: input.choice },
    create: { gameId: game.id, membershipId: membership.id, choice: input.choice },
  });
  revalidatePath(`/leagues/${input.leagueId}/picks/${input.slateId}`);
  return { ok: true };
}

/** Confidence: save the whole board (choices + drag-assigned ranks) at once. */
export async function saveConfidenceBoard(input: {
  leagueId: string;
  slateId: string;
  picks: { gameId: string; choice: "HOME" | "AWAY"; confidence: number }[];
}): Promise<QuickResult> {
  const membership = await requireMembership(input.leagueId);
  const slate = await db.slate.findFirst({
    where: { id: input.slateId, leagueId: input.leagueId },
    include: { games: true },
  });
  if (!slate) return { ok: false, error: "Slate not found." };
  const maxRank = slate.games.length;

  // Ranks already locked in can't be reassigned.
  const lockedRanks = new Set<number>();
  for (const game of slate.games) {
    if (!isGameLocked(game, slate.pickDeadline)) continue;
    const p = await db.pick.findUnique({
      where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
    });
    if (p?.confidence != null) lockedRanks.add(p.confidence);
  }

  const seen = new Set(lockedRanks);
  for (const pick of input.picks) {
    const game = slate.games.find((g) => g.id === pick.gameId);
    if (!game || isGameLocked(game, slate.pickDeadline)) continue;
    if (pick.choice !== "HOME" && pick.choice !== "AWAY") continue;
    if (!Number.isInteger(pick.confidence) || pick.confidence < 1 || pick.confidence > maxRank)
      return { ok: false, error: "Invalid confidence rank." };
    if (seen.has(pick.confidence)) return { ok: false, error: "Duplicate confidence rank." };
    seen.add(pick.confidence);
    await db.pick.upsert({
      where: { gameId_membershipId: { gameId: pick.gameId, membershipId: membership.id } },
      update: { choice: pick.choice, confidence: pick.confidence },
      create: {
        gameId: pick.gameId,
        membershipId: membership.id,
        choice: pick.choice,
        confidence: pick.confidence,
      },
    });
  }
  revalidatePath(`/leagues/${input.leagueId}/picks/${input.slateId}`);
  return { ok: true };
}

/** Tiebreaker guess, saved on blur. */
export async function quickTiebreaker(input: {
  leagueId: string;
  slateId: string;
  value: number;
}): Promise<QuickResult> {
  const membership = await requireMembership(input.leagueId);
  const slate = await db.slate.findFirst({
    where: { id: input.slateId, leagueId: input.leagueId },
    include: { games: { orderBy: { startTime: "asc" } } },
  });
  if (!slate || slate.games.length === 0) return { ok: false, error: "Slate not found." };
  const lastGame = slate.games[slate.games.length - 1];
  if (isGameLocked(lastGame, slate.pickDeadline)) return { ok: false, error: "Tiebreaker is locked." };
  const value = Math.round(input.value);
  if (!isFinite(value) || value < 0) return { ok: false, error: "Invalid guess." };

  await db.tiebreakerGuess.upsert({
    where: { slateId_membershipId: { slateId: slate.id, membershipId: membership.id } },
    update: { value },
    create: { slateId: slate.id, membershipId: membership.id, value },
  });
  return { ok: true };
}
