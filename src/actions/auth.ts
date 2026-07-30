"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  adoptGuestAccounts,
  createSession,
  destroySession,
  makePasswordResetToken,
  verifyPasswordResetToken,
} from "@/lib/auth";
import { appUrl, emailEnabled, passwordResetEmail, sendEmail } from "@/lib/email";
import {
  brandedAuthEmails,
  sendBrandedRecoveryEmail,
  sendBrandedSignupEmail,
} from "@/lib/authEmails";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

export type FormState = { error?: string; info?: string } | undefined;

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/dashboard";

  if (!name || !email || password.length < 8) {
    return { error: "Name, email, and a password of at least 8 characters are required." };
  }

  if (supabaseEnabled()) {
    // Epic-branded confirmation via our own SMTP when configured — the
    // shared Supabase project's stock templates carry Drip's branding.
    if (brandedAuthEmails()) {
      const sendError = await sendBrandedSignupEmail({
        email,
        password,
        name,
        origin: await requestOrigin(),
        next,
      });
      if (sendError) return { error: sendError };
      return { info: "Check your email — the confirmation link signs you straight in." };
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        // Shared Supabase project with Drip: without this, confirmation
        // links bounce to the project-level Site URL (Drip's domain).
        emailRedirectTo: `${process.env.APP_URL ?? "https://epicpickem.com"}/login`,
      },
    });
    if (error) return { error: error.message };
    if (!data.session) {
      // Project requires email confirmation before the first sign-in.
      return { info: "Check your email for a confirmation link, then log in." };
    }
    redirect(next);
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };
  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
  });
  await createSession(user.id);
  redirect(next);
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/dashboard";

  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Invalid email or password." };
    // Pre-existing account claimed by a guest: absorb it now. (New accounts
    // are absorbed when their mirror row is first created.)
    const mirror = data.user ? await db.user.findUnique({ where: { id: data.user.id } }) : null;
    if (mirror) await adoptGuestAccounts(mirror);
    redirect(next);
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  redirect(next);
}

/**
 * Third-party sign-in via Supabase Auth (PKCE): redirects to the provider,
 * which lands back on /auth/callback. Only offered when Supabase is the
 * active auth driver.
 */
export async function signInWithGoogle(formData: FormData) {
  if (!supabaseEnabled()) redirect("/login");
  const nextRaw = String(formData.get("next") ?? "");
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${proto}://${host}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

/**
 * Forgot password, step 1: send a reset link. Supabase driver sends its own
 * recovery email (which lands on /auth/callback → /reset-password with a
 * session); the local driver emails a single-use 30-minute signed token.
 * The response never reveals whether the email has an account.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };

  const sent = {
    info: "If that email has an account, a reset link is on its way. It works once and expires in 30 minutes.",
  };

  if (supabaseEnabled()) {
    const origin = await requestOrigin();
    // Epic-branded recovery email via our own SMTP when configured;
    // otherwise Supabase sends its (Drip-branded) stock recovery email.
    if (brandedAuthEmails()) {
      await sendBrandedRecoveryEmail({ email, origin });
      return sent;
    }
    const supabase = await supabaseServer();
    // Outcome deliberately ignored — same reply either way, no account leak.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    return sent;
  }

  if (!emailEnabled()) {
    return {
      error:
        "Email sending isn't configured on this server — ask whoever runs it to reset your password.",
    };
  }
  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.isGuest) {
    const token = await makePasswordResetToken(user);
    const msg = passwordResetEmail({
      name: user.name,
      resetUrl: `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`,
    });
    await sendEmail({ to: email, ...msg });
  }
  return sent;
}

/**
 * Forgot password, step 2: set the new password. Supabase driver relies on
 * the recovery session established by /auth/callback; the local driver
 * verifies the emailed token and signs the user in on success.
 */
export async function resetPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password needs at least 8 characters." };

  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "This reset link expired or was already used — request a new one." };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    redirect("/dashboard?pwreset=1");
  }

  const token = String(formData.get("token") ?? "");
  const user = await verifyPasswordResetToken(token);
  if (!user) {
    return { error: "This reset link expired or was already used — request a new one." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  await createSession(user.id);
  redirect("/dashboard?pwreset=1");
}

export async function logout() {
  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } else {
    await destroySession();
  }
  redirect("/");
}
