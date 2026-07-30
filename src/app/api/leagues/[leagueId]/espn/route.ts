import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { userIsSuperAdmin } from "@/lib/superadmin";
import {
  espnSupported,
  fetchScoreboard,
  fetchTeams,
  fetchTeamSchedule,
  fetchWeekScoreboard,
  isWeeklySport,
  toEspnDate,
  type EspnGame,
} from "@/lib/espn";
import { SPORTS } from "@/lib/sports";
import {
  curatedPackList,
  resolveCuratedPack,
  resolveRulePack,
  rulePackList,
  type PackGame,
} from "@/lib/packs";

export const dynamic = "force-dynamic";

// Game-pool queries for the drag-and-drop slate builder.
// leagueId "hq" = the super-admin pack editor (no league context).
//   ?mode=teams&sport=nfl                      -> team list
//   ?mode=team&sport=nfl&team=12&season=2025   -> that team's schedule
//   ?mode=week&sport=nfl&season=2025&week=3    -> a numbered week
//   ?mode=day&sport=mlb&date=20260919          -> a day or YYYYMMDD-YYYYMMDD
//   ?mode=packs                                -> available pick packs
//   ?mode=pack&pack=philly|db:<id>&season=2026 -> a pack's games
//   ?mode=window&sport=nfl&season=2026&week=1  -> that week's date span,
//       swept across EVERY sport (cross-sport calendar filter)

function serialize(games: (EspnGame & { sport?: string })[], fallbackSport: string) {
  return games.map((g) => ({
    sport: g.sport ?? fallbackSport,
    externalId: g.externalId,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    startTime: g.startTime.toISOString(),
    completed: g.completed,
    winner: g.winner,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    spread: g.spread,
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const isHq = leagueId === "hq";
  if (isHq) {
    if (!userIsSuperAdmin(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else {
    const membership = await db.membership.findUnique({
      where: { userId_leagueId: { userId: user.id, leagueId } },
    });
    if (membership?.role !== "COMMISSIONER") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const q = new URL(request.url).searchParams;
  const mode = q.get("mode") ?? "";

  try {
    if (mode === "packs") {
      const curated = await curatedPackList(isHq);
      return NextResponse.json({ packs: [...curated, ...rulePackList()] });
    }
    if (mode === "pack") {
      const packId = q.get("pack") ?? "";
      const season = (q.get("season") ?? "").replace(/\D/g, "").slice(0, 4) || String(new Date().getFullYear());
      let games: PackGame[] | null;
      if (packId.startsWith("db:")) games = await resolveCuratedPack(packId.slice(3), isHq);
      else games = await resolveRulePack(packId, season);
      if (!games) return NextResponse.json({ error: "unknown pack" }, { status: 404 });
      return NextResponse.json({ games: serialize(games, "nfl") });
    }

    const sport = q.get("sport") ?? "";
    if (!espnSupported(sport)) return NextResponse.json({ error: "unsupported sport" }, { status: 400 });

    if (mode === "window") {
      const season = (q.get("season") ?? "").replace(/\D/g, "").slice(0, 4);
      const week = Number(q.get("week") ?? 0);
      if (!isWeeklySport(sport) || !season || !week) return NextResponse.json({ games: [] });

      // The anchor week's real date span (± half a day for TZ slop) ...
      const anchor = await fetchWeekScoreboard(sport, season, week);
      if (anchor.length === 0) return NextResponse.json({ games: [], window: null });
      const times = anchor.map((g) => g.startTime.getTime());
      const start = new Date(Math.min(...times) - 12 * 3600_000);
      const end = new Date(Math.max(...times) + 12 * 3600_000);
      const range = `${toEspnDate(start)}-${toEspnDate(end)}`;

      // ... swept across every other ESPN sport. march-madness aliases cbb.
      const sweep = SPORTS.filter(
        (s) => s.id !== sport && s.id !== "march-madness" && espnSupported(s.id)
      ).map((s) => s.id);
      const games: (EspnGame & { sport: string })[] = anchor.map((g) => ({ ...g, sport }));
      // Sweep in small batches — a 13-league burst trips ESPN's throttling.
      for (let i = 0; i < sweep.length; i += 4) {
        await Promise.all(
          sweep.slice(i, i + 4).map(async (s) => {
            try {
              for (const g of await fetchScoreboard(s, range)) {
                if (g.startTime >= start && g.startTime <= end) games.push({ ...g, sport: s });
              }
            } catch {
              // One off-season league failing shouldn't kill the window.
            }
          })
        );
      }
      games.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return NextResponse.json({
        window: { start: start.toISOString(), end: end.toISOString() },
        games: serialize(games, sport),
      });
    }

    if (mode === "teams") {
      return NextResponse.json({ teams: await fetchTeams(sport) });
    }
    if (mode === "team") {
      const team = q.get("team") ?? "";
      const season = (q.get("season") ?? "").replace(/\D/g, "").slice(0, 4);
      if (!team || !season) return NextResponse.json({ games: [] });
      return NextResponse.json({ games: serialize(await fetchTeamSchedule(sport, team, season), sport) });
    }
    if (mode === "week") {
      const season = (q.get("season") ?? "").replace(/\D/g, "").slice(0, 4);
      const week = Number(q.get("week") ?? 0);
      if (!season || !week) return NextResponse.json({ games: [] });
      return NextResponse.json({ games: serialize(await fetchWeekScoreboard(sport, season, week), sport) });
    }
    if (mode === "day") {
      const date = q.get("date") ?? "";
      if (!/^\d{8}(-\d{8})?$/.test(date)) return NextResponse.json({ games: [] });
      return NextResponse.json({ games: serialize(await fetchScoreboard(sport, date), sport) });
    }
    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ESPN fetch failed" },
      { status: 502 }
    );
  }
}
