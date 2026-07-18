"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type FormState } from "@/actions/auth";

export default function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "signup";
  next?: string;
}) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined
  );

  return (
    <div className="mx-auto mt-8 w-full max-w-sm">
      <div className="card">
        <h1 className="text-xl font-bold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {mode === "signup" && (
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input className="input" id="name" name="name" required placeholder="Alex Smith" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            />
          </div>
          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
          <button className="btn" disabled={pending}>
            {pending ? "One sec…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-slate-400">
        {mode === "login" ? (
          <>No account? <Link className="text-indigo-400 hover:underline" href="/signup">Sign up</Link></>
        ) : (
          <>Already have an account? <Link className="text-indigo-400 hover:underline" href="/login">Log in</Link></>
        )}
      </p>
    </div>
  );
}
