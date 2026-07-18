"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isGameLocked, requireMembership } from "@/lib/league";

/** Saves all picks submitted from a slate form, skipping locked games. */
export async function savePicks(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  const membership = await requireMembership(leagueId);

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId },
    include: { games: true },
  });
  if (!slate) return;

  for (const game of slate.games) {
    const choice = formData.get(`pick_${game.id}`);
    if (choice !== "HOME" && choice !== "AWAY") continue;
    if (isGameLocked(game, slate.pickDeadline)) continue;
    await db.pick.upsert({
      where: { gameId_membershipId: { gameId: game.id, membershipId: membership.id } },
      update: { choice },
      create: { gameId: game.id, membershipId: membership.id, choice },
    });
  }
  revalidatePath(`/leagues/${leagueId}/picks/${slateId}`);
}
