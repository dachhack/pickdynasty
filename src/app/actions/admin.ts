"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { newInviteCode, requireAdmin } from "@/lib/league";
import { parseDollarsToCents } from "@/lib/money";

// ---------- Rounds & games ----------

export async function createRoundAction(leagueId: string, formData: FormData) {
  await requireAdmin(leagueId);
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const count = await db.round.count({ where: { leagueId } });
  await db.round.create({ data: { leagueId, name, order: count } }).catch(() => {
    // duplicate round name — ignore
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function deleteRoundAction(leagueId: string, roundId: string) {
  await requireAdmin(leagueId);
  await db.round.delete({ where: { id: roundId, leagueId } });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function createGameAction(leagueId: string, roundId: string, formData: FormData) {
  await requireAdmin(leagueId);
  const round = await db.round.findFirst({ where: { id: roundId, leagueId } });
  if (!round) return;

  const awayTeam = String(formData.get("awayTeam") || "").trim();
  const homeTeam = String(formData.get("homeTeam") || "").trim();
  const locksAtRaw = String(formData.get("locksAt") || "");
  const spreadRaw = String(formData.get("spread") || "").trim();
  const pointsRaw = String(formData.get("points") || "1").trim();

  if (!awayTeam || !homeTeam || !locksAtRaw) return;
  const locksAt = new Date(locksAtRaw);
  if (Number.isNaN(locksAt.getTime())) return;
  const spread = spreadRaw === "" ? null : Number(spreadRaw);
  const points = Math.max(1, Math.round(Number(pointsRaw) || 1));

  await db.game.create({
    data: {
      roundId,
      awayTeam,
      homeTeam,
      locksAt,
      spread: spread !== null && Number.isFinite(spread) ? spread : null,
      points,
    },
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function deleteGameAction(leagueId: string, gameId: string) {
  await requireAdmin(leagueId);
  const game = await db.game.findFirst({ where: { id: gameId, round: { leagueId } } });
  if (!game) return;
  await db.game.delete({ where: { id: gameId } });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function recordResultAction(leagueId: string, gameId: string, formData: FormData) {
  await requireAdmin(leagueId);
  const game = await db.game.findFirst({ where: { id: gameId, round: { leagueId } } });
  if (!game) return;

  const winner = String(formData.get("winner") || "");
  const homeScoreRaw = String(formData.get("homeScore") || "").trim();
  const awayScoreRaw = String(formData.get("awayScore") || "").trim();

  const valid = ["HOME", "AWAY", "TIE", "VOID", "PENDING"];
  if (!valid.includes(winner)) return;

  await db.game.update({
    where: { id: gameId },
    data: {
      winner: winner === "PENDING" ? null : winner,
      homeScore: homeScoreRaw === "" ? null : Math.round(Number(homeScoreRaw)),
      awayScore: awayScoreRaw === "" ? null : Math.round(Number(awayScoreRaw)),
    },
  });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/admin`);
  revalidatePath(`/leagues/${leagueId}/standings`);
}

// ---------- Members & invites ----------

export async function createInviteAction(leagueId: string, formData: FormData) {
  await requireAdmin(leagueId);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  await db.invitation.create({
    data: { leagueId, email: email || null, code: newInviteCode() },
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function revokeInviteAction(leagueId: string, inviteId: string) {
  await requireAdmin(leagueId);
  await db.invitation.update({ where: { id: inviteId, leagueId }, data: { status: "REVOKED" } });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function setMemberRoleAction(leagueId: string, membershipId: string, role: string) {
  const { membership: actor } = await requireAdmin(leagueId);
  if (!["ADMIN", "PLAYER"].includes(role)) return;
  const target = await db.membership.findFirst({ where: { id: membershipId, leagueId } });
  if (!target || target.role === "COMMISSIONER" || target.id === actor.id) return;
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function removeMemberAction(leagueId: string, membershipId: string) {
  const { membership: actor } = await requireAdmin(leagueId);
  const target = await db.membership.findFirst({ where: { id: membershipId, leagueId } });
  if (!target || target.role === "COMMISSIONER" || target.id === actor.id) return;
  await db.membership.update({ where: { id: membershipId }, data: { status: "REMOVED" } });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

// ---------- Money ----------

export async function addLedgerEntryAction(leagueId: string, formData: FormData) {
  const { user } = await requireAdmin(leagueId);
  const membershipId = String(formData.get("membershipId") || "");
  const type = String(formData.get("type") || "");
  const amount = parseDollarsToCents(String(formData.get("amount") || ""));
  const note = String(formData.get("note") || "").trim();

  if (!["BUY_IN", "PAYMENT", "PAYOUT", "ADJUSTMENT"].includes(type)) return;
  if (amount === null || amount === 0) return;

  const membership = membershipId
    ? await db.membership.findFirst({ where: { id: membershipId, leagueId } })
    : null;

  await db.ledgerEntry.create({
    data: {
      leagueId,
      membershipId: membership?.id ?? null,
      type,
      amountCents: type === "ADJUSTMENT" ? amount : Math.abs(amount),
      note: note || null,
      createdById: user.id,
    },
  });
  revalidatePath(`/leagues/${leagueId}/money`);
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function deleteLedgerEntryAction(leagueId: string, entryId: string) {
  await requireAdmin(leagueId);
  await db.ledgerEntry.delete({ where: { id: entryId, leagueId } });
  revalidatePath(`/leagues/${leagueId}/money`);
  revalidatePath(`/leagues/${leagueId}/admin`);
}
