import Link from "next/link";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  espnSupported,
  fetchCurrentWeek,
  fetchWeekScoreboard,
  isWeeklySport,
  WEEKLY_SPORTS,
} from "@/lib/espn";
import { fetchFantasyMatchups, type FantasyMatchup } from "@/lib/fantasy";
import { SPORTS, sportLabel } from "@/lib/sports";
import { createFantasySlate, createManualSlate, createSeasonSlates } from "@/actions/wizard";
import SlateBuilder from "@/components/SlateBuilder";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

export default async function NewSlatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; week?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireCommissioner(id);
  const { league } = me;

  const fantasyLink = await db.fantasyLink.findUnique({ where: { leagueId: id } });
  const source = sp.source ?? "";
  const week = Number(sp.week ?? 0);

  const back = (
    <Link href={`/leagues/${id}/admin/slates`} className="text-sm text-indigo-400 hover:underline">
      ← Back to slates
    </Link>
  );

  // ---------- Step 1: pick a source ----------
  if (!source) {
    const sources = [
      {
        key: "schedule",
        emoji: "📅",
        title: "Real games — any sport",
        body: "Drag-and-drop builder: browse by week, day, or team from the live ESPN schedule. Mix sports in one slate.",
      },
      ...(fantasyLink
        ? [{
            key: "fantasy",
            emoji: "🏆",
            title: "Fantasy matchups",
            body: `Weekly head-to-heads from ${fantasyLink.name}.`,
          }]
        : []),
      { key: "manual", emoji: "✍️", title: "Manual", body: "Start empty and add games yourself." },
    ];
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h2 className="text-xl font-bold">New slate — what are we picking?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sources.map((s) => (
            <Link
              key={s.key}
              href={`/leagues/${id}/admin/slates/new?source=${s.key}`}
              className="card transition hover:border-indigo-600"
            >
              <div className="text-3xl">{s.emoji}</div>
              <h3 className="mt-2 font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{s.body}</p>
            </Link>
          ))}
        </div>
        {back}
      </div>
    );
  }

  // ---------- Manual ----------
  if (source === "manual") {
    return (
      <div className="flex max-w-md flex-col gap-6">
        <h2 className="text-xl font-bold">New manual slate</h2>
        <form action={createManualSlate} className="card flex flex-col gap-4">
          <input type="hidden" name="leagueId" value={id} />
          <div>
            <label className="label" htmlFor="name">Slate name</label>
            <input className="input" id="name" name="name" required placeholder="Week 1" />
          </div>
          <p className="text-xs text-slate-500">
            You&rsquo;ll add games from the slates page after creating it.
          </p>
          <button className="btn self-start">Create empty slate</button>
        </form>
        {back}
      </div>
    );
  }

  // ---------- Fantasy ----------
  if (source === "fantasy" && fantasyLink) {
    if (!week) {
      const currentWeek = (await fetchCurrentWeek("nfl")) ?? null;
      return (
        <div className="flex max-w-2xl flex-col gap-6">
          <h2 className="text-xl font-bold">Fantasy matchups — which week?</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <Link
                key={w}
                href={`/leagues/${id}/admin/slates/new?source=fantasy&week=${w}`}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                  w === currentWeek
                    ? "border-indigo-500 bg-indigo-950/50 text-white"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                Wk {w}{w === currentWeek && " · now"}
              </Link>
            ))}
          </div>
          {back}
        </div>
      );
    }

    let matchups: FantasyMatchup[] = [];
    let autoLock: Date | null = null;
    let fetchError = "";
    try {
      matchups = await fetchFantasyMatchups(fantasyLink, week);
      // Default lock: first NFL kickoff of that week in the fantasy season.
      const nflWeek = await fetchWeekScoreboard("nfl", fantasyLink.season, week);
      autoLock = nflWeek[0]?.startTime ?? null;
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Could not reach the fantasy provider.";
    }

    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h2 className="text-xl font-bold">Fantasy Week {week} · {fantasyLink.name}</h2>
        {fetchError ? (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">{fetchError}</p>
        ) : matchups.length === 0 ? (
          <p className="card text-center text-slate-400">No matchups found for week {week}.</p>
        ) : (
          <form action={createFantasySlate} className="card flex flex-col gap-1">
            <input type="hidden" name="leagueId" value={id} />
            <input type="hidden" name="week" value={week} />
            {matchups.map((m) => (
              <label key={m.externalId} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800/50">
                <input type="checkbox" name="selected" value={m.externalId} defaultChecked={!m.final} className="h-4 w-4 accent-indigo-500" />
                <span className="font-semibold">{m.awayTeam} vs {m.homeTeam}</span>
                <span className="ml-auto text-xs text-slate-500">{m.final ? "final" : "upcoming"}</span>
              </label>
            ))}
            <div className="mt-3 grid gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Slate name</label>
                <input className="input" id="name" name="name" defaultValue={`Fantasy Week ${week}`} required />
              </div>
              <div>
                <label className="label" htmlFor="lockTime">Picks lock at</label>
                {autoLock ? (
                  <>
                    <input type="hidden" name="lockTime" value={autoLock.toISOString()} />
                    <p className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                      🔒 {timeFmt.format(autoLock)}
                      <span className="block text-xs text-slate-500">first NFL kickoff of week {week}</span>
                    </p>
                  </>
                ) : (
                  <input className="input" type="datetime-local" id="lockTime" name="lockTime" required />
                )}
              </div>
            </div>
            <button className="btn mt-4 self-start">Create slate</button>
          </form>
        )}
        {back}
      </div>
    );
  }

  // ---------- Schedule: drag-and-drop slate builder ----------
  const espnSportInfos = [
    ...SPORTS.filter((x) => x.id === league.sport && espnSupported(x.id)),
    ...SPORTS.filter((x) => x.id !== league.sport && espnSupported(x.id)),
  ].map((x) => ({ id: x.id, label: x.label, emoji: x.emoji }));
  const builderDefaultSport = espnSupported(league.sport) ? league.sport : "nfl";
  const currentWeek = isWeeklySport(league.sport) ? await fetchCurrentWeek(league.sport) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Build your slate</h2>
        <p className="text-sm text-slate-400">
          Browse the pool by week, day, or team — any sport, any season — and drag games into your
          slate. Mixing sports is fair game.
        </p>
      </div>
      <SlateBuilder
        leagueId={id}
        leagueSport={builderDefaultSport}
        leagueSeason={league.season}
        sports={espnSportInfos}
        weeklyMax={Object.fromEntries(
          Object.entries(WEEKLY_SPORTS).map(([k, v]) => [k, v.maxWeek])
        )}
        todayISO={new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}
      />
      {isWeeklySport(league.sport) && (
        <form action={createSeasonSlates} className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">🚀 Season autopilot</h3>
            <p className="text-sm text-slate-400">
              Or skip the crafting: every remaining {sportLabel(league.sport)} week as its own
              slate, all games included.
            </p>
          </div>
          <input type="hidden" name="leagueId" value={id} />
          <input type="hidden" name="fromWeek" value={currentWeek ?? 1} />
          <button className="btn-ghost">
            Create weeks {currentWeek ?? 1}–{WEEKLY_SPORTS[league.sport].maxWeek}
          </button>
        </form>
      )}
      {back}
    </div>
  );
}
