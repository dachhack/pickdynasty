// Client for ESPN's public (undocumented but stable) scoreboard API.
// Used to import game schedules and sync final results automatically.

type EspnPathConfig = { path: string; groups?: string };

// Maps Epic Pick'em sport ids -> ESPN API paths.
// groups: 80 = all FBS college football, 50 = all D1 men's basketball
// (without it ESPN only returns Top 25 games).
const ESPN_PATHS: Record<string, EspnPathConfig> = {
  nfl: { path: "football/nfl" },
  cfb: { path: "football/college-football", groups: "80" },
  nba: { path: "basketball/nba" },
  cbb: { path: "basketball/mens-college-basketball", groups: "50" },
  "march-madness": { path: "basketball/mens-college-basketball", groups: "50" },
  mlb: { path: "baseball/mlb" },
  cws: { path: "baseball/college-baseball" },
  nhl: { path: "hockey/nhl" },
  mls: { path: "soccer/usa.1" },
};

export function espnSupported(sport: string): boolean {
  return sport in ESPN_PATHS;
}

export type EspnGame = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  completed: boolean;
  winner: "HOME" | "AWAY" | "TIE" | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchScoreboard(
  sport: string,
  dateYYYYMMDD: string
): Promise<EspnGame[]> {
  const cfg = ESPN_PATHS[sport];
  if (!cfg) return [];
  const groups = cfg.groups ? `&groups=${cfg.groups}` : "";
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/scoreboard?dates=${dateYYYYMMDD}&limit=300${groups}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
  const data: any = await res.json();

  const games: EspnGame[] = [];
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const completed = Boolean(comp.status?.type?.completed);
    let winner: EspnGame["winner"] = null;
    if (completed) {
      const hs = parseFloat(home.score ?? "0");
      const as = parseFloat(away.score ?? "0");
      winner = hs > as ? "HOME" : as > hs ? "AWAY" : "TIE";
    }
    games.push({
      externalId: String(event.id),
      homeTeam: home.team?.displayName ?? "Home",
      awayTeam: away.team?.displayName ?? "Away",
      startTime: new Date(event.date),
      completed,
      winner,
    });
  }
  games.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return games;
}

const etDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ESPN's `dates` param is keyed to US Eastern days. */
export function toEspnDate(d: Date): string {
  return etDate.format(d).replaceAll("-", "");
}
