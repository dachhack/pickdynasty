import {
  buildRecaps,
  computeStandingsFrom,
  loadLeagueForStandings,
  requireMembership,
} from "@/lib/league";
import { formatMeta } from "@/lib/formats";

export default async function LeagueHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership(id);
  const league = await loadLeagueForStandings(id);
  const standings = computeStandingsFrom(league);
  const recaps = buildRecaps(league);
  const meta = formatMeta(league.format);
  const isSurvivor = league.format === "survivor";
  const isConfidence = league.format === "confidence";

  return (
    <div className="flex flex-col gap-6">
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Team</th>
              {isSurvivor ? (
                <>
                  <th className="px-4 py-3 text-right">Status</th>
                  <th className="px-4 py-3 text-right">Weeks survived</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-right">{isConfidence ? "Points" : "Correct"}</th>
                  {isConfidence && <th className="px-4 py-3 text-right">Correct</th>}
                  <th className="px-4 py-3 text-right">Decided</th>
                  <th className="px-4 py-3 text-right">Win %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr
                key={row.membershipId}
                className={`border-b border-slate-800/50 last:border-0 ${
                  row.membershipId === membership.id ? "bg-indigo-950/30" : ""
                } ${isSurvivor && !row.alive ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 font-bold text-slate-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold" style={{ color: row.teamColor }}>
                    {row.teamEmoji} {row.teamName}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">{row.userName}</span>
                </td>
                {isSurvivor ? (
                  <>
                    <td className="px-4 py-3 text-right">
                      {row.alive ? (
                        <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-300">Alive</span>
                      ) : (
                        <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-300">
                          💀 Out{row.eliminatedIn ? ` (${row.eliminatedIn})` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{row.points}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right font-bold">{row.points}</td>
                    {isConfidence && <td className="px-4 py-3 text-right text-slate-400">{row.correct}</td>}
                    <td className="px-4 py-3 text-right text-slate-400">{row.decided}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{(row.pct * 100).toFixed(0)}%</td>
                  </>
                )}
              </tr>
            ))}
            {standings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No players yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
          {meta.emoji} {meta.label}: {meta.blurb}
        </p>
      </div>

      {recaps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">📰 Recaps</h2>
          {recaps.map((r) => (
            <div key={r.slateId} className="card !py-4">
              <h3 className="font-bold">{r.slateName}</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-slate-300">
                {r.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
