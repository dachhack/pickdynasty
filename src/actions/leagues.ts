"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeInviteCode, requireMembership } from "@/lib/league";
import { SPORTS } from "@/lib/sports";
import { FORMATS } from "@/lib/formats";

export async function createLeague(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const sport = String(formData.get("sport") ?? "other");
  const season = String(formData.get("season") ?? "").trim() || String(new Date().getFullYear());
  const format = String(formData.get("format") ?? "classic");
  const buyIn = Number(formData.get("buyIn") ?? 0) || 0;
  const blindPicks = formData.get("blindPicks") === "on";
  const teamName = String(formData.get("teamName") ?? "").trim() || `${user.name}'s Team`;

  if (!name) redirect("/leagues/new");
  if (!SPORTS.some((s) => s.id === sport)) redirect("/leagues/new");
  if (!FORMATS.some((f) => f.id === format)) redirect("/leagues/new");

  const league = await db.league.create({
    data: {
      name,
      sport,
      season,
      format,
      buyIn,
      blindPicks,
      inviteCode: makeInviteCode(),
      createdById: user.id,
      memberships: {
        create: { userId: user.id, role: "COMMISSIONER", teamName },
      },
    },
  });
  redirect(`/leagues/${league.id}`);
}

export async function joinLeague(formData: FormData) {
  const user = await getCurrentUser();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!user) redirect(`/login?next=/join/${code}`);

  const league = await db.league.findUnique({ where: { inviteCode: code } });
  if (!league) redirect("/dashboard?error=bad-code");

  const teamName = String(formData.get("teamName") ?? "").trim() || `${user.name}'s Team`;
  await db.membership.upsert({
    where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
    update: {},
    create: { userId: user.id, leagueId: league.id, teamName },
  });
  redirect(`/leagues/${league.id}`);
}

export async function updateTeam(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const membership = await requireMembership(leagueId);

  const teamName = String(formData.get("teamName") ?? "").trim();
  const teamColor = String(formData.get("teamColor") ?? "#4f46e5");
  const teamEmoji = String(formData.get("teamEmoji") ?? "🏆").trim() || "🏆";

  if (teamName) {
    await db.membership.update({
      where: { id: membership.id },
      data: { teamName, teamColor, teamEmoji: [...teamEmoji].slice(0, 2).join("") },
    });
  }
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/team?saved=1`);
}
