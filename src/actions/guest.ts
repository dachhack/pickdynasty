"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, getCurrentUser } from "@/lib/auth";
import { venueCheckError } from "@/lib/geo";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";

export type GuestFormState = { error?: string; info?: string } | undefined;

function formCoord(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bar-night quick join: display name only, no account. Creates a guest User
 * (synthetic email, no password, emailOptOut) and signs it in via the JWT
 * cookie — that works under both auth drivers.
 */
export async function guestJoin(
  _prev: GuestFormState,
  formData: FormData
): Promise<GuestFormState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);

  const league = await db.league.findUnique({ where: { inviteCode: code } });
  if (!league || !league.allowGuests) {
    return { error: "Guest entry isn't open for this league." };
  }
  if (!name) return { error: "Pick a display name first." };

  const locError = venueCheckError(league, formCoord(formData, "lat"), formCoord(formData, "lng"));
  if (locError) return { error: locError };

  // Already signed in (guest re-scanning the QR, or a real account) — just join.
  const existing = await getCurrentUser();
  if (existing) {
    await db.membership.upsert({
      where: { userId_leagueId: { userId: existing.id, leagueId: league.id } },
      update: {},
      create: { userId: existing.id, leagueId: league.id, teamName: name },
    });
    redirect(`/leagues/${league.id}`);
  }

  const user = await db.user.create({
    data: {
      email: `guest-${randomUUID()}@guest.epicpickem.com`,
      name,
      isGuest: true,
      emailOptOut: true, // synthetic address — never email it
    },
  });
  await createSession(user.id);
  await db.membership.create({
    data: { userId: user.id, leagueId: league.id, teamName: name },
  });
  redirect(`/leagues/${league.id}`);
}

/**
 * Turns a guest into a real account so picks and memberships survive the
 * night. Local driver: sets email+password on the same row. Supabase driver:
 * creates the Supabase account and records claimEmail — memberships transfer
 * when that account first signs in (see adoptGuestAccounts).
 */
export async function claimAccount(
  _prev: GuestFormState,
  formData: FormData
): Promise<GuestFormState> {
  const me = await getCurrentUser();
  if (!me?.isGuest) redirect("/dashboard");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password needs at least 8 characters." };

  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: me.name } },
    });
    if (error) return { error: error.message };
    await db.user.update({ where: { id: me.id }, data: { claimEmail: email } });
    if (!data.session) {
      return {
        info: "Check your email for a confirmation link — your picks transfer the first time you log in.",
      };
    }
    redirect("/dashboard?claimed=1");
  }

  const taken = await db.user.findUnique({ where: { email } });
  if (taken) {
    return { error: "That email already has an account. Log in to it instead — or use another email." };
  }
  await db.user.update({
    where: { id: me.id },
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      isGuest: false,
      emailOptOut: false,
      claimEmail: null,
    },
  });
  redirect("/dashboard?claimed=1");
}
