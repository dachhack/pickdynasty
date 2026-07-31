import { sportEmoji } from "@/lib/sports";

const kickFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

export type TickerGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  startTime: Date;
  sport: string | null;
};

function TickerItem({ g, fallbackSport }: { g: TickerGame; fallbackSport: string }) {
  const live = g.homeScore != null && !g.winner;
  const side = (team: string, score: number | null, won: boolean) => (
    <span className={g.winner ? (won ? "font-black" : "text-slate-500") : "font-semibold"}>
      {team}
      {score != null && <span className="ml-1.5 font-mono font-black">{score}</span>}
    </span>
  );
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-lg">
      <span>{sportEmoji(g.sport ?? fallbackSport)}</span>
      {side(g.awayTeam, g.awayScore, g.winner === "AWAY")}
      <span className="text-slate-600">@</span>
      {side(g.homeTeam, g.homeScore, g.winner === "HOME")}
      <span className="text-sm text-slate-500">
        {g.winner ? "Final" : live ? "🔴 LIVE" : `${kickFmt.format(g.startTime)} ET`}
      </span>
    </span>
  );
}

/**
 * Bottom-of-screen sports ticker for the TV boards: the featured slate's
 * games scroll continuously, ESPN-bottom-line style. Pure CSS animation
 * (see .ticker-track in globals.css) — the two identical halves make the
 * loop seamless, and score updates from the board's auto-refresh patch
 * text in place without restarting the scroll.
 */
export default function TvTicker({
  label,
  games,
  fallbackSport,
}: {
  label: string;
  games: TickerGame[];
  fallbackSport: string;
}) {
  if (games.length === 0) return null;
  const duration = Math.max(30, games.length * 8);

  const half = (hidden: boolean) => (
    <div
      aria-hidden={hidden || undefined}
      className="flex min-w-full shrink-0 items-center gap-12 px-8"
    >
      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold uppercase tracking-wide text-slate-300">
        {label}
      </span>
      {games.map((g) => (
        <TickerItem key={g.id} g={g} fallbackSport={fallbackSport} />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-slate-800 bg-slate-950/90 py-3 backdrop-blur">
      <div
        className="ticker-track"
        style={{ "--ticker-duration": `${duration}s` } as React.CSSProperties}
      >
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}
