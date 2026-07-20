"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { adoptGuestAccounts, createSession, destroySession } from "@/lib/auth";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";

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
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
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

export async function logout() {
  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } else {
    await destroySession();
  }
  redirect("/");
}
