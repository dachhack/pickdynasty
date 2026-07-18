"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";

export async function addMoneyEntry(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);

  const type = String(formData.get("type") ?? "BUY_IN");
  if (!["BUY_IN", "PAYOUT", "ADJUSTMENT"].includes(type)) return;
  const rawAmount = Math.abs(Number(formData.get("amount") ?? 0));
  if (!rawAmount || !isFinite(rawAmount)) return;
  // Buy-ins add to the pot; payouts remove from it.
  const amount = type === "PAYOUT" ? -rawAmount : rawAmount;

  const membershipId = String(formData.get("membershipId") ?? "") || null;
  if (membershipId) {
    const member = await db.membership.findFirst({ where: { id: membershipId, leagueId } });
    if (!member) return;
  }

  await db.moneyEntry.create({
    data: {
      leagueId,
      membershipId,
      type,
      amount,
      note: String(formData.get("note") ?? "").trim(),
      settled: formData.get("settled") === "on",
    },
  });
  revalidatePath(`/leagues/${leagueId}/money`);
}

export async function toggleSettled(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  await requireCommissioner(leagueId);

  const entry = await db.moneyEntry.findFirst({ where: { id: entryId, leagueId } });
  if (!entry) return;
  await db.moneyEntry.update({ where: { id: entry.id }, data: { settled: !entry.settled } });
  revalidatePath(`/leagues/${leagueId}/money`);
}

export async function deleteMoneyEntry(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  await requireCommissioner(leagueId);
  await db.moneyEntry.deleteMany({ where: { id: entryId, leagueId } });
  revalidatePath(`/leagues/${leagueId}/money`);
}
