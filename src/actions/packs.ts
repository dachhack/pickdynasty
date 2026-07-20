"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/superadmin";
import { espnSupported } from "@/lib/espn";
import type { BuilderGame } from "./wizard";

export async function createPickPack(formData: FormData) {
  await requireSuperAdmin();
  const title = String(formData.get("title") ?? "").trim().slice(0, 60);
  const emoji = String(formData.get("emoji") ?? "🎁").trim().slice(0, 4) || "🎁";
  const description = String(formData.get("description") ?? "").trim().slice(0, 140);
  if (!title) redirect("/admin?error=Pack%20needs%20a%20title");
  const pack = await db.pickPack.create({ data: { title, emoji, description } });
  redirect(`/admin/packs/${pack.id}`);
}

/** Builder save target for the HQ pack editor (bound with packId). */
export async function savePackGames(
  packId: string,
  input: { name: string; games: BuilderGame[] }
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const pack = await db.pickPack.findUnique({ where: { id: packId } });
  if (!pack) return { ok: false, error: "Pack not found." };
  const title = String(input.name ?? "").trim().slice(0, 60) || pack.title;
  if (!Array.isArray(input.games) || input.games.length === 0) {
    return { ok: false, error: "Add at least one game." };
  }
  if (input.games.length > 64) return { ok: false, error: "64 games max per pack." };

  const rows = [];
  for (const g of input.games) {
    const startTime = new Date(g.startTime);
    if (isNaN(startTime.getTime())) continue;
    if (!g.sport || !espnSupported(g.sport)) continue;
    rows.push({
      sport: g.sport,
      externalId: g.externalId ? String(g.externalId).slice(0, 40) : null,
      homeTeam: String(g.homeTeam ?? "").slice(0, 60) || "Home",
      awayTeam: String(g.awayTeam ?? "").slice(0, 60) || "Away",
      startTime,
      winner: g.winner === "HOME" || g.winner === "AWAY" || g.winner === "TIE" ? g.winner : null,
      homeScore: Number.isFinite(g.homeScore) ? Math.round(g.homeScore!) : null,
      awayScore: Number.isFinite(g.awayScore) ? Math.round(g.awayScore!) : null,
      spread: Number.isFinite(g.spread) ? g.spread : null,
    });
  }
  if (rows.length === 0) return { ok: false, error: "No valid games in the selection." };

  await db.$transaction([
    db.pickPackGame.deleteMany({ where: { packId } }),
    db.pickPack.update({ where: { id: packId }, data: { title } }),
    db.pickPackGame.createMany({ data: rows.map((r) => ({ ...r, packId })) }),
  ]);
  revalidatePath("/admin");
  return { ok: true, redirectTo: "/admin" };
}

export async function togglePackPublished(formData: FormData) {
  await requireSuperAdmin();
  const packId = String(formData.get("packId") ?? "");
  const pack = await db.pickPack.findUnique({ where: { id: packId } });
  if (!pack) return;
  await db.pickPack.update({ where: { id: packId }, data: { published: !pack.published } });
  revalidatePath("/admin");
}

export async function deletePickPack(formData: FormData) {
  await requireSuperAdmin();
  const packId = String(formData.get("packId") ?? "");
  await db.pickPack.deleteMany({ where: { id: packId } });
  revalidatePath("/admin");
}
