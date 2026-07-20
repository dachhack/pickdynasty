import Link from "next/link";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  espnSupported,
  fetchCurrentWeek,
  fetchScoreboard,
  fetchWeekScoreboard,
  isWeeklySport,
  toEspnDate,
  WEEKLY_SPORTS,
  type EspnGame,
} from "@/lib/espn";
import { fetchFantasyMatchups, type FantasyMatchup } from "@/lib/fantasy";
import { SPORTS, sportLabel } from "@/lib/sports";
import {
  createFantasySlate,
  createManualSlate,
  createScheduleSlate,
  createSeasonSlates,
} from "@/actions/wizard";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});
const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** Preset date ranges for daily sports, computed in US Eastern time. */
function rangePresets(): { label: string; dates: string }[] {
  const now = new Date();
  const today = toEspnDate(now);
  // Next Saturday (or today if it's Saturday/Sunday already).
  const dow = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" })
      .format(now) === "Sun"
      ? 0
      : new Date(now).getUTCDay()
  );
  const satOffset = dow === 6 || dow === 0 ? 0 : 6 - dow;
  const sat = addDays(now, satOffset);
  return [
    { label: "Today", dates: today },
    { label: "This weekend", dates: `${toEspnDate(sat)}-${toEspnDate(addDays(sat, 1))}` },
    { label: "Next 7 days", dates: `${today}-${toEspnDate(addDays(now, 6))}` },
  ];
}

function rangeLabel(dates: string): string {
  const parse = (s: string) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00-05:00`);
  const [from, to] = dates.split("-");
  if (!to || from === to) return dayFmt.format(parse(from));
  return `${dayFmt.format(parse(from))} – ${dayFmt.format(parse(to))}`;
}

export default async function NewSlatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; week?: string; dates?: string; from?: string; to?: string; sport?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireCommissioner(id);
  const { league } = me;

  const fantasyLink = await db.fantasyLink.findUnique({ where: { leagueId: id } });
  // Mixed-sport leagues: the schedule flow can import from ANY ESPN-covered
  // sport, defaulting to the league's primary.
  const sport = sp.sport && espnSupported(sp.sport) ? sp.sport : league.sport;
  const sportQS = sport === league.sport ? "" : `&sport=${sport}`;
  const hasSchedule = espnSupported(league.sport) || SPORTS.some((x) => espnSupported(x.id));
  const weekly = isWeeklySport(sport);

  // Fall through to the only available source.
  let source = sp.source ?? "";
  if (!source && !hasSchedule && !fantasyLink) source = "manual";

  // Custom range inputs (YYYY-MM-DD) -> ESPN dates param.
  let dates = sp.dates ?? "";
  if (!dates && sp.from) {
    const from = sp.from.replaceAll("-", "");
    const to = (sp.to || sp.from).replaceAll("-", "");
    if (/^\d{8}$/.test(from) && /^\d{8}$/.test(to)) dates = from === to ? from : `${from}-${to}`;
  }
  const week = Number(sp.week ?? 0);

  const back = (
    <Link href={`/leagues/${id}/admin/slates`} className="text-sm text-indigo-400 hover:underline">
      ← Back to slates
    </Link>
  );

  // Sport switcher for the schedule flow (league primary first).
  const espnSports = [
    ...SPORTS.filter((x) => x.id === league.sport && espnSupported(x.id)),
    ...SPORTS.filter((x) => x.id !== league.sport && espnSupported(x.id)),
  ];
  const sportChips = (
    <div className="flex flex-wrap gap-2">
      {espnSports.map((x) => (
        <Link
          key={x.id}
          href={`/leagues/${id}/admin/slates/new?source=schedule${x.id === league.sport ? "" : `&sport=${x.id}`}`}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            x.id === sport
              ? "border-indigo-500 bg-indigo-950/50 text-white"
              : "border-slate-800 text-slate-400 hover:border-slate-600"
          }`}
        >
          {x.emoji} {x.label}
          {x.id === league.sport && " (league)"}
        </Link>
      ))}
    </div>
  );

  // ---------- Step 1: pick a source ----------
  if (!source) {
    const sources = [
      ...(hasSchedule
        ? [{
            key: "schedule",
            emoji: "📅",
            title: `Real games (${sportLabel(league.sport)} + any sport)`,
            body: "Import from the live ESPN schedule — your league's sport or mix in others.",
          }]
        : []),
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

  // ---------- Schedule (weekly sports) ----------
  if (source === "schedule" && weekly && !week) {
    const currentWeek = await fetchCurrentWeek(sport);
    const { maxWeek } = WEEKLY_SPORTS[sport];
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h2 className="text-xl font-bold">{sportLabel(sport)} {league.season} — which week?</h2>
        {sportChips}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
            <Link
              key={w}
              href={`/leagues/${id}/admin/slates/new?source=schedule&week=${w}${sportQS}`}
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
        {sport === league.sport && (
        <form action={createSeasonSlates} className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">🚀 Season autopilot</h3>
            <p className="text-sm text-slate-400">
              Create every remaining week as its own slate, all games included, in one go.
            </p>
          </div>
          <input type="hidden" name="leagueId" value={id} />
          <input type="hidden" name="fromWeek" value={currentWeek ?? 1} />
          <button className="btn-ghost">Create weeks {currentWeek ?? 1}–{WEEKLY_SPORTS[sport].maxWeek}</button>
        </form>
        )}
        {back}
      </div>
    );
  }

  // ---------- Schedule (daily sports: pick a range) ----------
  if (source === "schedule" && !weekly && !dates) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h2 className="text-xl font-bold">{sportLabel(sport)} — which days?</h2>
        {sportChips}
        <div className="flex flex-wrap gap-2">
          {rangePresets().map((p) => (
            <Link
              key={p.label}
              href={`/leagues/${id}/admin/slates/new?source=schedule&dates=${p.dates}${sportQS}`}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500"
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form method="GET" className="card flex flex-wrap items-end gap-3">
          <input type="hidden" name="source" value="schedule" />
          {sport !== league.sport && <input type="hidden" name="sport" value={sport} />}
          <div>
            <label className="label" htmlFor="from">From</label>
            <input className="input" type="date" id="from" name="from" required />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input className="input" type="date" id="to" name="to" />
          </div>
          <button className="btn-ghost">Load games</button>
        </form>
        {back}
      </div>
    );
  }

  // ---------- Schedule preview + create ----------
  let games: EspnGame[] = [];
  let fetchError = "";
  try {
    games = week
      ? await fetchWeekScoreboard(sport, league.season, week)
      : await fetchScoreboard(sport, dates);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not reach ESPN.";
  }
  const namePrefix = sport === league.sport ? "" : `${sportLabel(sport)} · `;
  const defaultName = namePrefix + (week ? `Week ${week}` : rangeLabel(dates));
  const firstUpcoming = games.find((g) => !g.completed);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h2 className="text-xl font-bold">
        {sportLabel(sport)} · {week ? `Week ${week}` : rangeLabel(dates)}
      </h2>
      {fetchError ? (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">{fetchError}</p>
      ) : games.length === 0 ? (
        <p className="card text-center text-slate-400">
          No {sportLabel(sport)} games found{week ? ` for week ${week} of ${league.season}` : " in that range"}.
        </p>
      ) : (
        <form action={createScheduleSlate} className="card flex flex-col gap-1">
          <input type="hidden" name="leagueId" value={id} />
          <input type="hidden" name="sport" value={sport} />
          {week ? (
            <input type="hidden" name="week" value={week} />
          ) : (
            <input type="hidden" name="dates" value={dates} />
          )}
          {games.map((g) => (
            <label key={g.externalId} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800/50">
              <input type="checkbox" name="selected" value={g.externalId} defaultChecked={!g.completed} className="h-4 w-4 accent-indigo-500" />
              <span className="font-semibold">{g.awayTeam} @ {g.homeTeam}</span>
              <span className="ml-auto text-xs text-slate-500">
                {g.completed ? "final" : timeFmt.format(g.startTime)}
              </span>
            </label>
          ))}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-t border-slate-800 pt-4">
            <div>
              <label className="label" htmlFor="name">Slate name</label>
              <input className="input" id="name" name="name" defaultValue={defaultName} required />
              {firstUpcoming && (
                <p className="mt-1 text-xs text-slate-500">
                  Picks lock per game · first kickoff {timeFmt.format(firstUpcoming.startTime)}
                </p>
              )}
            </div>
            <button className="btn">Create slate</button>
          </div>
        </form>
      )}
      {back}
    </div>
  );
}
