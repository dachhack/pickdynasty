"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, resetPassword, type FormState } from "@/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestPasswordReset,
    undefined
  );

  return (
    <div className="mx-auto mt-8 w-full max-w-sm">
      <div className="card">
        <h1 className="text-xl font-bold">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter your account email and we&rsquo;ll send a link to choose a new one.
        </p>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
          {state?.info && <p className="text-sm text-emerald-400">{state.info}</p>}
          <button className="btn" disabled={pending}>
            {pending ? "One sec…" : "Email me a reset link"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-slate-400">
        Remembered it? <Link className="text-indigo-400 hover:underline" href="/login">Log in</Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    resetPassword,
    undefined
  );

  return (
    <div className="mx-auto mt-8 w-full max-w-sm">
      <div className="card">
        <h1 className="text-xl font-bold">Choose a new password</h1>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          {token ? <input type="hidden" name="token" value={token} /> : null}
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-400">
              {state.error}{" "}
              <Link className="text-indigo-400 hover:underline" href="/forgot-password">
                Request a new link
              </Link>
            </p>
          )}
          <button className="btn" disabled={pending}>
            {pending ? "One sec…" : "Set password & log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
