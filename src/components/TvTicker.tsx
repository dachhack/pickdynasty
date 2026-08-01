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
  // 🎯 Player props ride the ticker too.
  kind?: string;
  propLabel?: string | null;
  line?: number | null;
  propActual?: number | null;
  // ESPN CDN art.
  homeLogo?: string | null;
  awayLogo?: string | null;
  propImage?: string | null;
};

function TickerItem({ g, fallbackSport }: { g: TickerGame; fallbackSport: string }) {
  if (g.kind === "prop") {
    const result =
      g.winner === "AWAY" ? "Over ✓" : g.winner === "HOME" ? "Under ✓" : "Push";
    return (
      <span className="flex items-center gap-2 whitespace-nowrap text-lg">
        {g.propImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={g.propImage}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full bg-slate-800 object-cover"
          />
        ) : (
          <span>🎯</span>
        )}
        <span className="font-semibold">{g.propLabel}</span>
        <span className="font-mono font-black">O/U {g.line}</span>
        <span className="text-sm text-slate-500">
          {g.winner
            ? `${g.propActual != null ? `${g.propActual} — ` : ""}${result}`
            : `${kickFmt.format(g.startTime)} ET`}
        </span>
      </span>
    );
  }
  const live = g.homeScore != null && !g.winner;
  const side = (team: string, score: number | null, won: boolean, logo?: string | null) => (
    <span
      className={`flex items-center gap-1.5 ${g.winner ? (won ? "font-black" : "text-slate-500") : "font-semibold"}`}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-6 w-6 shrink-0" />
      )}
      {team}
      {score != null && <span className="ml-0.5 font-mono font-black">{score}</span>}
    </span>
  );
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-lg">
      {!g.awayLogo && <span>{sportEmoji(g.sport ?? fallbackSport)}</span>}
      {side(g.awayTeam, g.awayScore, g.winner === "AWAY", g.awayLogo)}
      <span className="text-slate-600">@</span>
      {side(g.homeTeam, g.homeScore, g.winner === "HOME", g.homeLogo)}
      <span className="text-sm text-slate-500">
        {g.winner ? "Final" : live ? "🔴 LIVE" : `${kickFmt.format(g.startTime)} ET`}
      </span>
    </span>
  );
}

export type TickerRegular = {
  userId: string;
  teamName: string;
  teamColor: string;
  teamEmoji: string;
  nights: number;
  nightWins: number;
  tier: { label: string; emoji: string } | null;
};

/**
 * Bottom-of-screen sports ticker for the TV boards: the featured slate's
 * games scroll continuously, ESPN-bottom-line style, followed by the
 * all-time bar-regulars segment when provided (saves the wall a column).
 * Pure CSS animation (see .ticker-track in globals.css) — the two
 * identical halves make the loop seamless, and score updates from the
 * board's auto-refresh patch text in place without restarting the scroll.
 */
export default function TvTicker({
  label,
  games,
  fallbackSport,
  regulars = [],
}: {
  label: string;
  games: TickerGame[];
  fallbackSport: string;
  regulars?: TickerRegular[];
}) {
  if (games.length === 0 && regulars.length === 0) return null;
  const duration = Math.max(30, (games.length + regulars.length) * 7);

  const chip = (text: string) => (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold uppercase tracking-wide text-slate-300">
      {text}
    </span>
  );

  const half = (hidden: boolean) => (
    <div
      aria-hidden={hidden || undefined}
      className="flex min-w-full shrink-0 items-center gap-12 px-8"
    >
      {games.length > 0 && chip(label)}
      {games.map((g) => (
        <TickerItem key={g.id} g={g} fallbackSport={fallbackSport} />
      ))}
      {regulars.length > 0 && chip("🍻 Bar regulars · all-time")}
      {regulars.map((r, i) => (
        <span key={r.userId} className="flex items-center gap-2 whitespace-nowrap text-lg">
          <span className="font-black text-slate-500">{i + 1}</span>
          <span className="font-bold" style={{ color: r.teamColor }}>
            {r.teamEmoji} {r.teamName}
          </span>
          {r.nightWins > 0 && (
            <span className="font-black text-amber-300">🏅{r.nightWins}</span>
          )}
          <span className="text-sm text-slate-500">
            {r.nights} {r.nights === 1 ? "night" : "nights"}
          </span>
          {r.tier && (
            <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs font-bold text-amber-300">
              {r.tier.emoji} {r.tier.label}
            </span>
          )}
        </span>
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
