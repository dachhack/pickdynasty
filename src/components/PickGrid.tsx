import { isGameLocked, slateScores, type StandingsRow } from "@/lib/league";
import type { loadLeagueForStandings } from "@/lib/league";

type LeagueData = Awaited<ReturnType<typeof loadLeagueForStandings>>;

const rowFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

/**
 * The pool-sheet leaderboard: games down the left (sticky), players across
 * the top (sticky), each cell a player's pick — hidden until the game locks
 * (blind leagues), then marked ✓/✗ as results land — with per-player totals
 * pinned to the bottom while the games scroll.
 */
export default function PickGrid({
  league,
  slateId,
  viewer,
  standings,
  tv = false,
  maxPlayers,
}: {
  league: LeagueData;
  slateId: string;
  // Omitted on public surfaces (TV board): no own-column highlight, no
  // commissioner reveal — everyone sees picks only once games lock.
  viewer?: { membershipId: string; isCommissioner: boolean };
  standings: StandingsRow[];
  // TV mode: bigger type for 10-foot reading.
  tv?: boolean;
  // Cap the columns (TV width) — cut players noted under the table.
  maxPlayers?: number;
}) {
  const slate = league.slates.find((s) => s.id === slateId);
  if (!slate || slate.games.length === 0) {
    return (
      <p className="card py-8 text-center text-sm text-slate-500">
        No games on this slate yet.
      </p>
    );
  }

  const isConfidence = league.format === "confidence";
  const seasonRank = new Map(standings.map((r, i) => [r.membershipId, i]));
  const scores = new Map(
    slateScores(league, slateId).map((s) => [s.membershipId, s])
  );

  // Columns: players by slate score, season rank breaking ties. Spectator
  // hosts are already absent from standings/slateScores.
  const allPlayers = standings
    .map((r) => ({
      ...r,
      slatePoints: scores.get(r.membershipId)?.points ?? 0,
      slateCorrect: scores.get(r.membershipId)?.correct ?? 0,
    }))
    .sort(
      (a, b) =>
        b.slatePoints - a.slatePoints ||
        (seasonRank.get(a.membershipId) ?? 0) - (seasonRank.get(b.membershipId) ?? 0)
    );
  const players = maxPlayers ? allPlayers.slice(0, maxPlayers) : allPlayers;
  const cut = allPlayers.length - players.length;

  // Sticky cells need an opaque background; bg-slate-900 tracks the theme.
  const stickyBg = "bg-slate-900";
  const cellText = tv ? "text-sm" : "text-xs";

  return (
    <div className="card !p-0">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                className={`sticky left-0 top-0 z-30 border-b border-r border-slate-800 ${stickyBg} px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500`}
              >
                Game
              </th>
              {players.map((p) => (
                <th
                  key={p.membershipId}
                  className={`sticky top-0 z-20 border-b border-slate-800 ${stickyBg} px-2 py-2 text-center ${
                    p.membershipId === viewer?.membershipId ? "!bg-indigo-950" : ""
                  }`}
                  title={`${p.teamName} (${p.userName})`}
                >
                  <span className={`block leading-none ${tv ? "text-xl" : "text-base"}`}>{p.teamEmoji}</span>
                  <span
                    className={`mt-1 block truncate font-semibold ${tv ? "max-w-[7rem] text-sm" : "max-w-[5.5rem] text-xs"}`}
                    style={{ color: p.teamColor }}
                  >
                    {p.teamName}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slate.games.map((game) => {
              const locked = isGameLocked(game, slate.pickDeadline);
              const revealed =
                !league.blindPicks ||
                locked ||
                (viewer?.isCommissioner === true && league.adminCanSeePicks);
              const isProp = game.kind === "prop";
              const decided = Boolean(game.winner);
              const live = !isProp && game.homeScore != null && !game.winner;
              return (
                <tr key={game.id} className={live ? "bg-amber-950/20" : ""}>
                  <td
                    className={`sticky left-0 z-10 border-b border-r border-slate-800/60 ${stickyBg} px-3 py-2 ${tv ? "max-w-[13rem]" : "max-w-[8.5rem] sm:max-w-[11rem]"}`}
                  >
                    <p className={`flex items-center gap-1.5 font-semibold ${tv ? "text-sm" : "text-xs"}`}>
                      {isProp && game.propImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={game.propImage}
                          alt=""
                          className={`shrink-0 rounded-full bg-slate-800 object-cover ${tv ? "h-6 w-6" : "h-5 w-5"}`}
                        />
                      )}
                      {!isProp && game.awayLogo && game.homeLogo && (
                        <span className="flex shrink-0 items-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={game.awayLogo} alt="" className={tv ? "h-5 w-5" : "h-4 w-4"} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={game.homeLogo} alt="" className={`-ml-1 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
                        </span>
                      )}
                      <span className="truncate">
                        {isProp ? `${game.propImage ? "" : "🎯 "}${game.propLabel}` : `${game.awayTeam} @ ${game.homeTeam}`}
                      </span>
                    </p>
                    <p className={`text-slate-500 ${tv ? "text-xs" : "text-[11px]"}`}>
                      {isProp && `O/U ${game.line} · `}
                      {decided
                        ? isProp
                          ? `Final${game.propActual != null ? `: ${game.propActual}` : ""}`
                          : `Final ${game.awayScore ?? ""}${game.awayScore != null ? "–" : ""}${game.homeScore ?? ""}`
                        : live
                          ? `🔴 ${game.awayScore}–${game.homeScore}`
                          : `${rowFmt.format(game.startTime)}${locked ? " · 🔒" : ""}`}
                    </p>
                  </td>
                  {players.map((p) => {
                    const pick = game.picks.find(
                      (pk) => pk.membershipId === p.membershipId
                    );
                    const mine = p.membershipId === viewer?.membershipId;
                    const show = revealed || mine;
                    let cell: React.ReactNode = "";
                    let cls = "text-slate-500";
                    if (!pick) {
                      cell = locked ? "—" : "";
                    } else if (!show) {
                      cell = "•"; // picked, still under wraps
                    } else {
                      const text = isProp
                        ? pick.choice === "AWAY" ? "Over" : "Under"
                        : pick.choice === "HOME" ? game.homeTeam : game.awayTeam;
                      const conf = isConfidence && pick.confidence != null ? pick.confidence : null;
                      if (decided && game.winner !== "TIE") {
                        const won = pick.choice === game.winner;
                        cls = won
                          ? "bg-emerald-950/60 font-semibold text-emerald-300"
                          : "bg-red-950/40 text-red-400/80";
                        cell = (
                          <>
                            <span className="block max-w-[5.5rem] truncate">
                              {won ? "✓ " : "✗ "}{text}
                            </span>
                            {conf != null && <span className="text-[10px] opacity-70">+{won ? conf : 0}</span>}
                          </>
                        );
                      } else if (decided) {
                        cls = "text-slate-400";
                        cell = "Push";
                      } else {
                        cls = "text-slate-300";
                        cell = (
                          <>
                            <span className="block max-w-[5.5rem] truncate">{text}</span>
                            {conf != null && <span className="text-[10px] text-slate-500">({conf})</span>}
                          </>
                        );
                      }
                    }
                    return (
                      <td
                        key={p.membershipId}
                        className={`border-b border-slate-800/40 px-2 py-2 text-center ${cellText} ${cls} ${
                          mine && !decided ? "bg-indigo-950/30" : ""
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                className={`sticky bottom-0 left-0 z-30 border-r border-t border-slate-800 ${stickyBg} px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}
              >
                {isConfidence ? "Points (correct)" : "Total correct"}
              </td>
              {players.map((p) => (
                <td
                  key={p.membershipId}
                  className={`sticky bottom-0 z-20 border-t border-slate-800 ${stickyBg} px-2 py-2 text-center font-black ${tv ? "text-lg" : "text-sm"} ${
                    p.membershipId === viewer?.membershipId ? "!bg-indigo-950" : ""
                  }`}
                >
                  {isConfidence ? (
                    <>
                      {p.slatePoints}
                      <span className="ml-1 text-[10px] font-normal text-slate-500">
                        ({p.slateCorrect})
                      </span>
                    </>
                  ) : (
                    p.slateCorrect
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {cut > 0 && (
        <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
          {`+ ${cut} more playing — the full board is on everyone’s phone.`}
        </p>
      )}
    </div>
  );
}
