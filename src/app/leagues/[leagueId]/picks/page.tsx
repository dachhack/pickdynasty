import { getLeagueView } from "@/lib/leagueView";
import { db } from "@/lib/db";
import { submitPicksAction } from "@/app/actions/picks";
import { coveringSide, gameIsFinal, gameIsLocked } from "@/lib/scoring";

export const metadata = { title: "Picks" };

function fmt(d: Date) {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function PicksPage({ params }: { params: { leagueId: string } }) {
  const { membership, league } = await getLeagueView(params.leagueId);
  if (!membership || !league) return null;

  const [rounds, members] = await Promise.all([
    db.round.findMany({
      where: { leagueId: league.id },
      include: { games: { include: { picks: true }, orderBy: { locksAt: "asc" } } },
      orderBy: { order: "asc" },
    }),
    db.membership.findMany({
      where: { leagueId: league.id, status: "ACTIVE" },
      include: { user: true },
    }),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const now = new Date();

  if (rounds.length === 0) {
    return (
      <div className="card text-center text-slate-600">
        <p className="text-3xl">📅</p>
        <p className="mt-2 font-semibold text-slate-900">No schedule yet</p>
        <p className="mt-1 text-sm">The commissioner hasn&rsquo;t added any games. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {league.blindPicks ? (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          🕶️ Blind picks are on: everyone&rsquo;s picks stay hidden until each game locks. You can change
          your pick any time before lock.
        </p>
      ) : null}

      {rounds.map((round) => {
        const submitRound = submitPicksAction.bind(null, league.id, round.id);
        const hasOpenGames = round.games.some((g) => !gameIsLocked(g, now));
        return (
          <section key={round.id} className="card">
            <h2 className="text-lg font-bold text-slate-900">{round.name}</h2>
            <form action={submitRound} className="mt-3 space-y-3">
              {round.games.length === 0 ? (
                <p className="text-sm text-slate-500">No games in this {`round`} yet.</p>
              ) : null}
              {round.games.map((game) => {
                const locked = gameIsLocked(game, now);
                const final = gameIsFinal(game);
                const myPick = game.picks.find((p) => p.membershipId === membership.id);
                const result = final ? coveringSide(game, league.pickType) : null;
                const revealed = locked || !league.blindPicks;

                return (
                  <div key={game.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-500">
                        {locked ? (final ? "Final" : "🔒 Locked") : `Locks ${fmt(game.locksAt)}`}
                        {game.points > 1 ? ` · ${game.points} pts` : ""}
                      </div>
                      {final && myPick ? (
                        result === "PUSH" || result === "TIE" ? (
                          <span className="badge bg-slate-100 text-slate-600">Push</span>
                        ) : result === myPick.choice ? (
                          <span className="badge bg-green-100 text-green-700">✓ Got it (+{game.points})</span>
                        ) : (
                          <span className="badge bg-red-100 text-red-700">✗ Missed</span>
                        )
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["AWAY", "HOME"] as const).map((side) => {
                        const team = side === "AWAY" ? game.awayTeam : game.homeTeam;
                        const score = side === "AWAY" ? game.awayScore : game.homeScore;
                        const spreadTag =
                          game.spread !== null
                            ? side === "HOME"
                              ? ` (${game.spread > 0 ? "+" : ""}${game.spread})`
                              : ` (${-game.spread > 0 ? "+" : ""}${-game.spread})`
                            : "";
                        const isMine = myPick?.choice === side;
                        const won = final && result === side;
                        return (
                          <label
                            key={side}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                              isMine
                                ? "border-brand-500 bg-brand-50 text-brand-800"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            } ${locked ? "cursor-not-allowed opacity-80" : ""} ${won ? "ring-2 ring-green-400" : ""}`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`pick_${game.id}`}
                                value={side}
                                defaultChecked={isMine}
                                disabled={locked}
                                className="h-4 w-4"
                              />
                              {team}
                              <span className="text-xs font-normal text-slate-500">{spreadTag}</span>
                            </span>
                            {score !== null ? <span className="font-mono">{score}</span> : null}
                          </label>
                        );
                      })}
                    </div>

                    {revealed && game.picks.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                        {game.picks.map((p) => {
                          const m = memberById.get(p.membershipId);
                          if (!m) return null;
                          return (
                            <span
                              key={p.id}
                              className="badge border"
                              style={{ borderColor: m.teamColor, color: m.teamColor, backgroundColor: `${m.teamColor}11` }}
                              title={m.user.name}
                            >
                              {m.teamEmoji} {m.teamName ?? m.user.name}: {p.choice === "HOME" ? game.homeTeam : game.awayTeam}
                            </span>
                          );
                        })}
                      </div>
                    ) : !revealed ? (
                      <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        🕶️ {game.picks.length}/{members.length} picks in — hidden until lock
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {hasOpenGames ? (
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  Save picks for {round.name}
                </button>
              ) : null}
            </form>
          </section>
        );
      })}
    </div>
  );
}
