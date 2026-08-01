import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeVenueBoard, pickCurrentNight, regularTier, todayEt } from "@/lib/venue";
import {
  deleteNight,
  deleteVenue,
  planNight,
  removeVenueLogo,
  runNightNow,
  updateVenue,
} from "@/actions/venues";
import ConfirmButton from "@/components/ConfirmButton";
import LogoUploadForm from "@/components/LogoUploadForm";
import { VENUE_RADIUS_OPTIONS } from "@/lib/geo";
import { SPORTS, sportEmoji, sportLabel } from "@/lib/sports";
import { FORMATS } from "@/lib/formats";
import LocationField from "@/components/LocationField";
import CopyField from "@/components/CopyField";
import VenueMark from "@/components/VenueMark";

const nightFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

/** Venue host console: start tonight's game, past nights, regulars, settings. */
export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    created?: string;
    logoError?: string;
    planError?: string;
    nightDeleted?: string;
  }>;
}) {
  const { id } = await params;
  const { saved, created, logoError, planError, nightDeleted } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const venue = await db.venue.findUnique({ where: { id } });
  if (!venue || venue.createdById !== user.id) redirect("/dashboard");

  const { regulars, nights } = await computeVenueBoard(id);
  const currentNight = pickCurrentNight(nights);
  

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
      {created && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          🎉 Venue created — this console is home base. Create your first event below,
          and bookmark the TV link on the bar&rsquo;s screen.
        </p>
      )}
      {nightDeleted && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Event deleted — the regulars board recomputed without it.
        </p>
      )}

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <VenueMark venue={venue} className="h-9 w-9 text-2xl" /> {venue.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Recurring event nights · venue code{" "}
          <span className="font-mono text-slate-200">{venue.code}</span> ·{" "}
          {nights.length} {nights.length === 1 ? "night" : "nights"} so far
        </p>
      </div>

      <section className="card !p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="font-bold">🗓️ Events</h2>
          <form action={planNight} className="flex items-end gap-2">
            <input type="hidden" name="venueId" value={id} />
            <input
              className="input !w-auto !py-1.5 !text-sm"
              type="date"
              name="date"
              defaultValue={todayEt()}
              required
              aria-label="Event date"
            />
            <button className="btn !text-sm">➕ New event</button>
          </form>
        </div>
        <p className="px-5 pt-1 text-sm text-slate-400">
          Each event is a fresh game night (new join code) cloned from the last one —
          regulars carry over. Creating one opens its slate builder; the TV board features
          the current event automatically (📺 marks it).
        </p>
        {planError && (
          <p className="mx-5 mt-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            Pick a date for the event first.
          </p>
        )}
        {nights.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No events yet — pick a date and hit ➕ New event.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-2 py-2">First game</th>
                  <th className="px-2 py-2 text-right">Slate</th>
                  <th className="px-2 py-2">Sports</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {nights.map((n) => (
                  <tr key={n.leagueId} className="border-b border-slate-800/50 last:border-0">
                    <td className="whitespace-nowrap px-5 py-3">
                      <Link href={`/leagues/${n.leagueId}`} className="font-semibold hover:underline">
                        {nightFmt.format(n.eventAt)}
                      </Link>
                      {currentNight?.leagueId === n.leagueId && (
                        <span className="ml-2" title="On the TV board now">📺</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-400">
                      {n.firstGameAt ? timeFmt.format(n.firstGameAt) : "—"}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-400">
                      {n.items > 0 ? `${n.items} ${n.items === 1 ? "item" : "items"}` : "empty"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-lg leading-none">
                      {n.sports.length > 0
                        ? n.sports.map((s) => (
                            <span key={s} title={sportLabel(s)}>{sportEmoji(s)}</span>
                          ))
                        : <span className="text-sm text-slate-600">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs">
                      {n.finished ? (
                        n.winners.length > 0 ? (
                          <span className="text-amber-300" title={n.winners.join(", ")}>
                            🏅 {n.winners.join(", ").slice(0, 24)}{n.winners.join(", ").length > 24 ? "…" : ""}
                          </span>
                        ) : (
                          <span className="text-slate-500">✅ Final</span>
                        )
                      ) : n.live ? (
                        <span className="text-amber-300">🔴 In progress</span>
                      ) : n.upcoming ? (
                        <span className="text-indigo-300">🗓️ Planned</span>
                      ) : (
                        <span className="text-emerald-300">🟢 Open</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/leagues/${n.leagueId}/admin/slates`}
                          className="btn-ghost !px-2.5 !py-1 !text-xs"
                        >
                          ✏️ Edit
                        </Link>
                        {!n.finished && (
                          <form action={runNightNow}>
                            <input type="hidden" name="venueId" value={id} />
                            <input type="hidden" name="leagueId" value={n.leagueId} />
                            <ConfirmButton
                              className="btn-ghost !px-2.5 !py-1 !text-xs"
                              message="Run this event now? The TV board switches to it immediately."
                            >
                              ▶️ Run
                            </ConfirmButton>
                          </form>
                        )}
                        <form action={deleteNight}>
                          <input type="hidden" name="venueId" value={id} />
                          <input type="hidden" name="leagueId" value={n.leagueId} />
                          <ConfirmButton
                            message="Delete this event? Its games, picks, and results are gone for good and the regulars board recomputes without it."
                          >
                            🗑️
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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


      <section className="card">
        <h2 className="font-bold">⚙️ Venue settings</h2>
        <p className="mt-1 text-sm text-slate-400">
          The saved location is stamped onto each NEW night when you start it — tonight&rsquo;s
          running game keeps its own settings (edit those in its league admin).
        </p>
        <form action={updateVenue} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="venueId" value={id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Venue name</label>
              <input className="input" id="name" name="name" defaultValue={venue.name} maxLength={60} />
            </div>
            <div>
              <label className="label" htmlFor="emoji">Icon (emoji)</label>
              <input className="input" id="emoji" name="emoji" defaultValue={venue.emoji} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="sport">Usual sport (new nights)</label>
              <select className="input" id="sport" name="sport" defaultValue={venue.sport}>
                {SPORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="format">Format (new nights)</label>
              <select className="input" id="format" name="format" defaultValue={venue.format}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>{f.emoji} {f.label}</option>
                ))}
              </select>
            </div>
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

      <section className="card">
        <h2 className="font-bold">🖼️ Venue logo</h2>
        <p className="mt-1 text-sm text-slate-400">
          Optional — replaces the {venue.emoji} icon with your own mark on the TV board,
          the console, and your dashboard. Any image up to 8 MB works — it&rsquo;s
          center-cropped to a square and resized automatically.
        </p>
        {logoError && (
          <p className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {logoError === "type"
              ? "Couldn't read that as an image — try a PNG, JPEG, or WebP."
              : logoError === "size"
                ? "That file is over 8 MB — shrink it and try again."
                : "Pick an image file first."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <VenueMark venue={venue} className="h-16 w-16 text-5xl" />
          <LogoUploadForm venueId={id} />
          {venue.logoUpdatedAt && (
            <form action={removeVenueLogo}>
              <input type="hidden" name="venueId" value={id} />
              <button className="btn-danger">Remove — back to {venue.emoji}</button>
            </form>
          )}
        </div>
      </section>

      <section className="card !border-red-950">
        <h2 className="font-bold text-red-400">🗑️ Delete venue</h2>
        <p className="mt-1 text-sm text-slate-400">
          Removes the venue, its regulars board, TV link, and logo. Past nights are NOT
          deleted — they stay in everyone&rsquo;s league list as ordinary leagues with all
          picks and results intact. This can&rsquo;t be undone.
        </p>
        <form action={deleteVenue} className="mt-3">
          <input type="hidden" name="venueId" value={id} />
          <ConfirmButton
            message={`Delete ${venue.name}? The regulars board and permanent TV link go away for good. Past nights stay as ordinary leagues.`}
          >
            Delete this venue
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}
