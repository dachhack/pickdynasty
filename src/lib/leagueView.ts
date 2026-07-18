import { getSessionUser } from "./auth";
import { db } from "./db";

/** Loads the signed-in user's view of a league, or nulls when signed out / not a member. */
export async function getLeagueView(leagueId: string) {
  const user = await getSessionUser();
  if (!user) return { user: null, membership: null, league: null } as const;
  const membership = await db.membership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId } },
    include: { league: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    return { user, membership: null, league: null } as const;
  }
  return { user, membership, league: membership.league } as const;
}
