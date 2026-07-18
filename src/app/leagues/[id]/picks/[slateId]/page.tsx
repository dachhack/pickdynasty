import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isGameLocked, requireMembership } from "@/lib/league";
import { savePicks } from "@/actions/picks";

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

export default async function SlatePicksPage({
  params,
}: {
  params: Promise<{ id: string; slateId: string }>;
}) {
  const { id, slateId } = await params;
  const membership = await requireMembership(id);
  const { league } = membership;

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId: id },
    include: {
      games: {
        orderBy: { startTime: "asc" },
        include: { picks: { include: { membership: { include: { user: true } } } } },
      },
    },
  });
  if (!slate) notFound();

  const anyOpen = slate.games.some((g) => !isGameLocked(g, slate.pickDeadline));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{slate.name}</h2>
          {slate.pickDeadline && (
            <p className="text-sm text-slate-400">
              Slate deadline: {fmt.format(slate.pickDeadline)}
            </p>
          )}
        </div>
        <Link href={`/leagues/${id}/picks`} className="text-sm text-indigo-400 hover:underline">
          All slates →
        </Link>
      </div>

      {league.blindPicks && anyOpen && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-400">
          🕶️ Blind picks are on — everyone&rsquo;s picks are revealed only after each game locks.
        </p>
      )}

      <form action={savePicks} className="flex flex-col gap-4">
        <input type="hidden" name="leagueId" value={id} />
        <input type="hidden" name="slateId" value={slate.id} />

        {slate.games.map((game) => {
          const locked = isGameLocked(game, slate.pickDeadline);
          const myPick = game.picks.find((p) => p.membershipId === membership.id);
          // Blind picks: other players' picks only visible once the game locks
          // (commissioners can peek if the league allows it).
          const showOthers =
            !league.blindPicks ||
            locked ||
            (membership.role === "COMMISSIONER" && league.adminCanSeePicks);
          const others = game.picks.filter((p) => p.membershipId !== membership.id);

          return (
            <div key={game.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{fmt.format(game.startTime)}</p>
                {game.winner ? (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    Final:{" "}
                    {game.winner === "TIE"
                      ? "Tie"
                      : game.winner === "HOME"
                        ? game.homeTeam
                        : game.awayTeam}
                  </span>
                ) : locked ? (
                  <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">Locked</span>
                ) : (
                  <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Open</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {(["AWAY", "HOME"] as const).map((side) => {
                  const team = side === "HOME" ? game.homeTeam : game.awayTeam;
                  const chosen = myPick?.choice === side;
                  const won = game.winner === side;
                  return (
                    <label
                      key={side}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                        chosen
                          ? "border-indigo-500 bg-indigo-950/50 text-white"
                          : "border-slate-700 text-slate-300 hover:border-slate-500"
                      } ${locked ? "cursor-not-allowed opacity-70" : ""} ${
                        won ? "ring-1 ring-emerald-500" : ""
                      }`}
                    >
                      <span>
                        {side === "AWAY" ? "@ " : ""}
                        {team}
                        {won && " ✅"}
                      </span>
                      <input
                        type="radio"
                        name={`pick_${game.id}`}
                        value={side}
                        defaultChecked={chosen}
                        disabled={locked}
                        className="h-4 w-4 accent-indigo-500"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 text-xs text-slate-500">
                {showOthers ? (
                  others.length > 0 ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {others.map((p) => (
                        <span key={p.id}>
                          <span style={{ color: p.membership.teamColor }}>
                            {p.membership.teamEmoji} {p.membership.teamName}
                          </span>
                          : {p.choice === "HOME" ? game.homeTeam : game.awayTeam}
                          {game.winner && game.winner !== "TIE" && (
                            <> {p.choice === game.winner ? "✅" : "❌"}</>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span>No other picks yet.</span>
                  )
                ) : (
                  <span>🕶️ Other players&rsquo; picks hidden until this game locks.</span>
                )}
              </div>
            </div>
          );
        })}

        {slate.games.length === 0 ? (
          <p className="card text-center text-slate-400">No games in this slate yet.</p>
        ) : (
          anyOpen && <button className="btn self-start">Save my picks</button>
        )}
      </form>
    </div>
  );
}
