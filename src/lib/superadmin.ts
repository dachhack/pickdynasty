import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

// Site operators. The env list is always super admin regardless of the DB
// flag (and can't be revoked from the UI) — it's the bootstrap and the
// recovery hatch. Defaults to the founder's account; override with a
// comma-separated SUPER_ADMIN_EMAILS env var.
const ENV_ADMINS = (process.env.SUPER_ADMIN_EMAILS ?? "mlporritt@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isEnvSuperAdmin(email: string): boolean {
  return ENV_ADMINS.includes(email.toLowerCase());
}

export function userIsSuperAdmin(user: { email: string; isSuperAdmin: boolean }): boolean {
  return user.isSuperAdmin || isEnvSuperAdmin(user.email);
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || !userIsSuperAdmin(user)) redirect("/dashboard");
  return user;
}
