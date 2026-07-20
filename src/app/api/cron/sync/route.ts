import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { espnFetchCount } from "@/lib/espn";
import { syncLeagueResults } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * Scheduled result sync — hit by Vercel Cron (see vercel.json) or any
 * external scheduler. Syncs every league that has imported games awaiting
 * results. Guarded by CRON_SECRET in production.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const leagues = await db.league.findMany({
    where: {
      slates: {
        some: {
          games: {
            some: { externalId: { not: null }, winner: null, startTime: { lt: new Date() } },
          },
        },
      },
    },
    select: { id: true, sport: true, name: true },
  });

  const fetchesBefore = espnFetchCount();
  const results: { league: string; updated: number; error?: string }[] = [];
  for (const league of leagues) {
    try {
      const updated = await syncLeagueResults(league.id, league.sport);
      results.push({ league: league.name, updated });
    } catch (e) {
      results.push({
        league: league.name,
        updated: 0,
        error: e instanceof Error ? e.message : "sync failed",
      });
    }
  }
  return NextResponse.json({
    leaguesChecked: leagues.length,
    // With the shared cache this stays ~constant (one per unique sport+date)
    // no matter how many leagues synced — watch it to verify feed efficiency.
    upstreamEspnFetches: espnFetchCount() - fetchesBefore,
    results,
  });
}
