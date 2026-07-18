"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clearSessionCookie, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function registerAction(_prev: { error?: string } | undefined, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists. Try signing in." };

  const user = await db.user.create({
    data: { name, email, passwordHash: hashPassword(password) },
  });
  setSessionCookie(user.id);
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }
  setSessionCookie(user.id);
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function logoutAction() {
  clearSessionCookie();
  redirect("/");
}
