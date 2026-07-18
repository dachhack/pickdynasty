"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/league";

export async function submitPicksAction(leagueId: string, roundId: string, formData: FormData) {
  const { membership } = await requireMembership(leagueId);
  const round = await db.round.findFirst({
    where: { id: roundId, leagueId },
    include: { games: true },
  });
  if (!round) return;

  const now = new Date();
  for (const game of round.games) {
    const choice = String(formData.get(`pick_${game.id}`) || "");
    if (choice !== "HOME" && choice !== "AWAY") continue;
    if (game.locksAt.getTime() <= now.getTime()) continue; // locked — silently skip

    await db.pick.upsert({
      where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
      create: { gameId: game.id, membershipId: membership.id, choice },
      update: { choice },
    });
  }

  revalidatePath(`/leagues/${leagueId}/picks`);
  revalidatePath(`/leagues/${leagueId}`);
}
