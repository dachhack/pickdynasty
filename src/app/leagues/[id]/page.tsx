import Link from "next/link";
import {
  buildRecaps,
  computeMovement,
  computeStandingsFrom,
  loadLeagueForStandings,
  requireMembership,
  slateStatus,
} from "@/lib/league";
import { formatMeta } from "@/lib/formats";
import { REACTION_EMOJIS } from "@/lib/reactions";
import PickGrid from "@/components/PickGrid";
import RecapReactions, { type ReactionView } from "@/components/RecapReactions";
import ShareCardButton from "@/components/ShareCardButton";

export default async function LeagueHome({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slate?: string }>;
}) {
  const { id } = await params;
  const { slate: slateParam } = await searchParams;
  const membership = await requireMembership(id);
  const league = await loadLeagueForStandings(id);
  const standings = computeStandingsFrom(league);
  const recaps = buildRecaps(league);
  const movement = computeMovement(league);

  // Pick grid slate: requested, else live drama > open > most recent.
  const gridSlates = league.slates.filter((s) => s.games.length > 0);
  const byStatus = (st: string) =>
    [...gridSlates].reverse().find((s) => slateStatus(s) === st);
  const gridSlate =
    gridSlates.find((s) => s.id === slateParam) ??
    byStatus("live") ??
    byStatus("open") ??
    gridSlates[gridSlates.length - 1] ??
    null;
  const reactionsBySlate = new Map(
    league.slates.map((s) => {
      const views: ReactionView[] = REACTION_EMOJIS.map((emoji) => {
        const rows = s.reactions.filter((r) => r.emoji === emoji);
        return {
          emoji,
          count: rows.length,
          mine: rows.some((r) => r.membershipId === membership.id),
          who: rows.map((r) => r.membership.teamName).join(", "),
        };
      });
      return [s.id, views];
    })
  );
  const meta = formatMeta(league.format);
  const isSurvivor = league.format === "survivor";
  const isConfidence = league.format === "confidence";

  return (
    <div className="flex flex-col gap-6">
      {league.notes && (
        <section className="card !py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            📋 League notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{league.notes}</p>
        </section>
      )}
      {gridSlate && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              🧾 The board · {gridSlate.name}
            </h2>
            {gridSlates.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {gridSlates.map((s) => (
                  <Link
                    key={s.id}
                    href={`/leagues/${id}?slate=${s.id}`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      s.id === gridSlate.id
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <PickGrid
            league={league}
            slateId={gridSlate.id}
            viewer={{
              membershipId: membership.id,
              isCommissioner: membership.role === "COMMISSIONER",
            }}
            standings={standings}
          />
          {league.blindPicks && (
            <p className="text-xs text-slate-500">
              🕶️ Blind picks: everyone&rsquo;s choices appear here once each game locks.
            </p>
          )}
        </section>
      )}

      <h2 className="-mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        📊 Season standings
      </h2>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-3 sm:px-4">#</th>
              <th className="px-2 py-3 sm:px-4">Team</th>
              {isSurvivor ? (
                <>
                  <th className="px-2 py-3 text-right sm:px-4">Status</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right sm:px-4">Weeks survived</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-3 text-right sm:px-4">{isConfidence ? "Points" : "Correct"}</th>
                  {isConfidence && <th className="hidden px-4 py-3 text-right sm:table-cell">Correct</th>}
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Decided</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right sm:px-4">Win %</th>
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
                <td className="px-2 py-3 font-bold text-slate-500 sm:px-4">
                  {i + 1}
                  {movement && (movement.get(row.membershipId) ?? 0) !== 0 && (
                    <span
                      className={`ml-1 text-xs font-bold ${
                        movement.get(row.membershipId)! > 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {movement.get(row.membershipId)! > 0
                        ? `▲${movement.get(row.membershipId)}`
                        : `▼${-movement.get(row.membershipId)!}`}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 sm:px-4">
                  <span className="font-semibold" style={{ color: row.teamColor }}>
                    {row.teamEmoji} {row.teamName}
                  </span>
                  {row.streak >= 3 && (
                    <span
                      className="ml-2 rounded-full bg-orange-950 px-1.5 py-0.5 text-xs font-bold text-orange-300"
                      title={`${row.streak} correct picks in a row`}
                    >
                      🔥{row.streak}
                    </span>
                  )}
                  <span className="ml-2 hidden text-xs text-slate-500 sm:inline">{row.userName}</span>
                </td>
                {isSurvivor ? (
                  <>
                    <td className="px-2 py-3 text-right sm:px-4">
                      {row.alive ? (
                        <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-300">Alive</span>
                      ) : (
                        <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-300">
                          💀 Out{row.eliminatedIn ? ` (${row.eliminatedIn})` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-bold sm:px-4">{row.points}</td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-3 text-right font-bold sm:px-4">{row.points}</td>
                    {isConfidence && <td className="hidden px-4 py-3 text-right text-slate-400 sm:table-cell">{row.correct}</td>}
                    <td className="hidden px-4 py-3 text-right text-slate-400 sm:table-cell">{row.decided}</td>
                    <td className="px-2 py-3 text-right text-slate-400 sm:px-4">{(row.pct * 100).toFixed(0)}%</td>
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
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{r.slateName}</h3>
                <ShareCardButton leagueId={id} slateId={r.slateId} />
              </div>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-slate-300">
                {r.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <RecapReactions
                leagueId={id}
                slateId={r.slateId}
                initial={reactionsBySlate.get(r.slateId) ?? []}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
