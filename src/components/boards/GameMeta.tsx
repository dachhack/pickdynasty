"use client";

import type { GameView } from "./types";

/** Status chip + other-players line shared by the pick boards. */
export function StatusChip({ game, isSpread }: { game: GameView; isSpread: boolean }) {
  const hasScore = game.homeScore != null && game.awayScore != null;
  if (game.winner) {
    return (
      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
        Final{hasScore && `: ${game.awayScore}–${game.homeScore}`}
        {" · "}
        {game.winner === "TIE"
          ? isSpread ? "Push" : "Tie"
          : `${game.winner === "HOME" ? game.homeTeam : game.awayTeam}${isSpread ? " covers" : ""}`}
      </span>
    );
  }
  if (hasScore) {
    return (
      <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs font-semibold text-red-300">
        🔴 Live: {game.awayScore}–{game.homeScore}
      </span>
    );
  }
  if (game.locked) {
    return <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">Locked</span>;
  }
  return <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Open</span>;
}

export function OthersLine({ game, showConfidence }: { game: GameView; showConfidence: boolean }) {
  return (
    <div className="mt-3 text-xs text-slate-500">
      {game.others === null ? (
        <span>🕶️ Other players&rsquo; picks hidden until this game locks.</span>
      ) : game.others.length === 0 ? (
        <span>No other picks yet.</span>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {game.others.map((p, i) => (
            <span key={i}>
              <span style={{ color: p.teamColor }}>{p.teamEmoji} {p.teamName}</span>
              : {p.choice === "HOME" ? game.homeTeam : game.awayTeam}
              {showConfidence && p.confidence != null && ` (${p.confidence})`}
              {p.correct !== null && <> {p.correct ? "✅" : "❌"}</>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function spreadText(side: "HOME" | "AWAY", spread: number | null): string {
  if (spread == null) return "";
  const line = side === "HOME" ? spread : -spread;
  return ` ${line > 0 ? "+" : ""}${line}`;
}
