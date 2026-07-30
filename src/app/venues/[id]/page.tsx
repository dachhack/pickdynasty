import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeVenueBoard, regularTier } from "@/lib/venue";
import { startNextNight, updateVenue } from "@/actions/venues";
import { VENUE_RADIUS_OPTIONS } from "@/lib/geo";
import LocationField from "@/components/LocationField";
import CopyField from "@/components/CopyField";

const nightFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

/** Venue host console: start tonight's game, past nights, regulars, settings. */
export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const venue = await db.venue.findUnique({ where: { id } });
  if (!venue || venue.createdById !== user.id) redirect("/dashboard");

  const { regulars, nights } = await computeVenueBoard(id);
  const currentNight = nights.find((n) => !n.finished) ?? null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";

  return (
    <div className="flex flex-col gap-8">
      {saved && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Venue saved.
        </p>
      )}

      <div>
        <h1 className="text-2xl font-black">
          {venue.emoji} {venue.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Recurring event nights · venue code{" "}
          <span className="font-mono text-slate-200">{venue.code}</span> ·{" "}
          {nights.length} {nights.length === 1 ? "night" : "nights"} so far
        </p>
      </div>

      <section className="card">
        <h2 className="font-bold">🌙 Tonight</h2>
        {currentNight ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3">
            <div>
              <p className="font-semibold">{currentNight.name}</p>
              <p className="text-xs text-slate-500">
                {currentNight.players} {currentNight.players === 1 ? "player" : "players"} in ·{" "}
                {currentNight.live ? "🔴 games on the board" : "🟢 gathering players"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/leagues/${currentNight.leagueId}`} className="btn !text-sm">
                Open night
              </Link>
              <Link
                href={`/leagues/${currentNight.leagueId}/admin/slates`}
                className="btn-ghost !text-sm"
              >
                Build slate
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-400">
            No night running. Starting one creates a fresh game (new join code) with the
            same format and settings as last time — regulars carry over automatically.
          </p>
        )}
        <form action={startNextNight} className="mt-4">
          <input type="hidden" name="venueId" value={id} />
          <button className="btn">🍻 Start {currentNight ? "another" : "tonight's"} game</button>
        </form>
      </section>

      <section className="card">
        <h2 className="font-bold">📺 Venue TV board</h2>
        <p className="mt-1 text-sm text-slate-400">
          Bookmark this ONE link on the bar&rsquo;s TV — it always shows the current
          night&rsquo;s leaderboard, the join QR, and the all-time regulars wall. No need to
          update it night to night.
        </p>
        <div className="mt-3">
          <CopyField value={`${proto}://${host}/tv/venue/${venue.code}`} />
        </div>
      </section>

      <section className="card !p-0">
        <h2 className="px-5 pt-5 font-bold">🏆 Bar regulars</h2>
        <p className="px-5 pt-1 text-sm text-slate-400">
          All-time standings across every night. Night wins first, then total points.
        </p>
        {regulars.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Nobody on the wall yet — the board fills in as people make picks.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2">#</th>
                <th className="px-2 py-2">Player</th>
                <th className="px-2 py-2 text-right">Nights</th>
                <th className="px-2 py-2 text-right">Wins</th>
                <th className="px-2 py-2 text-right">Points</th>
                <th className="px-5 py-2 text-right">Pick %</th>
              </tr>
            </thead>
            <tbody>
              {regulars.map((r, i) => {
                const tier = regularTier(r.nights);
                return (
                  <tr key={r.userId} className="border-t border-slate-800/50">
                    <td className="px-5 py-3 font-black text-slate-500">
                      {i === 0 ? "👑" : i + 1}
                    </td>
                    <td className="px-2 py-3">
                      <span className="font-semibold" style={{ color: r.teamColor }}>
                        {r.teamEmoji} {r.teamName}
                      </span>
                      {tier && (
                        <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-xs font-bold text-amber-300">
                          {tier.emoji} {tier.label}
                        </span>
                      )}
                      {r.isGuest && (
                        <span className="ml-2 text-xs text-slate-500">🎟️ guest</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">{r.nights}</td>
                    <td className="px-2 py-3 text-right font-bold">{r.nightWins}</td>
                    <td className="px-2 py-3 text-right">{r.totalPoints}</td>
                    <td className="px-5 py-3 text-right text-slate-400">
                      {Math.round(r.pct * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card !p-0">
        <h2 className="px-5 pt-5 font-bold">🗓️ Nights ({nights.length})</h2>
        {nights.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No nights yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {nights.map((n) => (
                <tr key={n.leagueId} className="border-t border-slate-800/50">
                  <td className="px-5 py-3">
                    <Link href={`/leagues/${n.leagueId}`} className="font-semibold hover:underline">
                      {n.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {nightFmt.format(n.createdAt)} · {n.players}{" "}
                      {n.players === 1 ? "player" : "players"}
                    </p>
                  </td>
                  <td className="px-2 py-3 text-right text-xs">
                    {n.finished ? (
                      n.winners.length > 0 ? (
                        <span className="text-amber-300">🏅 {n.winners.join(", ")}</span>
                      ) : (
                        <span className="text-slate-500">✅ Final</span>
                      )
                    ) : n.live ? (
                      <span className="text-amber-300">🔴 In progress</span>
                    ) : (
                      <span className="text-emerald-300">🟢 Open</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/tv/${n.inviteCode}`}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      📺 board
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="font-bold">⚙️ Venue settings</h2>
        <p className="mt-1 text-sm text-slate-400">
          The saved location is stamped onto each NEW night when you start it — tonight&rsquo;s
          running game keeps its own settings (edit those in its league admin).
        </p>
        <form action={updateVenue} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="venueId" value={id} />
          <div className="sm:max-w-xs">
            <label className="label" htmlFor="name">Venue name</label>
            <input className="input" id="name" name="name" defaultValue={venue.name} maxLength={60} />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-slate-800 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="requireLocation"
                defaultChecked={venue.requireLocation}
                className="h-4 w-4 accent-indigo-500"
              />
              📍 Venue-only entry on new nights — joiners must share a location near the venue
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <LocationField
                  latName="venueLat"
                  lngName="venueLng"
                  label="📍 Set venue to my current location"
                  showCoords
                />
                {venue.venueLat != null && venue.venueLng != null && (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    saved: {venue.venueLat.toFixed(5)}, {venue.venueLng.toFixed(5)}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="venueRadiusM">Radius</label>
                <select
                  className="input"
                  id="venueRadiusM"
                  name="venueRadiusM"
                  defaultValue={venue.venueRadiusM}
                >
                  {VENUE_RADIUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <button className="btn self-start">Save venue</button>
        </form>
      </section>
    </div>
  );
}
