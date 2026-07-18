"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import { fetchScoreboard, toEspnDate } from "@/lib/espn";

/** Imports the games the commissioner checked on the import page. */
export async function importEspnGames(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const slateId = String(formData.get("slateId") ?? "");
  const date = String(formData.get("date") ?? ""); // YYYYMMDD
  const me = await requireCommissioner(leagueId);

  const slate = await db.slate.findFirst({
    where: { id: slateId, leagueId },
    include: { games: true },
  });
  if (!slate || !/^\d{8}$/.test(date)) return;

  const selected = formData.getAll("selected").map(String);
  if (selected.length === 0) return;

  const scoreboard = await fetchScoreboard(me.league.sport, date);
  const existing = new Set(slate.games.map((g) => g.externalId).filter(Boolean));

  for (const g of scoreboard) {
    if (!selected.includes(g.externalId) || existing.has(g.externalId)) continue;
    await db.game.create({
      data: {
        slateId: slate.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        startTime: g.startTime,
        externalId: g.externalId,
        winner: g.winner,
      },
    });
  }
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates`);
}

/** Pulls final scores from ESPN for every imported, undecided, started game. */
export async function syncEspnResults(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const me = await requireCommissioner(leagueId);

  const pending = await db.game.findMany({
    where: {
      slate: { leagueId },
      externalId: { not: null },
      winner: null,
      startTime: { lt: new Date() },
    },
  });

  const dates = [...new Set(pending.map((g) => toEspnDate(g.startTime)))];
  const results = new Map<string, "HOME" | "AWAY" | "TIE">();
  for (const date of dates) {
    for (const g of await fetchScoreboard(me.league.sport, date)) {
      if (g.completed && g.winner) results.set(g.externalId, g.winner);
    }
  }

  for (const game of pending) {
    const winner = game.externalId ? results.get(game.externalId) : undefined;
    if (winner) {
      await db.game.update({ where: { id: game.id }, data: { winner } });
    }
  }
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates?synced=1`);
}
