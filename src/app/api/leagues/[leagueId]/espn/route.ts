import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  espnSupported,
  fetchScoreboard,
  fetchTeams,
  fetchTeamSchedule,
  fetchWeekScoreboard,
  type EspnGame,
} from "@/lib/espn";

export const dynamic = "force-dynamic";

// Game-pool queries for the drag-and-drop slate builder. Commissioner-only.
//   ?mode=teams&sport=nfl                      -> team list
//   ?mode=team&sport=nfl&team=12&season=2025   -> that team's schedule
//   ?mode=week&sport=nfl&season=2025&week=3    -> a numbered week
//   ?mode=day&sport=mlb&date=20260919          -> a day (or YYYYMMDD-YYYYMMDD range)

function serialize(games: EspnGame[], sport: string) {
  return games.map((g) => ({
    sport,
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
  const membership = await db.membership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = new URL(request.url).searchParams;
  const mode = q.get("mode") ?? "";
  const sport = q.get("sport") ?? "";
  if (!espnSupported(sport)) return NextResponse.json({ error: "unsupported sport" }, { status: 400 });

  try {
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
