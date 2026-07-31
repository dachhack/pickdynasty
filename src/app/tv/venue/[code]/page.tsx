import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import {
  computeStandingsFrom,
  loadLeagueForStandings,
  slateStatus,
} from "@/lib/league";
import { computeVenueBoard, pickCurrentNight, regularTier } from "@/lib/venue";
import { formatMeta } from "@/lib/formats";
import AutoRefresh from "@/components/AutoRefresh";
import TvTicker from "@/components/TvTicker";
import VenueMark from "@/components/VenueMark";

export const dynamic = "force-dynamic";

/**
 * The venue's PERMANENT big-screen board (venue tier v2): one URL a bar
 * bookmarks once. Always features the newest night's leaderboard + join QR,
 * with the all-time "bar regulars" wall alongside. No auth, read-only,
 * auto-refreshing.
 */
export default async function VenueTvPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const venue = await db.venue.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!venue) {
    return (
      <div className="py-24 text-center">
        <p className="text-5xl">📺</p>
        <h1 className="mt-4 text-2xl font-black">No venue board here</h1>
        <p className="mt-2 text-slate-400">
          Check the link — venue boards live at /tv/venue/&lt;venue code&gt;.
        </p>
      </div>
    );
  }

  const { regulars, nights } = await computeVenueBoard(venue.id);
  const currentNight = pickCurrentNight(nights);
  const tonight = currentNight
    ? await loadLeagueForStandings(currentNight.leagueId)
    : null;
  const standings = tonight ? computeStandingsFrom(tonight) : [];
  const meta = tonight ? formatMeta(tonight.format) : null;

  // Featured slate on tonight's board: live drama > open for picks > last final.
  const featured = tonight
    ? (["live", "open", "final"] as const)
        .map((s) => [...tonight.slates].reverse().find((sl) => slateStatus(sl) === s))
        .find(Boolean) ?? null
    : null;
  const featuredStatus = featured ? slateStatus(featured) : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const joinUrl = tonight ? `${proto}://${host}/join/${tonight.inviteCode}` : null;
  const qr =
    joinUrl && tonight?.allowGuests
      ? await QRCode.toDataURL(joinUrl, {
          margin: 1,
          width: 320,
          color: { dark: "#0b1120", light: "#ffffff" },
        })
      : null;

  const top = standings.slice(0, 10);
  const wall = regulars.slice(0, 10);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <AutoRefresh seconds={20} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black sm:text-5xl">
            <VenueMark venue={venue} className="h-14 w-14 text-5xl" /> {venue.name}
          </h1>
          <p className="mt-1 text-lg text-slate-400">
            {tonight && currentNight ? (
              <>
                {currentNight.upcoming ? "Up next" : "Tonight"}:{" "}
                {tonight.name}
                {meta && <> · {meta.emoji} {meta.label}</>} · {standings.length}{" "}
                {standings.length === 1 ? "player" : "players"} in
                {tonight.requireLocation && " · 📍 venue-only entry"}
              </>
            ) : (
              <>No game tonight — the regulars wall never sleeps.</>
            )}
          </p>
        </div>
        {qr && tonight && (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt={`QR code to join at ${joinUrl}`}
              className="h-28 w-28 rounded-lg sm:h-32 sm:w-32"
            />
            <div>
              <p className="text-lg font-black">Scan to play</p>
              <p className="text-sm text-slate-400">no account needed</p>
              <p className="mt-1 font-mono text-xl font-bold tracking-widest text-indigo-300">
                {tonight.inviteCode}
              </p>
              <p className="text-xs text-slate-500">epicpickem.com/join</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card !p-0 lg:col-span-3">
          <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            🏆 Tonight&rsquo;s board
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
                  </td>
                  <td className="px-5 py-3 text-right text-2xl font-black">{row.points}</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500">
                    {tonight
                      ? "Nobody on the board yet — scan the code and be first."
                      : "No game running right now."}
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

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="card !p-0">
            <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
              🍻 Bar regulars · all-time
            </h2>
            <table className="mt-2 w-full">
              <tbody>
                {wall.map((r, i) => {
                  const tier = regularTier(r.nights);
                  return (
                    <tr key={r.userId} className="border-t border-slate-800/50">
                      <td className="w-10 px-5 py-2.5 font-black text-slate-500">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-bold" style={{ color: r.teamColor }}>
                          {r.teamEmoji} {r.teamName}
                        </span>
                        {tier && (
                          <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-xs font-bold text-amber-300">
                            {tier.emoji} {tier.label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right text-sm text-slate-400">
                        {r.nightWins > 0 && (
                          <span className="mr-2 font-black text-amber-300">🏅{r.nightWins}</span>
                        )}
                        {r.nights} {r.nights === 1 ? "night" : "nights"}
                      </td>
                    </tr>
                  );
                })}
                {wall.length === 0 && (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-slate-500">
                      Play a night, get on the wall. Come back three times and
                      you&rsquo;re officially a 🍻 Regular.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

        </div>
      </div>

      <p className="text-center text-sm text-slate-600">
        Board refreshes automatically · ⚡ Epic Pick&rsquo;em
      </p>

      {featured && tonight && (
        <TvTicker
          label={
            (featuredStatus === "live"
              ? "🔴 Live now"
              : featuredStatus === "open"
                ? "🟢 Picks open"
                : "✅ Final") + ` · ${featured.name}`
          }
          games={featured.games}
          fallbackSport={tonight.sport}
        />
      )}
    </div>
  );
}
