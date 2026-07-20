"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  espnSupported,
  fetchScoreboard,
  fetchWeekScoreboard,
  WEEKLY_SPORTS,
  type EspnGame,
} from "@/lib/espn";
import { fetchFantasyMatchups } from "@/lib/fantasy";

async function nextSlateOrder(leagueId: string): Promise<number> {
  return db.slate.count({ where: { leagueId } });
}

async function createSlateWithGames(
  leagueId: string,
  name: string,
  games: EspnGame[],
  pickDeadline: Date | null = null,
  sport: string | null = null
) {
  return db.slate.create({
    data: {
      leagueId,
      name,
      order: await nextSlateOrder(leagueId),
      pickDeadline,
      games: {
        create: games.map((g) => ({
          sport,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          startTime: g.startTime,
          externalId: g.externalId,
          winner: g.winner,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          spread: g.spread,
        })),
      },
    },
  });
}

export async function createManualSlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.slate.create({
    data: { leagueId, name, order: await nextSlateOrder(leagueId) },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates`);
}

/** Creates a slate from an ESPN schedule query — a week or a date range. */
export async function createScheduleSlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const me = await requireCommissioner(leagueId);
  const name = String(formData.get("name") ?? "").trim();
  const week = Number(formData.get("week") ?? 0);
  const dates = String(formData.get("dates") ?? "");
  // Mixed-sport leagues: games may be imported from any ESPN-covered sport.
  const sportRaw = String(formData.get("sport") ?? "");
  const sport = espnSupported(sportRaw) ? sportRaw : me.league.sport;
  const selected = new Set(formData.getAll("selected").map(String));
  if (!name || selected.size === 0) return;

  const all = week
    ? await fetchWeekScoreboard(sport, me.league.season, week)
    : /^\d{8}(-\d{8})?$/.test(dates)
      ? await fetchScoreboard(sport, dates)
      : [];
  const games = all.filter((g) => selected.has(g.externalId));
  if (games.length === 0) return;

  await createSlateWithGames(leagueId, name, games, null, sport === me.league.sport ? null : sport);
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates`);
}

/** Season autopilot: one slate per remaining week, all games included. */
export async function createSeasonSlates(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const me = await requireCommissioner(leagueId);
  const fromWeek = Number(formData.get("fromWeek") ?? 1);
  const weekly = WEEKLY_SPORTS[me.league.sport];
  if (!weekly || fromWeek < 1) return;

  const existingNames = new Set(
    (await db.slate.findMany({ where: { leagueId } })).map((s) => s.name)
  );
  let created = 0;
  for (let week = fromWeek; week <= weekly.maxWeek; week++) {
    const name = `Week ${week}`;
    if (existingNames.has(name)) continue;
    const games = await fetchWeekScoreboard(me.league.sport, me.league.season, week);
    if (games.length === 0) continue;
    await createSlateWithGames(leagueId, name, games);
    created++;
  }
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates?created=${created}`);
}

/** Creates a slate of fantasy matchups with a commissioner-set lock time. */
export async function createFantasySlate(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  await requireCommissioner(leagueId);
  const name = String(formData.get("name") ?? "").trim();
  const week = Number(formData.get("week") ?? 0);
  const lockTimeRaw = String(formData.get("lockTime") ?? "");
  const lockTime = lockTimeRaw ? new Date(lockTimeRaw) : null;
  const selected = new Set(formData.getAll("selected").map(String));

  const link = await db.fantasyLink.findUnique({ where: { leagueId } });
  if (!link || !name || !week || !lockTime || isNaN(lockTime.getTime()) || selected.size === 0)
    return;

  const matchups = (await fetchFantasyMatchups(link, week)).filter((m) =>
    selected.has(m.externalId)
  );
  if (matchups.length === 0) return;

  await db.slate.create({
    data: {
      leagueId,
      name,
      order: await nextSlateOrder(leagueId),
      pickDeadline: lockTime,
      games: {
        create: matchups.map((m) => ({
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          startTime: lockTime,
          externalId: m.externalId,
          winner: m.winner,
        })),
      },
    },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/leagues/${leagueId}/admin/slates`);
}
