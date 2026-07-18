"use server";

import { db } from "@/lib/db";
import { requireMembership } from "@/lib/league";
import { isAllowedGifUrl, loadMessages, type MessageView } from "@/lib/chat";
import { REACTION_EMOJIS } from "@/lib/reactions";

export async function sendMessage(input: {
  leagueId: string;
  body: string;
  gifUrl?: string | null;
}): Promise<{ ok: true; message: MessageView } | { ok: false; error: string }> {
  const membership = await requireMembership(input.leagueId);
  const body = input.body.trim().slice(0, 500);
  const gifUrl = input.gifUrl && isAllowedGifUrl(input.gifUrl) ? input.gifUrl : null;
  if (!body && !gifUrl) return { ok: false, error: "Say something (or send a GIF)." };

  const created = await db.message.create({
    data: { leagueId: input.leagueId, membershipId: membership.id, body, gifUrl },
  });
  return {
    ok: true,
    message: {
      id: created.id,
      body: created.body,
      gifUrl: created.gifUrl,
      createdAt: created.createdAt.toISOString(),
      author: {
        name: membership.teamName,
        color: membership.teamColor,
        emoji: membership.teamEmoji,
      },
      mine: true,
      canDelete: true,
      reactions: REACTION_EMOJIS.map((emoji) => ({ emoji, count: 0, mine: false, who: "" })),
    },
  };
}

export async function deleteMessage(input: {
  leagueId: string;
  messageId: string;
}): Promise<{ ok: boolean }> {
  const membership = await requireMembership(input.leagueId);
  const message = await db.message.findFirst({
    where: { id: input.messageId, leagueId: input.leagueId },
  });
  if (!message) return { ok: false };
  const allowed = message.membershipId === membership.id || membership.role === "COMMISSIONER";
  if (!allowed) return { ok: false };
  await db.message.delete({ where: { id: message.id } });
  return { ok: true };
}

export async function toggleMessageReaction(input: {
  leagueId: string;
  messageId: string;
  emoji: string;
}): Promise<{ ok: boolean }> {
  if (!REACTION_EMOJIS.includes(input.emoji)) return { ok: false };
  const membership = await requireMembership(input.leagueId);
  const message = await db.message.findFirst({
    where: { id: input.messageId, leagueId: input.leagueId },
  });
  if (!message) return { ok: false };

  const existing = await db.messageReaction.findUnique({
    where: {
      messageId_membershipId_emoji: {
        messageId: message.id,
        membershipId: membership.id,
        emoji: input.emoji,
      },
    },
  });
  if (existing) await db.messageReaction.delete({ where: { id: existing.id } });
  else
    await db.messageReaction.create({
      data: { messageId: message.id, membershipId: membership.id, emoji: input.emoji },
    });
  return { ok: true };
}

/** Polling fetch used by the chat client (server action = auth for free). */
export async function fetchMessages(leagueId: string): Promise<MessageView[]> {
  const membership = await requireMembership(leagueId);
  return loadMessages(leagueId, membership);
}
