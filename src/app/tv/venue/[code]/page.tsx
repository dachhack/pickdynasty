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
import PickGrid from "@/components/PickGrid";
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          🧾 Tonight&rsquo;s board
        </h2>
        {tonight && featured && standings.length > 0 ? (
          <PickGrid
            league={tonight}
            slateId={featured.id}
            standings={standings}
            tv
            maxPlayers={10}
          />
        ) : (
          <div className="card">
            <p className="py-8 text-center text-slate-500">
              {tonight
                ? "Nobody on the board yet — scan the code and be first."
                : "No game running right now."}
            </p>
          </div>
        )}
      </section>

      <p className="text-center text-sm text-slate-600">
        Board refreshes automatically · ⚡ Epic Pick&rsquo;em
      </p>

      <TvTicker
        label={
          featured
            ? (featuredStatus === "live"
                ? "🔴 Live now"
                : featuredStatus === "open"
                  ? "🟢 Picks open"
                  : "✅ Final") + ` · ${featured.name}`
            : ""
        }
        games={featured?.games ?? []}
        fallbackSport={tonight?.sport ?? venue.sport}
        regulars={wall.map((r) => ({
          userId: r.userId,
          teamName: r.teamName,
          teamColor: r.teamColor,
          teamEmoji: r.teamEmoji,
          nights: r.nights,
          nightWins: r.nightWins,
          tier: regularTier(r.nights),
        }))}
      />
    </div>
  );
}
