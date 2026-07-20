"use client";

import { useActionState } from "react";
import { guestJoin, type GuestFormState } from "@/actions/guest";
import LocationField from "@/components/LocationField";

/** Bar-night quick join: display name (+ location when the league asks). */
export default function GuestJoinForm({
  code,
  requireLocation,
}: {
  code: string;
  requireLocation: boolean;
}) {
  const [state, action, pending] = useActionState<GuestFormState, FormData>(
    guestJoin,
    undefined
  );

  return (
    <form action={action} className="card flex flex-col gap-4 text-left">
      <input type="hidden" name="code" value={code} />
      <div>
        <label className="label" htmlFor="guestName">Your name on the board</label>
        <input
          className="input"
          id="guestName"
          name="name"
          required
          maxLength={30}
          placeholder="Table 7 Tony"
          autoComplete="off"
        />
      </div>
      {requireLocation && (
        <LocationField hint="This league checks that you're at the venue." />
      )}
      {state?.error && (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <button className="btn" disabled={pending}>
        {pending ? "Joining…" : "🎟️ Jump in — no account needed"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Guest play lives on this device. You can claim a free account later to keep
        your picks.
      </p>
    </form>
  );
}
