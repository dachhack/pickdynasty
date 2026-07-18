"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/league";
import { REACTION_EMOJIS } from "@/lib/reactions";

/** Toggle an emoji reaction on a slate's recap. Returns the new state. */
export async function toggleReaction(input: {
  leagueId: string;
  slateId: string;
  emoji: string;
}): Promise<{ ok: boolean; reacted?: boolean }> {
  if (!REACTION_EMOJIS.includes(input.emoji)) return { ok: false };
  const membership = await requireMembership(input.leagueId);
  const slate = await db.slate.findFirst({
    where: { id: input.slateId, leagueId: input.leagueId },
  });
  if (!slate) return { ok: false };

  const existing = await db.reaction.findUnique({
    where: {
      slateId_membershipId_emoji: {
        slateId: input.slateId,
        membershipId: membership.id,
        emoji: input.emoji,
      },
    },
  });
  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
  } else {
    await db.reaction.create({
      data: { slateId: input.slateId, membershipId: membership.id, emoji: input.emoji },
    });
  }
  revalidatePath(`/leagues/${input.leagueId}`);
  return { ok: true, reacted: !existing };
}
