"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { makeInviteCode, requireCommissioner } from "@/lib/league";

export async function updateLeagueSettings(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);

  const name = String(formData.get("name") ?? "").trim();
  const season = String(formData.get("season") ?? "").trim();
  const buyIn = Number(formData.get("buyIn") ?? 0) || 0;
  const format = String(formData.get("format") ?? "");

  await db.league.update({
    where: { id: leagueId },
    data: {
      ...(name ? { name } : {}),
      ...(season ? { season } : {}),
      ...(["classic", "confidence", "survivor", "spread"].includes(format) ? { format } : {}),
      buyIn,
      blindPicks: formData.get("blindPicks") === "on",
      adminCanSeePicks: formData.get("adminCanSeePicks") === "on",
    },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin?saved=1`);
}

export async function regenerateInviteCode(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);
  await db.league.update({
    where: { id: leagueId },
    data: { inviteCode: makeInviteCode() },
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

export async function removeMember(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (membershipId === me.id) return; // can't remove yourself

  await db.membership.deleteMany({ where: { id: membershipId, leagueId } });
  revalidatePath(`/leagues/${leagueId}`, "layout");
}

export async function toggleRole(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (membershipId === me.id) return; // keep at least one commissioner

  const target = await db.membership.findFirst({ where: { id: membershipId, leagueId } });
  if (!target) return;
  await db.membership.update({
    where: { id: target.id },
    data: { role: target.role === "COMMISSIONER" ? "PLAYER" : "COMMISSIONER" },
  });
  revalidatePath(`/leagues/${leagueId}/admin`);
}

/** Drag-to-reorder slates from the admin order strip. */
export async function reorderSlates(input: {
  leagueId: string;
  orderedSlateIds: string[];
}): Promise<void> {
  await requireCommissioner(input.leagueId);
  const slates = await db.slate.findMany({ where: { leagueId: input.leagueId } });
  const valid = new Set(slates.map((s) => s.id));
  let order = 0;
  for (const id of input.orderedSlateIds) {
    if (!valid.has(id)) continue;
    await db.slate.update({ where: { id }, data: { order: order++ } });
  }
  revalidatePath(`/leagues/${input.leagueId}`, "layout");
}

export async function createSlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const deadlineRaw = String(formData.get("pickDeadline") ?? "");
  const count = await db.slate.count({ where: { leagueId } });

  await db.slate.create({
    data: {
      leagueId,
      name,
      order: count,
      pickDeadline: deadlineRaw ? new Date(deadlineRaw) : null,
    },
  });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
}

export async function deleteSlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  await requireCommissioner(leagueId);
  await db.slate.deleteMany({ where: { id: slateId, leagueId } });
  revalidatePath(`/leagues/${leagueId}`, "layout");
}

export async function addGame(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  await requireCommissioner(leagueId);

  const slate = await db.slate.findFirst({ where: { id: slateId, leagueId } });
  if (!slate) return;

  const awayTeam = String(formData.get("awayTeam") ?? "").trim();
  const homeTeam = String(formData.get("homeTeam") ?? "").trim();
  const startRaw = String(formData.get("startTime") ?? "");
  if (!awayTeam || !homeTeam || !startRaw) return;

  await db.game.create({
    data: { slateId, awayTeam, homeTeam, startTime: new Date(startRaw) },
  });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
}

export async function deleteGame(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  await requireCommissioner(leagueId);
  await db.game.deleteMany({ where: { id: gameId, slate: { leagueId } } });
  revalidatePath(`/leagues/${leagueId}/admin/slates`);
}

export async function setResult(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  const winner = String(formData.get("winner") ?? "");
  await requireCommissioner(leagueId);

  if (!["HOME", "AWAY", "TIE", "CLEAR"].includes(winner)) return;
  const game = await db.game.findFirst({ where: { id: gameId, slate: { leagueId } } });
  if (!game) return;

  await db.game.update({
    where: { id: game.id },
    data: { winner: winner === "CLEAR" ? null : winner },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
}
