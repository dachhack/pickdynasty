import { computeStandings, requireMembership } from "@/lib/league";

export default async function LeagueHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership(id);
  const standings = await computeStandings(id);

  return (
    <div className="card overflow-x-auto !p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3 text-right">Correct</th>
            <th className="px-4 py-3 text-right">Decided</th>
            <th className="px-4 py-3 text-right">Win %</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr
              key={row.membershipId}
              className={`border-b border-slate-800/50 last:border-0 ${
                row.membershipId === membership.id ? "bg-indigo-950/30" : ""
              }`}
            >
              <td className="px-4 py-3 font-bold text-slate-500">{i + 1}</td>
              <td className="px-4 py-3">
                <span className="font-semibold" style={{ color: row.teamColor }}>
                  {row.teamEmoji} {row.teamName}
                </span>
                <span className="ml-2 text-xs text-slate-500">{row.userName}</span>
              </td>
              <td className="px-4 py-3 text-right font-bold">{row.correct}</td>
              <td className="px-4 py-3 text-right text-slate-400">{row.decided}</td>
              <td className="px-4 py-3 text-right text-slate-400">
                {(row.pct * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
          {standings.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No players yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
