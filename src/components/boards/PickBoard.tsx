"use client";

import { useRef, useState, useTransition } from "react";
import { quickPick, quickPickBulk, quickSurvivorPick } from "@/actions/quickpicks";
import type { GameView, SaveState } from "./types";
import SaveChip from "./SaveChip";
import { OthersLine, StatusChip, spreadText } from "./GameMeta";
import { celebrate, tapHaptic } from "./celebrate";

// Module-level so the coin flip stays out of render scope (event-handler only).
function coinFlip(): "HOME" | "AWAY" {
  return Math.random() < 0.5 ? "HOME" : "AWAY";
}

/**
 * Instant-save pick board for classic / spread / survivor leagues:
 * tap a team and it saves immediately — no save button to forget.
 */
export default function PickBoard({
  leagueId,
  slateId,
  format,
  games,
}: {
  leagueId: string;
  slateId: string;
  format: "classic" | "spread" | "survivor";
  games: GameView[];
}) {
  const isSurvivor = format === "survivor";
  const isSpread = format === "spread";
  const [choices, setChoices] = useState<Record<string, "HOME" | "AWAY">>(() =>
    Object.fromEntries(games.filter((g) => g.myChoice).map((g) => [g.id, g.myChoice!]))
  );
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(state: SaveState, revertTo?: Record<string, "HOME" | "AWAY">) {
    setSave(state);
    if (revertTo) setChoices(revertTo);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    if (state.kind !== "saving") {
      clearTimer.current = setTimeout(
        () => setSave({ kind: "idle" }),
        state.kind === "error" ? 4000 : 1500
      );
    }
  }

  const unlockedIds = games.filter((g) => !g.locked).map((g) => g.id);
  const isComplete = (c: Record<string, "HOME" | "AWAY">) =>
    isSurvivor ? Object.keys(c).length > 0 : unlockedIds.every((id) => c[id]);

  function afterSave(before: Record<string, "HOME" | "AWAY">, next: Record<string, "HOME" | "AWAY">) {
    if (!isComplete(before) && isComplete(next) && unlockedIds.length > 0) {
      celebrate();
      flash({ kind: "saved", message: isSurvivor ? "Survivor pick locked 🎉" : "All picks in — locked and loaded 🎉" });
    } else {
      flash({ kind: "saved" });
    }
  }

  function onPick(game: GameView, side: "HOME" | "AWAY") {
    if (game.locked) return;
    tapHaptic();
    const before = choices;
    const next = isSurvivor ? { [game.id]: side } : { ...choices, [game.id]: side };
    setChoices(next);
    setSave({ kind: "saving" });
    startTransition(async () => {
      try {
        const action = isSurvivor ? quickSurvivorPick : quickPick;
        const result = await action({ leagueId, slateId, gameId: game.id, choice: side });
        if (result.ok) afterSave(before, next);
        else flash({ kind: "error", message: result.error }, before);
      } catch {
        flash({ kind: "error", message: "Couldn't save — try again." }, before);
      }
    });
  }

  // Quick picks fill only your REMAINING unlocked games — they never
  // overwrite a choice you've already made.
  function quickFill(mode: "home" | "favorites" | "coin") {
    const remaining = games.filter((g) => !g.locked && !choices[g.id]);
    const picks: { gameId: string; choice: "HOME" | "AWAY" }[] = [];
    for (const g of remaining) {
      if (mode === "home") picks.push({ gameId: g.id, choice: "HOME" });
      else if (mode === "coin") picks.push({ gameId: g.id, choice: coinFlip() });
      else if (g.spread != null)
        picks.push({ gameId: g.id, choice: g.spread < 0 ? "HOME" : "AWAY" });
    }
    if (picks.length === 0) return;
    tapHaptic();
    const before = choices;
    const next = { ...choices, ...Object.fromEntries(picks.map((p) => [p.gameId, p.choice])) };
    setChoices(next);
    setSave({ kind: "saving" });
    startTransition(async () => {
      try {
        const result = await quickPickBulk({ leagueId, slateId, picks });
        if (result.ok) afterSave(before, next);
        else flash({ kind: "error", message: result.error }, before);
      } catch {
        flash({ kind: "error", message: "Couldn't save — try again." }, before);
      }
    });
  }

  const remainingCount = games.filter((g) => !g.locked && !choices[g.id]).length;
  const hasSpreads = games.some((g) => !g.locked && g.spread != null);

  return (
    <div className="flex flex-col gap-4">
      <SaveChip state={save} />
      {!isSurvivor && remainingCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Quick-fill your remaining {remainingCount}:</span>
          <button type="button" onClick={() => quickFill("home")} className="btn-ghost !px-3 !py-1.5 !text-xs">
            🏠 All home teams
          </button>
          {hasSpreads && (
            <button type="button" onClick={() => quickFill("favorites")} className="btn-ghost !px-3 !py-1.5 !text-xs">
              ⭐ All favorites
            </button>
          )}
          <button type="button" onClick={() => quickFill("coin")} className="btn-ghost !px-3 !py-1.5 !text-xs">
            🎲 Coin flip
          </button>
        </div>
      )}
      {games.map((game) => {
        const myChoice = choices[game.id] ?? null;
        return (
          <div key={game.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{game.startTimeLabel}</p>
              <StatusChip game={game} isSpread={isSpread} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["AWAY", "HOME"] as const).map((side) => {
                const team = side === "HOME" ? game.homeTeam : game.awayTeam;
                const burned = isSurvivor && (side === "HOME" ? game.burnedHome : game.burnedAway);
                const chosen = myChoice === side;
                const won = game.winner === side;
                const disabled = game.locked || burned;
                return (
                  <button
                    key={side}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(game, side)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-all duration-150 ${
                      chosen
                        ? "border-indigo-500 bg-indigo-950/50 text-white"
                        : "border-slate-700 text-slate-300 hover:border-slate-500"
                    } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-[0.97]"} ${
                      won ? "ring-1 ring-emerald-500" : ""
                    }`}
                  >
                    <span>
                      {side === "AWAY" && !game.isFantasy ? "@ " : ""}
                      {team}
                      {isSpread && <span className="text-slate-400">{spreadText(side, game.spread)}</span>}
                      {burned && " 💀"}
                      {won && " ✅"}
                    </span>
                    <span
                      className={`ml-2 inline-block h-4 w-4 shrink-0 rounded-full border transition-all ${
                        chosen ? "border-indigo-400 bg-indigo-500" : "border-slate-600"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <OthersLine game={game} showConfidence={false} />
          </div>
        );
      })}
    </div>
  );
}
