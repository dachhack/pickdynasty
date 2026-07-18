"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import { fetchFantasyLeagueName, fetchFantasyMatchups } from "@/lib/fantasy";

export async function linkFantasyLeague(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);

  const provider = String(formData.get("provider") ?? "");
  const providerLeagueId = String(formData.get("providerLeagueId") ?? "").trim();
  const season = String(formData.get("season") ?? "").trim();
  const espnS2 = String(formData.get("espnS2") ?? "").trim() || null;
  const swid = String(formData.get("swid") ?? "").trim() || null;

  if (!["sleeper", "espn"].includes(provider) || !providerLeagueId || !/^\d{4}$/.test(season)) {
    redirect(`/leagues/${leagueId}/admin?fantasyError=${encodeURIComponent("Provider, league ID, and a 4-digit season are required.")}`);
  }

  const link = { provider, providerLeagueId, season, espnS2, swid };
  let name = "";
  try {
    name = await fetchFantasyLeagueName(link);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not reach the fantasy provider.";
    redirect(`/leagues/${leagueId}/admin?fantasyError=${encodeURIComponent(msg)}`);
  }

  await db.fantasyLink.upsert({
    where: { leagueId },
    update: { ...link, name },
    create: { leagueId, ...link, name },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin?fantasyLinked=1`);
}

export async function unlinkFantasyLeague(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);
  await db.fantasyLink.deleteMany({ where: { leagueId } });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin`);
}

/** Imports the fantasy matchups the commissioner selected into a slate. */
export async function importFantasyMatchups(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  const week = Number(formData.get("week") ?? 0);
  const lockTimeRaw = String(formData.get("lockTime") ?? "");
  await requireCommissioner(leagueId);

  const [slate, link] = await Promise.all([
    db.slate.findFirst({ where: { id: slateId, leagueId }, include: { games: true } }),
    db.fantasyLink.findUnique({ where: { leagueId } }),
  ]);
  const lockTime = lockTimeRaw ? new Date(lockTimeRaw) : null;
  if (!slate || !link || !week || !lockTime || isNaN(lockTime.getTime())) return;

  const selected = formData.getAll("selected").map(String);
  if (selected.length === 0) return;

  const matchups = await fetchFantasyMatchups(link, week);
  const existing = new Set(slate.games.map((g) => g.externalId).filter(Boolean));

  for (const m of matchups) {
    if (!selected.includes(m.externalId) || existing.has(m.externalId)) continue;
    await db.game.create({
      data: {
        slateId: slate.id,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        startTime: lockTime,
        externalId: m.externalId,
        winner: m.winner,
      },
    });
  }
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates`);
}
