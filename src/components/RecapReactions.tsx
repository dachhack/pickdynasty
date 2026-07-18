"use client";

import { useState, useTransition } from "react";
import { toggleReaction } from "@/actions/reactions";
import { tapHaptic } from "./boards/celebrate";

export type ReactionView = {
  emoji: string;
  count: number;
  mine: boolean;
  who: string; // tooltip: who reacted
};

export default function RecapReactions({
  leagueId,
  slateId,
  initial,
}: {
  leagueId: string;
  slateId: string;
  initial: ReactionView[];
}) {
  const [reactions, setReactions] = useState(initial);
  const [, startTransition] = useTransition();

  function onToggle(emoji: string) {
    tapHaptic();
    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r
      )
    );
    startTransition(async () => {
      const result = await toggleReaction({ leagueId, slateId, emoji });
      if (!result.ok) {
        // Revert on failure.
        setReactions((prev) =>
          prev.map((r) =>
            r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r
          )
        );
      }
    });
  }

  return (
    <div className="mt-3 flex gap-2">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          title={r.who}
          onClick={() => onToggle(r.emoji)}
          className={`rounded-full border px-2.5 py-1 text-sm transition-all active:scale-90 ${
            r.mine
              ? "border-indigo-500 bg-indigo-950/60"
              : "border-slate-700 hover:border-slate-500"
          }`}
        >
          {r.emoji}
          {r.count > 0 && <span className="ml-1 text-xs text-slate-400">{r.count}</span>}
        </button>
      ))}
    </div>
  );
}
