import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import {
  computeStandingsFrom,
  loadLeagueForStandings,
  slateStatus,
} from "@/lib/league";
import { formatMeta } from "@/lib/formats";
import { sportEmoji } from "@/lib/sports";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const kickFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

/**
 * Public big-screen leaderboard for event nights: no auth, read-only,
 * auto-refreshing. Only exists while the league has guest entry (event
 * night mode) switched on.
 */
export default async function TvPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const found = await db.league.findUnique({
    where: { inviteCode: code.toUpperCase() },
  });

  if (!found || !found.allowGuests) {
    return (
      <div className="py-24 text-center">
        <p className="text-5xl">📺</p>
        <h1 className="mt-4 text-2xl font-black">No event night here</h1>
        <p className="mt-2 text-slate-400">
          This board isn&rsquo;t live — the commissioner can switch on event night mode
          in league admin.
        </p>
      </div>
    );
  }

  const league = await loadLeagueForStandings(found.id);
  const standings = computeStandingsFrom(league);
  const meta = formatMeta(league.format);

  // Featured slate: live drama first, then one still open for picks,
  // then the most recent final.
  const byStatus = (s: string) =>
    [...league.slates].reverse().find((sl) => slateStatus(sl) === s);
  const featured = byStatus("live") ?? byStatus("open") ?? byStatus("final");
  const featuredStatus = featured ? slateStatus(featured) : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const joinUrl = `${proto}://${host}/join/${league.inviteCode}`;
  const qr = await QRCode.toDataURL(joinUrl, {
    margin: 1,
    width: 320,
    color: { dark: "#0b1120", light: "#ffffff" },
  });

  const top = standings.slice(0, 12);

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh seconds={20} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black sm:text-5xl">
            {sportEmoji(league.sport)} {league.name}
          </h1>
          <p className="mt-1 text-lg text-slate-400">
            {meta.emoji} {meta.label} · {standings.length}{" "}
            {standings.length === 1 ? "player" : "players"} in
            {league.requireLocation && " · 📍 venue-only entry"}
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code to join at ${joinUrl}`} className="h-28 w-28 rounded-lg sm:h-32 sm:w-32" />
          <div>
            <p className="text-lg font-black">Scan to play</p>
            <p className="text-sm text-slate-400">no account needed</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-widest text-indigo-300">
              {league.inviteCode}
            </p>
            <p className="text-xs text-slate-500">epicpickem.com/join</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card !p-0 lg:col-span-3">
          <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            🏆 Leaderboard
          </h2>
          <table className="mt-2 w-full">
            <tbody>
              {top.map((row, i) => (
                <tr key={row.membershipId} className="border-t border-slate-800/50 text-lg">
                  <td className="w-12 px-5 py-3 text-2xl font-black text-slate-500">
                    {i === 0 ? "👑" : i + 1}
                  </td>
                  <td className="px-2 py-3">
                    <span className="font-bold" style={{ color: row.teamColor }}>
                      {row.teamEmoji} {row.teamName}
                    </span>
                    {row.streak >= 3 && (
                      <span className="ml-2 rounded-full bg-orange-950 px-2 py-0.5 text-sm font-bold text-orange-300">
                        🔥{row.streak}
                      </span>
                    )}
                    {league.format === "survivor" && !row.alive && (
                      <span className="ml-2 text-sm text-red-400">💀 out</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-2xl font-black">{row.points}</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500">
                    Nobody on the board yet — scan the code and be first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {standings.length > top.length && (
            <p className="border-t border-slate-800 px-5 py-2 text-sm text-slate-500">
              + {standings.length - top.length} more chasing the podium
            </p>
          )}
        </section>

        <section className="card !p-0 lg:col-span-2">
          <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {featuredStatus === "live"
              ? "🔴 Live now"
              : featuredStatus === "open"
                ? "🟢 Picks open"
                : "✅ Final"}
            {featured && ` · ${featured.name}`}
          </h2>
          {featured ? (
            <ul className="mt-2">
              {featured.games.map((g) => {
                const live = g.homeScore != null && !g.winner;
                return (
                  <li key={g.id} className="border-t border-slate-800/50 px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={g.winner === "AWAY" ? "font-bold" : ""}>{g.awayTeam}</span>
                      <span className="font-mono text-xl font-black">
                        {g.awayScore ?? "–"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={g.winner === "HOME" ? "font-bold" : ""}>@ {g.homeTeam}</span>
                      <span className="font-mono text-xl font-black">
                        {g.homeScore ?? "–"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {g.winner
                        ? "Final"
                        : live
                          ? "🔴 In progress"
                          : `Starts ${kickFmt.format(g.startTime)} ET`}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-slate-500">
              No games on the board yet.
            </p>
          )}
        </section>
      </div>

      <p className="text-center text-sm text-slate-600">
        Board refreshes automatically · ⚡ Epic Pick&rsquo;em
      </p>
    </div>
  );
}
