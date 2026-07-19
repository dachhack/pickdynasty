"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isEnvSuperAdmin, requireSuperAdmin } from "@/lib/superadmin";
import { syncLeagueResults } from "@/lib/sync";

export async function toggleSuperAdmin(formData: FormData) {
  const me = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === me.id) return; // can't demote yourself
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || isEnvSuperAdmin(target.email)) return; // env admins are fixed
  await db.user.update({
    where: { id: target.id },
    data: { isSuperAdmin: !target.isSuperAdmin },
  });
  revalidatePath("/admin");
}

export async function adminDeleteUser(formData: FormData) {
  const me = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === me.id) return;
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || isEnvSuperAdmin(target.email)) return;
  // Memberships/picks cascade; leagues they created survive (relation is
  // restrictive), so orphan-league cleanup is a separate delete.
  const createdLeagues = await db.league.count({ where: { createdById: target.id } });
  if (createdLeagues > 0) {
    redirect(`/admin?error=${encodeURIComponent("User created leagues — delete or reassign those leagues first.")}`);
  }
  await db.user.delete({ where: { id: target.id } });
  revalidatePath("/admin");
}

export async function adminDeleteLeague(formData: FormData) {
  await requireSuperAdmin();
  const leagueId = String(formData.get("leagueId") ?? "");
  await db.league.deleteMany({ where: { id: leagueId } });
  revalidatePath("/admin");
}

/** Run result sync for every league with pending imported games. */
export async function adminGlobalSync() {
  await requireSuperAdmin();
  const leagues = await db.league.findMany({
    where: {
      slates: {
        some: {
          games: { some: { externalId: { not: null }, winner: null, startTime: { lt: new Date() } } },
        },
      },
    },
    select: { id: true, sport: true },
  });
  let updated = 0;
  for (const league of leagues) {
    try {
      updated += await syncLeagueResults(league.id, league.sport);
    } catch {
      // Keep going — one league's API hiccup shouldn't block the rest.
    }
  }
  redirect(`/admin?synced=${updated}&checked=${leagues.length}`);
}
