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
  type EspnGame,
} from "@/lib/espn";
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
