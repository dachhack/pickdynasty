import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adoptGuestAccounts, destroySession, jwtCookieUser } from "@/lib/auth";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * OAuth landing (Supabase PKCE): exchanges the provider code for a session.
 * If this device was mid-guest-session (bar night), the guest account is
 * claimed into the OAuth identity — memberships and picks come along.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const h = request.headers;
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? url.host}`;
  const nextRaw = url.searchParams.get("next") ?? "";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";
  const code = url.searchParams.get("code");

  if (!code || !supabaseEnabled()) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // Guest claim via OAuth: absorb this device's guest account.
  const guest = await jwtCookieUser();
  if (guest?.isGuest) {
    await db.user.update({
      where: { id: guest.id },
      data: { claimEmail: data.user.email },
    });
    const mirror = await db.user.findUnique({ where: { id: data.user.id } });
    // Existing account: adopt now. First-time sign-in: the mirror row is
    // created on the next request and adoption runs there (lib/auth.ts).
    if (mirror) await adoptGuestAccounts(mirror);
    await destroySession();
  }

  return NextResponse.redirect(`${origin}${next}`);
}
