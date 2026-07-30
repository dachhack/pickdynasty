import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Landing for Epic's OWN auth emails (see lib/authEmails.ts): verifies the
 * token_hash minted by auth.admin.generateLink, which establishes a session,
 * then forwards to `next`. Recovery links land on /reset-password (which
 * needs that session); signup confirmations land signed-in on the dashboard.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const h = request.headers;
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? url.host}`;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextRaw = url.searchParams.get("next") ?? "";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  if (!supabaseEnabled() || !tokenHash || !type || !OTP_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/login?error=confirm`);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    // Dead recovery links get the reset page's friendly explainer.
    return NextResponse.redirect(
      type === "recovery" ? `${origin}/reset-password` : `${origin}/login?error=confirm`
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
