"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction, registerAction } from "@/app/actions/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "One sec…" : label}
    </button>
  );
}

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(loginAction, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <ErrorNote error={state?.error} />
      <input type="hidden" name="next" value={next || "/dashboard"} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton label="Sign in" />
      <p className="text-center text-sm text-slate-600">
        New here? <Link className="font-semibold text-brand-600" href="/register">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(registerAction, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <ErrorNote error={state?.error} />
      <input type="hidden" name="next" value={next || "/dashboard"} />
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password (8+ characters)</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <SubmitButton label="Create account" />
      <p className="text-center text-sm text-slate-600">
        Already playing? <Link className="font-semibold text-brand-600" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
