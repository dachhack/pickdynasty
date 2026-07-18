import { db } from "./db";
import { fetchScoreboard, toEspnDate } from "./espn";
import { fetchFantasyMatchups, parseFantasyExternalId } from "./fantasy";

/**
 * Resolves results for every imported, undecided, started game in a league —
 * real-sport scores from the ESPN scoreboard and fantasy matchup outcomes
 * from the linked Sleeper/ESPN fantasy league. Returns the number updated.
 * Shared by the commissioner's "Sync results" action and the cron endpoint.
 */
export async function syncLeagueResults(leagueId: string, sport: string): Promise<number> {
  const pending = await db.game.findMany({
    where: {
      slate: { leagueId },
      externalId: { not: null },
      winner: null,
      startTime: { lt: new Date() },
    },
  });
  if (pending.length === 0) return 0;

  const scoreboardGames = pending.filter(
    (g) => parseFantasyExternalId(g.externalId!).kind === "scoreboard"
  );
  const fantasyGames = pending.filter(
    (g) => parseFantasyExternalId(g.externalId!).kind === "fantasy"
  );

  const results = new Map<string, "HOME" | "AWAY" | "TIE">();

  const dates = [...new Set(scoreboardGames.map((g) => toEspnDate(g.startTime)))];
  for (const date of dates) {
    for (const g of await fetchScoreboard(sport, date)) {
      if (g.completed && g.winner) results.set(g.externalId, g.winner);
    }
  }

  if (fantasyGames.length > 0) {
    const link = await db.fantasyLink.findUnique({ where: { leagueId } });
    if (link) {
      const weeks = [
        ...new Set(
          fantasyGames.map((g) => {
            const parsed = parseFantasyExternalId(g.externalId!);
            return parsed.kind === "fantasy" ? parsed.week : 0;
          })
        ),
      ].filter(Boolean);
      for (const week of weeks) {
        for (const m of await fetchFantasyMatchups(link, week)) {
          if (m.final && m.winner) results.set(m.externalId, m.winner);
        }
      }
    }
  }

  let updated = 0;
  for (const game of pending) {
    const winner = game.externalId ? results.get(game.externalId) : undefined;
    if (winner) {
      await db.game.update({ where: { id: game.id }, data: { winner } });
      updated++;
    }
  }
  return updated;
}
