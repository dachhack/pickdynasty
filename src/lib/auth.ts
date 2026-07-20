import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { db } from "./db";
import { supabaseEnabled, supabaseServer } from "./supabase";

// Auth has two drivers:
//  - Supabase Auth (production): shared accounts with Drip League FF — the
//    User row mirrors auth.users, keyed by the same UUID.
//  - Local JWT (dev/CI fallback): email+password against User.passwordHash,
//    session in a signed cookie. Active when Supabase env vars are absent.
// Event-night GUESTS always ride the JWT cookie, even with Supabase on —
// so the cookie is checked as a fallback whenever Supabase has no session.

const SESSION_COOKIE = "ep_session";
const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret");

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Absorbs guest accounts that claimed this email: memberships (with all
 * their picks) move to the real account, then the guest row is deleted.
 * Runs when a Supabase user's mirror row is first created — i.e. the first
 * sign-in after a guest claim creates the account.
 */
export async function adoptGuestAccounts(user: { id: string; email: string }) {
  const guests = await db.user.findMany({
    where: { claimEmail: user.email, isGuest: true, NOT: { id: user.id } },
  });
  for (const guest of guests) {
    const mine = new Set(
      (await db.membership.findMany({ where: { userId: user.id } })).map((m) => m.leagueId)
    );
    for (const m of await db.membership.findMany({ where: { userId: guest.id } })) {
      if (mine.has(m.leagueId)) {
        await db.membership.delete({ where: { id: m.id } }); // already in that league
      } else {
        await db.membership.update({ where: { id: m.id }, data: { userId: user.id } });
      }
    }
    await db.league.updateMany({
      where: { createdById: guest.id },
      data: { createdById: user.id },
    });
    await db.user.delete({ where: { id: guest.id } });
  }
}

/** Finds or creates the local mirror row for a Supabase Auth user. */
async function mirrorSupabaseUser(id: string, email: string, name: string) {
  const existing = await db.user.findUnique({ where: { id } });
  if (existing) return existing;
  const created = await db.user.upsert({
    where: { email },
    update: {}, // same email, different id would be a conflict — keep existing
    create: { id, email, name },
  });
  await adoptGuestAccounts(created);
  return created;
}

async function jwtCookieUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return await db.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async () => {
  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      const name =
        (user.user_metadata?.name as string | undefined) ?? user.email.split("@")[0];
      return mirrorSupabaseUser(user.id, user.email, name);
    }
    // No Supabase session — fall through to the guest/dev JWT cookie.
  }
  return jwtCookieUser();
});
