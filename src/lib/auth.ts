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

/** Finds or creates the local mirror row for a Supabase Auth user. */
async function mirrorSupabaseUser(id: string, email: string, name: string) {
  const existing = await db.user.findUnique({ where: { id } });
  if (existing) return existing;
  return db.user.upsert({
    where: { email },
    update: {}, // same email, different id would be a conflict — keep existing
    create: { id, email, name },
  });
}

export const getCurrentUser = cache(async () => {
  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const name =
      (user.user_metadata?.name as string | undefined) ?? user.email.split("@")[0];
    return mirrorSupabaseUser(user.id, user.email, name);
  }

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
});
