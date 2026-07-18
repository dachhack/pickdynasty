import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import { fetchFantasyMatchups, type FantasyMatchup } from "@/lib/fantasy";
import { importFantasyMatchups } from "@/actions/fantasy";

export default async function FantasyImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; slateId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id, slateId } = await params;
  const { week: weekParam } = await searchParams;
  await requireCommissioner(id);

  const [slate, link] = await Promise.all([
    db.slate.findFirst({ where: { id: slateId, leagueId: id }, include: { games: true } }),
    db.fantasyLink.findUnique({ where: { leagueId: id } }),
  ]);
  if (!slate) notFound();
  if (!link) redirect(`/leagues/${id}/admin`);

  const week = Math.min(Math.max(Number(weekParam) || 1, 1), 18);
  const providerLabel = link.provider === "sleeper" ? "Sleeper" : "ESPN Fantasy";

  let matchups: FantasyMatchup[] = [];
  let fetchError = "";
  try {
    matchups = await fetchFantasyMatchups(link, week);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not reach the fantasy provider.";
  }
  const alreadyImported = new Set(slate.games.map((g) => g.externalId).filter(Boolean));

  // Default lock time for datetime-local: slate deadline if set.
  const lockDefault = slate.pickDeadline
    ? new Date(slate.pickDeadline.getTime() - slate.pickDeadline.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Import fantasy matchups into “{slate.name}”</h2>
        <p className="mt-1 text-sm text-slate-400">
          From <span className="font-semibold text-slate-200">{link.name}</span> ({providerLabel},{" "}
          {link.season}). Members pick which fantasy team wins each head-to-head matchup.
        </p>
      </div>

      <form method="GET" className="card flex items-end gap-3">
        <div>
          <label className="label" htmlFor="week">Fantasy week</label>
          <select className="input" id="week" name="week" defaultValue={String(week)}>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
        </div>
        <button className="btn-ghost">Load matchups</button>
      </form>

      {fetchError ? (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          Couldn&rsquo;t load matchups: {fetchError}
        </p>
      ) : matchups.length === 0 ? (
        <p className="card text-center text-slate-400">No matchups found for week {week}.</p>
      ) : (
        <form action={importFantasyMatchups} className="card flex flex-col gap-1">
          <input type="hidden" name="leagueId" value={id} />
          <input type="hidden" name="slateId" value={slate.id} />
          <input type="hidden" name="week" value={week} />
          {matchups.map((m) => {
            const dup = alreadyImported.has(m.externalId);
            return (
              <label
                key={m.externalId}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  dup ? "opacity-50" : "cursor-pointer hover:bg-slate-800/50"
                }`}
              >
                <input
                  type="checkbox"
                  name="selected"
                  value={m.externalId}
                  defaultChecked={!dup && !m.final}
                  disabled={dup}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className="font-semibold">
                  {m.awayTeam} vs {m.homeTeam}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {dup ? "already imported" : m.final ? "final" : "upcoming"}
                </span>
              </label>
            );
          })}
          <div className="mt-3 border-t border-slate-800 pt-3">
            <label className="label" htmlFor="lockTime">Lock picks at</label>
            <p className="mb-2 text-xs text-slate-500">
              Fantasy matchups have no single kickoff — picks for these matchups lock at this time
              (usually the week&rsquo;s first NFL game).
            </p>
            <input
              className="input max-w-xs"
              type="datetime-local"
              id="lockTime"
              name="lockTime"
              required
              defaultValue={lockDefault}
            />
          </div>
          <button className="btn mt-4 self-start">Import selected matchups</button>
        </form>
      )}

      <Link href={`/leagues/${id}/admin/slates`} className="text-sm text-indigo-400 hover:underline">
        ← Back to slates
      </Link>
    </div>
  );
}
