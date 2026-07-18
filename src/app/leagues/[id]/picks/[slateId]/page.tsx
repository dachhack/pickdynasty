import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  isGameLocked,
  loadLeagueForStandings,
  requireMembership,
  usedSurvivorTeams,
} from "@/lib/league";
import { formatMeta, spreadLabel } from "@/lib/formats";
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

const ERRORS: Record<string, string> = {
  confidence: "Each confidence rank can only be used once — check your numbers and save again.",
  "used-team": "You've already ridden that team in a previous slate — survivor rules say pick someone new.",
  locked: "That pick is locked — games can't be changed after they start.",
};

export default async function SlatePicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; slateId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id, slateId } = await params;
  const { saved, error } = await searchParams;
  const membership = await requireMembership(id);
  const { league } = membership;
  const meta = formatMeta(league.format);
  const isSurvivor = league.format === "survivor";
  const isConfidence = league.format === "confidence";
  const isSpread = league.format === "spread";

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId: id },
    include: {
      games: {
        orderBy: { startTime: "asc" },
        include: { picks: { include: { membership: { include: { user: true } } } } },
      },
      tiebreakers: { include: { membership: true } },
    },
  });
  if (!slate) notFound();

  const anyOpen = slate.games.some((g) => !isGameLocked(g, slate.pickDeadline));
  const usedTeams = isSurvivor
    ? usedSurvivorTeams(await loadLeagueForStandings(id), membership.id, slate.id)
    : new Set<string>();
  const lastGame = slate.games[slate.games.length - 1];
  const lastLocked = lastGame ? isGameLocked(lastGame, slate.pickDeadline) : true;
  const myTiebreaker = slate.tiebreakers.find((t) => t.membershipId === membership.id);
  const actualTotal =
    lastGame?.homeScore != null && lastGame?.awayScore != null
      ? lastGame.homeScore + lastGame.awayScore
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{slate.name}</h2>
          <p className="text-sm text-slate-400">
            {meta.emoji} {meta.label}
            {isSurvivor && " — pick ONE team; you can never use it again"}
            {isConfidence && ` — rank picks 1–${slate.games.length}, correct picks score their rank`}
            {slate.pickDeadline && ` · deadline ${fmt.format(slate.pickDeadline)}`}
          </p>
        </div>
        <Link href={`/leagues/${id}/picks`} className="text-sm text-indigo-400 hover:underline">
          All slates →
        </Link>
      </div>

      {saved && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Picks saved. 🔏
        </p>
      )}
      {error && ERRORS[error] && (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {ERRORS[error]}
        </p>
      )}
      {league.blindPicks && anyOpen && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-400">
          🕶️ Blind picks are on — everyone&rsquo;s picks are revealed only after each game locks.
        </p>
      )}
      {isSurvivor && usedTeams.size > 0 && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-400">
          💀 Teams you&rsquo;ve burned: {[...usedTeams].join(", ")}
        </p>
      )}

      <form action={savePicks} className="flex flex-col gap-4">
        <input type="hidden" name="leagueId" value={id} />
        <input type="hidden" name="slateId" value={slate.id} />

        {slate.games.map((game) => {
          const locked = isGameLocked(game, slate.pickDeadline);
          const myPick = game.picks.find((p) => p.membershipId === membership.id);
          const showOthers =
            !league.blindPicks ||
            locked ||
            (membership.role === "COMMISSIONER" && league.adminCanSeePicks);
          const others = game.picks.filter((p) => p.membershipId !== membership.id);
          const isFantasy = /^(sleeper|espnf):/.test(game.externalId ?? "");
          const hasScore = game.homeScore != null && game.awayScore != null;
          const live = hasScore && !game.winner;

          return (
            <div key={game.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{fmt.format(game.startTime)}</p>
                {game.winner ? (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    Final{hasScore && `: ${game.awayScore}–${game.homeScore}`}
                    {" · "}
                    {game.winner === "TIE"
                      ? isSpread ? "Push" : "Tie"
                      : `${game.winner === "HOME" ? game.homeTeam : game.awayTeam}${isSpread ? " covers" : ""}`}
                  </span>
                ) : live ? (
                  <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs font-semibold text-red-300">
                    🔴 Live: {game.awayScore}–{game.homeScore}
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
                  const burned = isSurvivor && usedTeams.has(team);
                  return (
                    <label
                      key={side}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                        chosen
                          ? "border-indigo-500 bg-indigo-950/50 text-white"
                          : "border-slate-700 text-slate-300 hover:border-slate-500"
                      } ${locked || burned ? "cursor-not-allowed opacity-60" : ""} ${
                        won ? "ring-1 ring-emerald-500" : ""
                      }`}
                    >
                      <span>
                        {side === "AWAY" && !isFantasy ? "@ " : ""}
                        {team}
                        {isSpread && <span className="text-slate-400">{spreadLabel(side, game.spread)}</span>}
                        {burned && " 💀"}
                        {won && " ✅"}
                      </span>
                      <input
                        type="radio"
                        name={isSurvivor ? "survivorPick" : `pick_${game.id}`}
                        value={isSurvivor ? `${game.id}:${side}` : side}
                        defaultChecked={chosen}
                        disabled={locked || burned}
                        className="h-4 w-4 accent-indigo-500"
                      />
                    </label>
                  );
                })}
              </div>

              {isConfidence && (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                  <label htmlFor={`conf_${game.id}`}>Confidence:</label>
                  <select
                    id={`conf_${game.id}`}
                    name={`conf_${game.id}`}
                    defaultValue={myPick?.confidence ?? ""}
                    disabled={locked}
                    className="input !w-auto !py-1 !text-xs"
                  >
                    <option value="">—</option>
                    {Array.from({ length: slate.games.length }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">points if correct (each rank used once)</span>
                </div>
              )}

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
                          {isConfidence && p.confidence != null && ` (${p.confidence})`}
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

        {!isSurvivor && lastGame && (
          <div className="card">
            <h3 className="text-sm font-bold">🎯 Tiebreaker</h3>
            <p className="mt-1 text-xs text-slate-500">
              Predict the total combined score of {lastGame.awayTeam} vs {lastGame.homeTeam} —
              closest guess wins ties on this slate.
            </p>
            {lastLocked ? (
              <div className="mt-2 text-sm text-slate-400">
                {actualTotal != null && <p>Actual total: <span className="font-bold text-slate-200">{actualTotal}</span></p>}
                {slate.tiebreakers.length > 0 ? (
                  <p className="mt-1 text-xs">
                    Guesses:{" "}
                    {slate.tiebreakers.map((t) => (
                      <span key={t.id} className="mr-3">
                        <span style={{ color: t.membership.teamColor }}>{t.membership.teamEmoji} {t.membership.teamName}</span> {t.value}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-xs">No guesses were made.</p>
                )}
              </div>
            ) : (
              <input
                className="input mt-2 max-w-[10rem]"
                type="number"
                name="tiebreaker"
                min="0"
                placeholder="e.g. 47"
                defaultValue={myTiebreaker?.value ?? ""}
              />
            )}
          </div>
        )}

        {slate.games.length === 0 ? (
          <p className="card text-center text-slate-400">No games in this slate yet.</p>
        ) : (
          anyOpen && (
            <button className="btn self-start">
              {isSurvivor ? "Lock in my survivor pick" : "Save my picks"}
            </button>
          )
        )}
      </form>
    </div>
  );
}
