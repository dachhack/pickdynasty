import { db } from "./db";
import { REACTION_EMOJIS } from "./reactions";

export type MessageView = {
  id: string;
  body: string;
  gifUrl: string | null;
  createdAt: string; // ISO
  author: { name: string; color: string; emoji: string } | null;
  mine: boolean;
  canDelete: boolean;
  reactions: { emoji: string; count: number; mine: boolean; who: string }[];
};

// GIF URLs are restricted to known media hosts so chat can't embed arbitrary
// images. GIPHY serves from numbered subdomains (media0..media4.giphy.com).
const GIF_HOST_PATTERN = /^(media\.tenor\.com|media\d*\.giphy\.com|i\.giphy\.com)$/;

export function isAllowedGifUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && GIF_HOST_PATTERN.test(u.hostname);
  } catch {
    return false;
  }
}

export async function loadMessages(
  leagueId: string,
  viewer: { id: string; role: string }
): Promise<MessageView[]> {
  const messages = await db.message.findMany({
    where: { leagueId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      membership: true,
      reactions: { include: { membership: true } },
    },
  });
  const isCommish = viewer.role === "COMMISSIONER";
  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    gifUrl: m.gifUrl,
    createdAt: m.createdAt.toISOString(),
    author: m.membership
      ? {
          name: m.membership.teamName,
          color: m.membership.teamColor,
          emoji: m.membership.teamEmoji,
        }
      : null,
    mine: m.membershipId === viewer.id,
    canDelete: m.membershipId === viewer.id || isCommish,
    reactions: REACTION_EMOJIS.map((emoji) => {
      const rows = m.reactions.filter((r) => r.emoji === emoji);
      return {
        emoji,
        count: rows.length,
        mine: rows.some((r) => r.membershipId === viewer.id),
        who: rows.map((r) => r.membership.teamName).join(", "),
      };
    }),
  }));
}
