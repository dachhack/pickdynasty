import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { espnFetchCount } from "@/lib/espn";
import { syncLeagueResults } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * Scheduled result sync — hit by the GitHub Actions "Sync results" workflow
 * every 15 minutes (or any external scheduler). Syncs every league that has
 * imported games awaiting results. Guarded by CRON_SECRET in production.
 *
 * Fail-loud: when leagues needed syncing and EVERY one of them errored,
 * responds 502 so the workflow's `curl -fsS` turns the run red instead of
 * silently shipping a stale scoreboard. Partial failures stay 200 but are
 * recorded and reported. Every tick writes a SyncRun row for the HQ
 * feed-health tile (pruned after 7 days).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const startedAt = new Date();
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

  const errored = results.filter((r) => r.error);
  const upstreamEspnFetches = espnFetchCount() - fetchesBefore;
  const gamesUpdated = results.reduce((n, r) => n + r.updated, 0);

  // Health record for the HQ tile — best-effort, never fails the sync.
  try {
    await db.syncRun.create({
      data: {
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
        leaguesChecked: leagues.length,
        gamesUpdated,
        upstreamFetches: upstreamEspnFetches,
        errors: errored.map((r) => `${r.league}: ${r.error}`).join("\n"),
      },
    });
    await db.syncRun.deleteMany({
      where: { startedAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    });
  } catch {
    // e.g. migration not applied yet — sync itself still succeeded
  }

  const allFailed = leagues.length > 0 && errored.length === leagues.length;
  return NextResponse.json(
    {
      leaguesChecked: leagues.length,
      gamesUpdated,
      // With the shared cache this stays ~constant (one per unique sport+date)
      // no matter how many leagues synced — watch it to verify feed efficiency.
      upstreamEspnFetches,
      results,
    },
    { status: allFailed ? 502 : 200 }
  );
}
