import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import { espnSupported, fetchScoreboard, toEspnDate } from "@/lib/espn";
import { sportLabel } from "@/lib/sports";
import { importEspnGames } from "@/actions/espn";

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; slateId: string }>;
  searchParams: Promise<{ date?: string; error?: string }>;
}) {
  const { id, slateId } = await params;
  const { date } = await searchParams;
  const me = await requireCommissioner(id);
  const { league } = me;

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId: id },
    include: { games: true },
  });
  if (!slate) notFound();

  if (!espnSupported(league.sport)) {
    return (
      <div className="card max-w-lg">
        <p>
          Automatic imports aren&rsquo;t available for {sportLabel(league.sport)} yet — add games
          manually on the{" "}
          <Link className="text-indigo-400 hover:underline" href={`/leagues/${id}/admin/slates`}>
            slates page
          </Link>
          .
        </p>
      </div>
    );
  }

  // <input type="date"> gives YYYY-MM-DD; ESPN wants YYYYMMDD.
  const espnDate = date ? date.replaceAll("-", "") : toEspnDate(new Date());
  const dateInputValue = `${espnDate.slice(0, 4)}-${espnDate.slice(4, 6)}-${espnDate.slice(6, 8)}`;

  let games: Awaited<ReturnType<typeof fetchScoreboard>> = [];
  let fetchError = "";
  try {
    games = await fetchScoreboard(league.sport, espnDate);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not reach ESPN.";
  }
  const alreadyImported = new Set(slate.games.map((g) => g.externalId).filter(Boolean));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Import games into “{slate.name}”</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pulls the {sportLabel(league.sport)} schedule from ESPN for a given day. Imported games
          sync their final results automatically.
        </p>
      </div>

      <form method="GET" className="card flex items-end gap-3">
        <div>
          <label className="label" htmlFor="date">Day (US Eastern)</label>
          <input className="input" type="date" id="date" name="date" defaultValue={dateInputValue} />
        </div>
        <button className="btn-ghost">Load schedule</button>
      </form>

      {fetchError ? (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          Couldn&rsquo;t load the schedule: {fetchError}
        </p>
      ) : games.length === 0 ? (
        <p className="card text-center text-slate-400">
          No {sportLabel(league.sport)} games on that day.
        </p>
      ) : (
        <form action={importEspnGames} className="card flex flex-col gap-1">
          <input type="hidden" name="leagueId" value={id} />
          <input type="hidden" name="slateId" value={slate.id} />
          <input type="hidden" name="date" value={espnDate} />
          {games.map((g) => {
            const dup = alreadyImported.has(g.externalId);
            return (
              <label
                key={g.externalId}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  dup ? "opacity-50" : "cursor-pointer hover:bg-slate-800/50"
                }`}
              >
                <input
                  type="checkbox"
                  name="selected"
                  value={g.externalId}
                  defaultChecked={!dup && !g.completed}
                  disabled={dup}
                  className="h-4 w-4 accent-indigo-500"
                />
                <span className="font-semibold">
                  {g.awayTeam} @ {g.homeTeam}
                </span>
                <span className="ml-auto text-right text-xs text-slate-500">
                  {dup ? "already imported" : g.completed ? "final" : fmt.format(g.startTime)}
                </span>
              </label>
            );
          })}
          <button className="btn mt-3 self-start">Import selected games</button>
        </form>
      )}

      <Link href={`/leagues/${id}/admin/slates`} className="text-sm text-indigo-400 hover:underline">
        ← Back to slates
      </Link>
    </div>
  );
}
