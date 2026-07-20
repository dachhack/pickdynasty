import { db } from "./db";
import { fetchScoreboard, toEspnDate, type EspnGame } from "./espn";
import { fetchFantasyMatchups, parseFantasyExternalId } from "./fantasy";
import { atsWinner } from "./formats";

/**
 * Resolves results for every imported, undecided, started game in a league —
 * real-sport scores (live and final) from the ESPN scoreboard and fantasy
 * matchup outcomes from the linked Sleeper/ESPN fantasy league. In spread
 * leagues the recorded winner is the against-the-spread result. Returns the
 * number of games updated. Shared by the commissioner's "Sync results"
 * action and the cron endpoint.
 */
export async function syncLeagueResults(leagueId: string, sport: string): Promise<number> {
  const league = await db.league.findUnique({ where: { id: leagueId } });
  if (!league) return 0;

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
  const liveScores = new Map<string, EspnGame>();

  // Games may come from different sports than the league's primary (mixed
  // slates) — fetch each unique (sport, date) scoreboard once.
  const sportDates = new Set(
    scoreboardGames.map((g) => `${g.sport ?? sport}|${toEspnDate(g.startTime)}`)
  );
  for (const key of sportDates) {
    const [gameSport, date] = key.split("|");
    for (const g of await fetchScoreboard(gameSport, date)) {
      if (g.started) liveScores.set(g.externalId, g);
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
    const live = game.externalId ? liveScores.get(game.externalId) : undefined;
    let winner = game.externalId ? results.get(game.externalId) : undefined;

    // Spread leagues score against the line, not straight-up.
    if (winner && league.format === "spread" && game.spread != null && live?.homeScore != null && live?.awayScore != null) {
      winner = atsWinner(live.homeScore, live.awayScore, game.spread);
    }

    if (winner || live) {
      await db.game.update({
        where: { id: game.id },
        data: {
          ...(winner ? { winner } : {}),
          ...(live?.homeScore != null ? { homeScore: live.homeScore } : {}),
          ...(live?.awayScore != null ? { awayScore: live.awayScore } : {}),
        },
      });
      updated++;
    }
  }
  return updated;
}
