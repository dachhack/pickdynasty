import { getLeagueView } from "@/lib/leagueView";
import { db } from "@/lib/db";
import { TeamBadge } from "@/components/TeamBadge";
import { scoreMember } from "@/lib/scoring";

export const metadata = { title: "Standings" };

export default async function StandingsPage({ params }: { params: { leagueId: string } }) {
  const { membership, league } = await getLeagueView(params.leagueId);
  if (!membership || !league) return null;

  const [members, rounds] = await Promise.all([
    db.membership.findMany({
      where: { leagueId: league.id, status: "ACTIVE" },
      include: { user: true, picks: true },
    }),
    db.round.findMany({
      where: { leagueId: league.id },
      include: { games: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const allGames = rounds.flatMap((r) => r.games);
  const finals = allGames.filter((g) => g.winner && g.winner !== "VOID").length;

  const rows = members
    .map((m) => ({ member: m, score: scoreMember(m.id, m.picks, allGames, league.pickType) }))
    .sort(
      (a, b) =>
        b.score.points - a.score.points ||
        b.score.correct - a.score.correct ||
        a.score.incorrect - b.score.incorrect
    );

  return (
    <div className="card overflow-x-auto p-0">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="font-bold text-slate-900">Standings</h2>
        <span className="text-sm text-slate-500">{finals} of {allGames.length} games final</span>
      </div>
      <table className="mt-3 w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-5 py-2">#</th>
            <th className="py-2">Team</th>
            <th className="py-2 text-right">Points</th>
            <th className="py-2 text-right">Correct</th>
            <th className="py-2 text-right">Wrong</th>
            <th className="py-2 text-right">Push</th>
            <th className="px-5 py-2 text-right">Picks made</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ member, score }, i) => (
            <tr
              key={member.id}
              className={`border-b border-slate-100 ${member.id === membership.id ? "bg-brand-50/60" : ""}`}
            >
              <td className="px-5 py-2.5 font-mono text-slate-500">
                {i === 0 && score.points > 0 ? "👑" : i + 1}
              </td>
              <td className="py-2">
                <TeamBadge
                  emoji={member.teamEmoji}
                  color={member.teamColor}
                  name={member.teamName ?? member.user.name}
                  sub={member.user.name}
                  size="sm"
                />
              </td>
              <td className="py-2 text-right font-mono font-bold text-slate-900">{score.points}</td>
              <td className="py-2 text-right font-mono text-green-700">{score.correct}</td>
              <td className="py-2 text-right font-mono text-red-600">{score.incorrect}</td>
              <td className="py-2 text-right font-mono text-slate-500">{score.pushes}</td>
              <td className="px-5 py-2 text-right font-mono text-slate-500">{score.picksMade}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="px-5 pb-5 text-sm text-slate-500">No players yet.</p> : <div className="pb-2" />}
    </div>
  );
}
