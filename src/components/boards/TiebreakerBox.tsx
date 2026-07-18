"use client";

import { useRef, useState, useTransition } from "react";
import { quickTiebreaker } from "@/actions/quickpicks";
import type { SaveState } from "./types";

/** Auto-saving tiebreaker guess (saves on blur / Enter). */
export default function TiebreakerBox({
  leagueId,
  slateId,
  matchupLabel,
  initialValue,
}: {
  leagueId: string;
  slateId: string;
  matchupLabel: string;
  initialValue: number | null;
}) {
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const lastSaved = useRef<number | null>(initialValue);

  function submit(raw: string) {
    const value = Math.round(Number(raw));
    if (raw === "" || !isFinite(value) || value < 0 || value === lastSaved.current) return;
    setSave({ kind: "saving" });
    startTransition(async () => {
      try {
        const result = await quickTiebreaker({ leagueId, slateId, value });
        if (result.ok) {
          lastSaved.current = value;
          setSave({ kind: "saved" });
        } else {
          setSave({ kind: "error", message: result.error });
        }
      } catch {
        setSave({ kind: "error", message: "Couldn't save — try again." });
      }
      setTimeout(() => setSave({ kind: "idle" }), 2000);
    });
  }

  return (
    <div className="card">
      <h3 className="text-sm font-bold">🎯 Tiebreaker</h3>
      <p className="mt-1 text-xs text-slate-500">
        Predict the total combined score of {matchupLabel} — closest guess wins ties on this slate.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <input
          className="input max-w-[10rem]"
          type="number"
          min="0"
          placeholder="e.g. 47"
          defaultValue={initialValue ?? ""}
          onBlur={(e) => submit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {save.kind === "saving" && <span className="text-xs text-slate-400">Saving…</span>}
        {save.kind === "saved" && <span className="text-xs text-emerald-400">Saved ✓</span>}
        {save.kind === "error" && <span className="text-xs text-red-400">{save.message}</span>}
      </div>
    </div>
  );
}
