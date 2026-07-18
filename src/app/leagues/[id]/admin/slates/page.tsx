import Link from "next/link";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import { espnSupported } from "@/lib/espn";
import {
  addGame,
  deleteGame,
  deleteSlate,
  setResult,
} from "@/actions/admin";
import { syncEspnResults } from "@/actions/espn";

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

export default async function AdminSlatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ synced?: string; created?: string }>;
}) {
  const { id } = await params;
  const { synced, created } = await searchParams;
  const me = await requireCommissioner(id);
  const autoScores = espnSupported(me.league.sport);
  const fantasyLink = await db.fantasyLink.findUnique({ where: { leagueId: id } });

  const slates = await db.slate.findMany({
    where: { leagueId: id },
    orderBy: { order: "asc" },
    include: { games: { orderBy: { startTime: "asc" }, include: { picks: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      {synced && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Results synced from ESPN.
        </p>
      )}
      {created && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          🚀 Season autopilot created {created} {Number(created) === 1 ? "slate" : "slates"}.
        </p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Slates</h2>
        <Link href={`/leagues/${id}/admin/slates/new`} className="btn">
          ➕ New slate
        </Link>
      </div>
      {(autoScores || fantasyLink) && (
        <form action={syncEspnResults} className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">📡 Auto results</h2>
            <p className="text-sm text-slate-400">
              Fetch results for every imported game that has started
              {autoScores && " — real scores from ESPN"}
              {autoScores && fantasyLink && ","}
              {fantasyLink && ` fantasy outcomes from ${fantasyLink.name}`}.
            </p>
          </div>
          <input type="hidden" name="leagueId" value={id} />
          <button className="btn">Sync results now</button>
        </form>
      )}
      {slates.length === 0 && (
        <p className="card text-center text-slate-400">
          No slates yet — hit <span className="font-semibold text-slate-200">➕ New slate</span> to
          import a week of games in a couple of taps.
        </p>
      )}

      {slates.map((slate) => (
        <section key={slate.id} className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{slate.name}</h2>
            <div className="flex items-center gap-2">
              {autoScores && (
                <Link
                  href={`/leagues/${id}/admin/slates/${slate.id}/import`}
                  className="btn-ghost !px-3 !py-1.5 !text-xs"
                >
                  📥 Import from ESPN
                </Link>
              )}
              {fantasyLink && (
                <Link
                  href={`/leagues/${id}/admin/slates/${slate.id}/fantasy`}
                  className="btn-ghost !px-3 !py-1.5 !text-xs"
                >
                  🏆 Import fantasy matchups
                </Link>
              )}
              <form action={deleteSlate}>
                <input type="hidden" name="leagueId" value={id} />
                <input type="hidden" name="slateId" value={slate.id} />
                <button className="btn-danger">Delete slate</button>
              </form>
            </div>
          </div>
          {slate.pickDeadline && (
            <p className="text-sm text-slate-400">Deadline: {fmt.format(slate.pickDeadline)}</p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {slate.games.map((game) => (
              <div key={game.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {game.awayTeam} @ {game.homeTeam}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmt.format(game.startTime)} · {game.picks.length} picks in
                      {game.externalId && " · 📡 auto-synced"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setResult} className="flex items-center gap-2">
                      <input type="hidden" name="leagueId" value={id} />
                      <input type="hidden" name="gameId" value={game.id} />
                      <select
                        className="input !w-auto !py-1.5 !text-xs"
                        name="winner"
                        defaultValue={game.winner ?? "CLEAR"}
                      >
                        <option value="CLEAR">No result</option>
                        <option value="AWAY">{game.awayTeam} won</option>
                        <option value="HOME">{game.homeTeam} won</option>
                        <option value="TIE">Tie / push</option>
                      </select>
                      <button className="btn-ghost !px-3 !py-1.5 !text-xs">Set</button>
                    </form>
                    <form action={deleteGame}>
                      <input type="hidden" name="leagueId" value={id} />
                      <input type="hidden" name="gameId" value={game.id} />
                      <button className="btn-danger">✕</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
            {slate.games.length === 0 && (
              <p className="text-sm text-slate-500">No games yet — add the first one below.</p>
            )}
          </div>

          <form action={addGame} className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-4">
            <input type="hidden" name="leagueId" value={id} />
            <input type="hidden" name="slateId" value={slate.id} />
            <div>
              <label className="label">Away team</label>
              <input className="input" name="awayTeam" required placeholder="Ohio State" />
            </div>
            <div>
              <label className="label">Home team</label>
              <input className="input" name="homeTeam" required placeholder="Michigan" />
            </div>
            <div>
              <label className="label">Start time</label>
              <input className="input" name="startTime" type="datetime-local" required />
            </div>
            <button className="btn self-end">Add game</button>
          </form>
        </section>
      ))}
    </div>
  );
}
