import Link from "next/link";
import { getLeagueView } from "@/lib/leagueView";
import { db } from "@/lib/db";
import { TeamBadge } from "@/components/TeamBadge";
import { gameIsLocked, scoreMember } from "@/lib/scoring";
import { formatCents } from "@/lib/money";

export default async function LeagueOverviewPage({ params }: { params: { leagueId: string } }) {
  const { membership, league } = await getLeagueView(params.leagueId);
  if (!membership || !league) return null; // layout redirects

  const [members, rounds] = await Promise.all([
    db.membership.findMany({
      where: { leagueId: league.id, status: "ACTIVE" },
      include: { user: true, picks: true },
    }),
    db.round.findMany({
      where: { leagueId: league.id },
      include: { games: { include: { picks: true }, orderBy: { locksAt: "asc" } } },
      orderBy: { order: "asc" },
    }),
  ]);

  const allGames = rounds.flatMap((r) => r.games);
  const now = new Date();
  const upcoming = allGames
    .filter((g) => !gameIsLocked(g, now))
    .sort((a, b) => a.locksAt.getTime() - b.locksAt.getTime())
    .slice(0, 5);

  const scores = members
    .map((m) => ({
      member: m,
      score: scoreMember(m.id, m.picks, allGames, league.pickType),
    }))
    .sort((a, b) => b.score.points - a.score.points || b.score.correct - a.score.correct);

  const myUpcomingUnpicked = upcoming.filter(
    (g) => !g.picks.some((p) => p.membershipId === membership.id)
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {myUpcomingUnpicked.length > 0 ? (
          <div className="card border-amber-300 bg-amber-50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-amber-900">⏰ You have picks to make</div>
                <div className="text-sm text-amber-800">
                  {myUpcomingUnpicked.length} upcoming game{myUpcomingUnpicked.length === 1 ? "" : "s"} without a pick.
                </div>
              </div>
              <Link href={`/leagues/${league.id}/picks`} className="btn-primary shrink-0">Make picks</Link>
            </div>
          </div>
        ) : null}

        <div className="card">
          <h2 className="font-bold text-slate-900">Upcoming games</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No upcoming games. {`The commissioner can add games in the Admin tab.`}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {upcoming.map((g) => {
                const picked = g.picks.filter((p) =>
                  members.some((m) => m.id === p.membershipId)
                ).length;
                return (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {g.awayTeam} @ {g.homeTeam}
                        {g.spread !== null ? (
                          <span className="ml-1 text-xs text-slate-500">
                            ({g.spread > 0 ? `+${g.spread}` : g.spread})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        Locks {g.locksAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className="badge bg-slate-100 text-slate-600" title="Picks are blind — counts only until lock">
                      {picked}/{members.length} picked in
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Standings</h2>
            <Link href={`/leagues/${league.id}/standings`} className="text-sm font-semibold text-brand-600">
              Full standings →
            </Link>
          </div>
          <ol className="mt-3 space-y-2">
            {scores.slice(0, 5).map(({ member, score }, i) => (
              <li key={member.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-right font-mono text-sm text-slate-500">{i + 1}</span>
                  <TeamBadge
                    emoji={member.teamEmoji}
                    color={member.teamColor}
                    name={member.teamName ?? member.user.name}
                    sub={member.user.name}
                    size="sm"
                  />
                </div>
                <span className="font-mono text-sm font-bold text-slate-900">{score.points} pts</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="font-bold text-slate-900">League info</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Players</dt>
              <dd className="font-semibold">{members.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Buy-in</dt>
              <dd className="font-semibold">
                {league.buyInCents > 0 ? formatCents(league.buyInCents, league.currency) : "Free"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Blind picks</dt>
              <dd className="font-semibold">{league.blindPicks ? "On 🕶️" : "Off"}</dd>
            </div>
          </dl>
          {league.description ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{league.description}</p>
          ) : null}
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-900">My team</h2>
          <div className="mt-3">
            <TeamBadge
              emoji={membership.teamEmoji}
              color={membership.teamColor}
              name={membership.teamName ?? "My team"}
              sub={membership.teamMotto ?? undefined}
            />
          </div>
          <Link href={`/leagues/${league.id}/team`} className="btn-secondary mt-4 w-full">
            Edit team branding
          </Link>
        </div>
      </div>
    </div>
  );
}
