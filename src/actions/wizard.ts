"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  espnSupported,
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

export type BuilderGame = {
  sport: string | null;
  externalId: string | null;
  homeTeam: string;
  awayTeam: string;
  startTime: string; // ISO
  winner: "HOME" | "AWAY" | "TIE" | null;
  homeScore: number | null;
  awayScore: number | null;
  spread: number | null;
};

/**
 * Creates a slate from the drag-and-drop builder. Game payloads come from
 * the client, which is commissioner-equivalent trust (commissioners can
 * already hand-enter arbitrary games) — everything is still sanitized.
 */
export async function createBuilderSlate(input: {
  leagueId: string;
  name: string;
  games: BuilderGame[];
}): Promise<{ ok: true; slateId: string } | { ok: false; error: string }> {
  const me = await requireCommissioner(input.leagueId);
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) return { ok: false, error: "Give the slate a name." };
  if (!Array.isArray(input.games) || input.games.length === 0) {
    return { ok: false, error: "Add at least one game." };
  }
  if (input.games.length > 64) return { ok: false, error: "64 games max per slate." };

  const seen = new Set<string>();
  const rows = [];
  for (const g of input.games) {
    const startTime = new Date(g.startTime);
    if (isNaN(startTime.getTime())) continue;
    const sport = g.sport && espnSupported(g.sport) && g.sport !== me.league.sport ? g.sport : null;
    const externalId = g.externalId ? String(g.externalId).slice(0, 40) : null;
    const key = `${sport}:${externalId ?? Math.random()}`;
    if (externalId && seen.has(key)) continue;
    seen.add(key);
    rows.push({
      sport,
      externalId,
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

  const slate = await db.slate.create({
    data: {
      leagueId: input.leagueId,
      name,
      order: await nextSlateOrder(input.leagueId),
      games: { create: rows },
    },
  });
  revalidatePath(`/leagues/${input.leagueId}`, "layout");
  return { ok: true, slateId: slate.id };
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
