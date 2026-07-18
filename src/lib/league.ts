import { randomBytes } from "crypto";
import { db } from "./db";
import { getSessionUser } from "./auth";

export function newInviteCode(): string {
  // 8-char, unambiguous, uppercase
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

export async function requireMembership(leagueId: string) {
  const user = await requireUser();
  const membership = await db.membership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId } },
    include: { league: true },
  });
  if (!membership || membership.status !== "ACTIVE") throw new Error("Not a member of this league");
  return { user, membership, league: membership.league };
}

export async function requireAdmin(leagueId: string) {
  const ctx = await requireMembership(leagueId);
  if (ctx.membership.role !== "COMMISSIONER" && ctx.membership.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return ctx;
}

export function isAdminRole(role: string): boolean {
  return role === "COMMISSIONER" || role === "ADMIN";
}
