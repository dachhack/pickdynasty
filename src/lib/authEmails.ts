// Epic-branded auth emails for the SUPABASE driver. The Supabase project is
// shared with Drip League FF, so its project-level templates carry Drip's
// branding. When the service-role key + our SMTP are configured we mint the
// auth links ourselves (auth.admin.generateLink sends nothing) and email
// them through Epic's own sender; the /auth/confirm route verifies the
// token_hash and signs the user in. Callers fall back to Supabase-sent
// emails whenever this is unavailable.

import {
  confirmSignupEmail,
  emailEnabled,
  passwordResetEmail,
  sendEmail,
} from "./email";
import { supabaseAdmin, supabaseAdminEnabled } from "./supabase";

/** True when Epic can send its own branded Supabase auth emails. */
export function brandedAuthEmails(): boolean {
  return supabaseAdminEnabled() && emailEnabled();
}

function confirmUrl(
  origin: string,
  props: { hashed_token: string; verification_type: string },
  next: string
): string {
  return (
    `${origin}/auth/confirm?token_hash=${encodeURIComponent(props.hashed_token)}` +
    `&type=${encodeURIComponent(props.verification_type)}&next=${encodeURIComponent(next)}`
  );
}

/**
 * Creates the (unconfirmed) Supabase account and emails our branded
 * confirmation link. Returns a player-facing error, or null on success.
 */
export async function sendBrandedSignupEmail(input: {
  email: string;
  password: string;
  name: string;
  origin: string;
  next: string; // where /auth/confirm lands after verifying (user is signed in)
}): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: { data: { name: input.name } },
  });
  if (error) {
    return /already|registered|exists/i.test(error.message)
      ? "An account with that email already exists. Log in to it instead."
      : error.message;
  }
  const sent = await sendEmail({
    to: input.email,
    ...confirmSignupEmail({
      name: input.name,
      confirmUrl: confirmUrl(input.origin, data.properties, input.next),
    }),
  });
  if (!sent.ok) {
    // Roll back the just-created unconfirmed account so a retry doesn't
    // bounce off "already exists" with no confirmation email in hand.
    if (data.user) await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    return "Couldn't send the confirmation email — try again in a minute.";
  }
  return null;
}

/**
 * Emails our branded password-recovery link. Silent about outcomes by
 * design — the caller shows the same reply whether or not the account
 * exists or the send succeeded, so nothing leaks.
 */
export async function sendBrandedRecoveryEmail(input: {
  email: string;
  origin: string;
}): Promise<void> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
  });
  if (error) return; // most likely: no such user
  const name =
    (data.user?.user_metadata?.name as string | undefined) ?? input.email.split("@")[0];
  await sendEmail({
    to: input.email,
    ...passwordResetEmail({
      name,
      resetUrl: confirmUrl(input.origin, data.properties, "/reset-password"),
    }),
  });
}
