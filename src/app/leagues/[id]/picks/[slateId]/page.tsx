import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  isGameLocked,
  loadLeagueForStandings,
  requireMembership,
  usedSurvivorTeams,
} from "@/lib/league";
import { formatMeta } from "@/lib/formats";
import PickBoard from "@/components/boards/PickBoard";
import ConfidenceBoard from "@/components/boards/ConfidenceBoard";
import TiebreakerBox from "@/components/boards/TiebreakerBox";
import type { GameView } from "@/components/boards/types";

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
  const meta = formatMeta(league.format);
  const isSurvivor = league.format === "survivor";
  const isConfidence = league.format === "confidence";

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId: id },
    include: {
      games: {
        orderBy: { startTime: "asc" },
        include: { picks: { include: { membership: true } } },
      },
      tiebreakers: { include: { membership: true } },
    },
  });
  if (!slate) notFound();

  const anyOpen = slate.games.some((g) => !isGameLocked(g, slate.pickDeadline));
  const usedTeams = isSurvivor
    ? usedSurvivorTeams(await loadLeagueForStandings(id), membership.id, slate.id)
    : new Set<string>();

  const games: GameView[] = slate.games.map((game) => {
    const locked = isGameLocked(game, slate.pickDeadline);
    const showOthers =
      !league.blindPicks ||
      locked ||
      (membership.role === "COMMISSIONER" && league.adminCanSeePicks);
    const myPick = game.picks.find((p) => p.membershipId === membership.id);
    return {
      id: game.id,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      startTimeLabel: fmt.format(game.startTime),
      locked,
      winner: (game.winner as GameView["winner"]) ?? null,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      spread: game.spread,
      isFantasy: /^(sleeper|espnf):/.test(game.externalId ?? ""),
      burnedHome: usedTeams.has(game.homeTeam),
      burnedAway: usedTeams.has(game.awayTeam),
      myChoice: (myPick?.choice as "HOME" | "AWAY") ?? null,
      myConfidence: myPick?.confidence ?? null,
      others: showOthers
        ? game.picks
            .filter((p) => p.membershipId !== membership.id)
            .map((p) => ({
              teamName: p.membership.teamName,
              teamColor: p.membership.teamColor,
              teamEmoji: p.membership.teamEmoji,
              choice: p.choice as "HOME" | "AWAY",
              confidence: p.confidence,
              correct:
                game.winner && game.winner !== "TIE" ? p.choice === game.winner : null,
            }))
        : null,
    };
  });

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
            {slate.pickDeadline && ` · deadline ${fmt.format(slate.pickDeadline)}`}
            {" · picks save instantly"}
          </p>
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
      {isSurvivor && usedTeams.size > 0 && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-400">
          💀 Teams you&rsquo;ve burned: {[...usedTeams].join(", ")}
        </p>
      )}

      {slate.games.length === 0 ? (
        <p className="card text-center text-slate-400">No games in this slate yet.</p>
      ) : isConfidence ? (
        <ConfidenceBoard leagueId={id} slateId={slate.id} games={games} />
      ) : (
        <PickBoard
          leagueId={id}
          slateId={slate.id}
          format={league.format as "classic" | "spread" | "survivor"}
          games={games}
        />
      )}

      {!isSurvivor && lastGame && (
        lastLocked ? (
          <div className="card">
            <h3 className="text-sm font-bold">🎯 Tiebreaker</h3>
            <div className="mt-2 text-sm text-slate-400">
              {actualTotal != null && (
                <p>
                  Actual total for {lastGame.awayTeam} vs {lastGame.homeTeam}:{" "}
                  <span className="font-bold text-slate-200">{actualTotal}</span>
                </p>
              )}
              {slate.tiebreakers.length > 0 ? (
                <p className="mt-1 text-xs">
                  Guesses:{" "}
                  {slate.tiebreakers.map((t) => (
                    <span key={t.id} className="mr-3">
                      <span style={{ color: t.membership.teamColor }}>
                        {t.membership.teamEmoji} {t.membership.teamName}
                      </span>{" "}
                      {t.value}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-xs">No guesses were made.</p>
              )}
            </div>
          </div>
        ) : (
          <TiebreakerBox
            leagueId={id}
            slateId={slate.id}
            matchupLabel={`${lastGame.awayTeam} vs ${lastGame.homeTeam}`}
            initialValue={myTiebreaker?.value ?? null}
          />
        )
      )}
    </div>
  );
}
