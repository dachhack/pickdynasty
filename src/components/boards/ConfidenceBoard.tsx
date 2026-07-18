"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveConfidenceBoard } from "@/actions/quickpicks";
import type { GameView, SaveState } from "./types";
import SaveChip from "./SaveChip";
import { OthersLine, StatusChip } from "./GameMeta";
import { celebrate, tapHaptic } from "./celebrate";

/**
 * Drag-to-rank confidence board: order your games from surest (top, worth
 * the most points) to shakiest (bottom). Picks and order auto-save.
 */
export default function ConfidenceBoard({
  leagueId,
  slateId,
  games,
}: {
  leagueId: string;
  slateId: string;
  games: GameView[];
}) {
  const locked = useMemo(() => games.filter((g) => g.locked), [games]);
  const unlockedInitial = useMemo(() => {
    const open = games.filter((g) => !g.locked);
    // Start ordered by stored confidence (high first), unranked at the bottom.
    return [...open].sort((a, b) => (b.myConfidence ?? -1) - (a.myConfidence ?? -1));
  }, [games]);

  const [order, setOrder] = useState<string[]>(unlockedInitial.map((g) => g.id));
  const [choices, setChoices] = useState<Record<string, "HOME" | "AWAY">>(() =>
    Object.fromEntries(games.filter((g) => g.myChoice).map((g) => [g.id, g.myChoice!]))
  );
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  // Ranks not consumed by locked picks, biggest first — assigned top-to-bottom.
  const availableRanks = useMemo(() => {
    const used = new Set(locked.map((g) => g.myConfidence).filter((c): c is number => c != null));
    const all = Array.from({ length: games.length }, (_, i) => games.length - i);
    return all.filter((r) => !used.has(r));
  }, [games.length, locked]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function flash(state: SaveState) {
    setSave(state);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    if (state.kind !== "saving") {
      clearTimer.current = setTimeout(
        () => setSave({ kind: "idle" }),
        state.kind === "error" ? 4000 : 1500
      );
    }
  }

  const wasComplete = useRef(
    unlockedInitial.length > 0 && unlockedInitial.every((g) => g.myChoice)
  );

  function persist(nextOrder: string[], nextChoices: Record<string, "HOME" | "AWAY">) {
    const picks = nextOrder
      .map((id, i) => ({ gameId: id, choice: nextChoices[id], confidence: availableRanks[i] }))
      .filter((p): p is { gameId: string; choice: "HOME" | "AWAY"; confidence: number } =>
        Boolean(p.choice && p.confidence)
      );
    if (picks.length === 0) return;
    const complete = nextOrder.length > 0 && nextOrder.every((id) => nextChoices[id]);
    setSave({ kind: "saving" });
    startTransition(async () => {
      try {
        const result = await saveConfidenceBoard({ leagueId, slateId, picks });
        if (result.ok && complete && !wasComplete.current) {
          wasComplete.current = true;
          celebrate();
          flash({ kind: "saved", message: "Board complete — locked and loaded 🎉" });
        } else {
          flash(result.ok ? { kind: "saved" } : { kind: "error", message: result.error });
        }
      } catch {
        flash({ kind: "error", message: "Couldn't save — try again." });
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    tapHaptic();
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    persist(next, choices);
  }

  function onPick(gameId: string, side: "HOME" | "AWAY") {
    tapHaptic();
    const next = { ...choices, [gameId]: side };
    setChoices(next);
    persist(order, next);
  }

  return (
    <div className="flex flex-col gap-4">
      <SaveChip state={save} />
      <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-400">
        🎯 Pick a winner in each game, then <span className="font-semibold text-slate-200">drag rows to rank your confidence</span> —
        top row is worth the most points.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {order.map((id, i) => (
              <SortableGameRow
                key={id}
                game={byId.get(id)!}
                rank={availableRanks[i]}
                choice={choices[id] ?? null}
                onPick={onPick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {locked.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locked</h3>
          {locked.map((game) => (
            <div key={game.id} className="card !py-3 opacity-70">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">
                  {game.awayTeam} @ {game.homeTeam}
                  {choices[game.id] && (
                    <span className="ml-2 text-slate-400">
                      → {choices[game.id] === "HOME" ? game.homeTeam : game.awayTeam}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {game.myConfidence != null && <RankBadge rank={game.myConfidence} />}
                  <StatusChip game={game} isSpread={false} />
                </span>
              </div>
              <OthersLine game={game} showConfidence />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number | undefined }) {
  return (
    <span
      data-testid="rank-badge"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-950 text-sm font-black text-indigo-300 ring-1 ring-indigo-800"
    >
      {rank ?? "—"}
    </span>
  );
}

function SortableGameRow({
  game,
  rank,
  choice,
  onPick,
}: {
  game: GameView;
  rank: number | undefined;
  choice: "HOME" | "AWAY" | null;
  onPick: (gameId: string, side: "HOME" | "AWAY") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: game.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex items-center gap-3 !py-3 ${isDragging ? "z-10 border-indigo-500 shadow-xl" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${game.awayTeam} at ${game.homeTeam}`}
        className="cursor-grab touch-none rounded p-1 text-lg text-slate-500 hover:text-slate-200 active:cursor-grabbing"
      >
        ⠿
      </button>
      <RankBadge rank={rank} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{game.startTimeLabel}</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["AWAY", "HOME"] as const).map((side) => {
            const team = side === "HOME" ? game.homeTeam : game.awayTeam;
            const chosen = choice === side;
            return (
              <button
                key={side}
                type="button"
                onClick={() => onPick(game.id, side)}
                className={`truncate rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                  chosen
                    ? "border-indigo-500 bg-indigo-950/50 text-white"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {side === "AWAY" && !game.isFantasy ? "@ " : ""}
                {team}
              </button>
            );
          })}
        </div>
        <OthersLine game={game} showConfidence />
      </div>
    </div>
  );
}
