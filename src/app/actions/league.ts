"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { newInviteCode, requireAdmin, requireMembership, requireUser } from "@/lib/league";
import { parseDollarsToCents } from "@/lib/money";
import { SPORTS } from "@/lib/sports";

export async function createLeagueAction(_prev: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const sport = String(formData.get("sport") || "");
  const season = String(formData.get("season") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const pickType = String(formData.get("pickType") || "STRAIGHT_UP");
  const blindPicks = formData.get("blindPicks") === "on";
  const buyIn = parseDollarsToCents(String(formData.get("buyIn") || "0")) ?? 0;

  if (!name) return { error: "League name is required." };
  if (!SPORTS.some((s) => s.key === sport)) return { error: "Pick a sport." };
  if (!season) return { error: "Season is required (e.g. 2026)." };
  if (buyIn < 0) return { error: "Buy-in can't be negative." };

  const league = await db.league.create({
    data: {
      name,
      sport,
      season,
      description: description || null,
      pickType: pickType === "AGAINST_SPREAD" ? "AGAINST_SPREAD" : "STRAIGHT_UP",
      blindPicks,
      buyInCents: buyIn,
      inviteCode: newInviteCode(),
      memberships: {
        create: { userId: user.id, role: "COMMISSIONER", teamName: `${user.name}'s Team` },
      },
    },
  });

  // Auto-record the commissioner's buy-in as owed, if there is one.
  if (buyIn > 0) {
    const membership = await db.membership.findUnique({
      where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
    });
    if (membership) {
      await db.ledgerEntry.create({
        data: {
          leagueId: league.id,
          membershipId: membership.id,
          type: "BUY_IN",
          amountCents: buyIn,
          note: "Season buy-in",
          createdById: user.id,
        },
      });
    }
  }

  redirect(`/leagues/${league.id}`);
}

export async function updateLeagueSettingsAction(leagueId: string, formData: FormData) {
  await requireAdmin(leagueId);
  const name = String(formData.get("name") || "").trim();
  const season = String(formData.get("season") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const pickType = String(formData.get("pickType") || "STRAIGHT_UP");
  const blindPicks = formData.get("blindPicks") === "on";
  const buyIn = parseDollarsToCents(String(formData.get("buyIn") || "0")) ?? 0;

  if (!name || !season) return;

  await db.league.update({
    where: { id: leagueId },
    data: {
      name,
      season,
      description: description || null,
      pickType: pickType === "AGAINST_SPREAD" ? "AGAINST_SPREAD" : "STRAIGHT_UP",
      blindPicks,
      buyInCents: Math.max(0, buyIn),
    },
  });
  revalidatePath(`/leagues/${leagueId}`);
}

export async function regenerateInviteCodeAction(leagueId: string) {
  await requireAdmin(leagueId);
  await db.league.update({ where: { id: leagueId }, data: { inviteCode: newInviteCode() } });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function joinLeagueAction(_prev: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) return { error: "Enter an invite code." };

  const league = await db.league.findUnique({ where: { inviteCode: code } });
  let target = league;
  if (!target) {
    const invite = await db.invitation.findUnique({ where: { code }, include: { league: true } });
    if (invite && invite.status === "PENDING") {
      target = invite.league;
      await db.invitation.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    }
  }
  if (!target) return { error: "That invite code doesn't match any league." };

  const existing = await db.membership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: target.id } },
  });
  if (existing) {
    if (existing.status === "REMOVED") {
      await db.membership.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
    }
    redirect(`/leagues/${target.id}`);
  }

  const membership = await db.membership.create({
    data: {
      userId: user.id,
      leagueId: target.id,
      role: "PLAYER",
      teamName: `${user.name}'s Team`,
    },
  });

  if (target.buyInCents > 0) {
    await db.ledgerEntry.create({
      data: {
        leagueId: target.id,
        membershipId: membership.id,
        type: "BUY_IN",
        amountCents: target.buyInCents,
        note: "Season buy-in",
      },
    });
  }

  redirect(`/leagues/${target.id}`);
}

export async function joinByCodeAction(formData: FormData): Promise<void> {
  await joinLeagueAction(undefined, formData); // redirects on success; errors fall through silently
}

export async function updateTeamAction(leagueId: string, formData: FormData) {
  const { membership } = await requireMembership(leagueId);
  const teamName = String(formData.get("teamName") || "").trim();
  const teamColor = String(formData.get("teamColor") || "#1b6ff5");
  const teamEmoji = String(formData.get("teamEmoji") || "🏆").trim() || "🏆";
  const teamMotto = String(formData.get("teamMotto") || "").trim();

  if (!teamName) return;

  await db.membership.update({
    where: { id: membership.id },
    data: {
      teamName,
      teamColor: /^#[0-9a-fA-F]{6}$/.test(teamColor) ? teamColor : "#1b6ff5",
      teamEmoji: teamEmoji.slice(0, 8),
      teamMotto: teamMotto || null,
    },
  });
  revalidatePath(`/leagues/${leagueId}`);
}
