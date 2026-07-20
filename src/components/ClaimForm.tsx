"use client";

import { useActionState } from "react";
import { claimAccount, type GuestFormState } from "@/actions/guest";

export default function ClaimForm() {
  const [state, action, pending] = useActionState<GuestFormState, FormData>(
    claimAccount,
    undefined
  );

  return (
    <form action={action} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state?.error && (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state?.info && (
        <p className="rounded-lg border border-indigo-900 bg-indigo-950/50 px-3 py-2 text-sm text-indigo-300">
          {state.info}
        </p>
      )}
      <button className="btn" disabled={pending}>
        {pending ? "Claiming…" : "Claim my account"}
      </button>
    </form>
  );
}
