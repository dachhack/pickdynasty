import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  addGame,
  createSlate,
  deleteGame,
  deleteSlate,
  setResult,
} from "@/actions/admin";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCommissioner(id);

  const slates = await db.slate.findMany({
    where: { leagueId: id },
    orderBy: { order: "asc" },
    include: { games: { orderBy: { startTime: "asc" }, include: { picks: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="card max-w-xl">
        <h2 className="font-bold">➕ New slate</h2>
        <p className="mt-1 text-sm text-slate-400">
          A slate is one round of games — an NFL week, a tournament round, a day of games.
        </p>
        <form action={createSlate} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="leagueId" value={id} />
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input className="input" name="name" required placeholder="Week 1" />
          </div>
          <div>
            <label className="label">Deadline (optional)</label>
            <input className="input" name="pickDeadline" type="datetime-local" />
          </div>
          <button className="btn sm:col-span-3 sm:justify-self-start">Create slate</button>
        </form>
      </section>

      {slates.map((slate) => (
        <section key={slate.id} className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{slate.name}</h2>
            <form action={deleteSlate}>
              <input type="hidden" name="leagueId" value={id} />
              <input type="hidden" name="slateId" value={slate.id} />
              <button className="btn-danger">Delete slate</button>
            </form>
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
