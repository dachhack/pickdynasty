"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createLeagueAction } from "@/app/actions/league";
import { SPORTS } from "@/lib/sports";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Creating…" : "Create league"}
    </button>
  );
}

export function CreateLeagueForm() {
  const [state, formAction] = useFormState(createLeagueAction, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <div>
        <label className="label" htmlFor="name">League name</label>
        <input className="input" id="name" name="name" placeholder="Saturday Degenerates" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="sport">Sport</label>
          <select className="input" id="sport" name="sport" defaultValue="NFL" required>
            {SPORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.emoji} {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="season">Season</label>
          <input className="input" id="season" name="season" placeholder="2026" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">Description (optional)</label>
        <textarea className="input" id="description" name="description" rows={2} placeholder="Winner takes the pot. Loser buys wings." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="pickType">Pick style</label>
          <select className="input" id="pickType" name="pickType" defaultValue="STRAIGHT_UP">
            <option value="STRAIGHT_UP">Straight up (pick the winner)</option>
            <option value="AGAINST_SPREAD">Against the spread</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="buyIn">Buy-in ($, tracked only)</label>
          <input className="input" id="buyIn" name="buyIn" inputMode="decimal" placeholder="0" defaultValue="0" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="blindPicks" defaultChecked className="h-4 w-4 rounded border-slate-300" />
        Blind picks — hide everyone&rsquo;s picks until each game locks
      </label>
      <SubmitButton />
    </form>
  );
}
