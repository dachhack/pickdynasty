"use client";

import type { SaveState } from "./types";

export default function SaveChip({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  return (
    <div className="pointer-events-none sticky top-16 z-20 flex justify-end">
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold shadow-lg transition-opacity ${
          state.kind === "error"
            ? "bg-red-950 text-red-300 ring-1 ring-red-800"
            : "bg-slate-900 text-slate-200 ring-1 ring-slate-700"
        }`}
      >
        {state.kind === "saving" && "Saving…"}
        {state.kind === "saved" && "Saved ✓"}
        {state.kind === "error" && state.message}
      </span>
    </div>
  );
}
