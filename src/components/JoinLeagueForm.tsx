"use client";

import { useFormState, useFormStatus } from "react-dom";
import { joinLeagueAction } from "@/app/actions/league";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Joining…" : "Join"}
    </button>
  );
}

export function JoinLeagueForm() {
  const [state, formAction] = useFormState(joinLeagueAction, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input uppercase tracking-widest"
          name="code"
          placeholder="INVITE CODE"
          maxLength={8}
          required
        />
        <SubmitButton />
      </div>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}
