import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  regenerateInviteCode,
  removeMember,
  toggleRole,
  updateEventSettings,
  updateLeagueSettings,
} from "@/actions/admin";
import { VENUE_RADIUS_OPTIONS } from "@/lib/geo";
import LocationField from "@/components/LocationField";
import { linkFantasyLeague, unlinkFantasyLeague } from "@/actions/fantasy";
import { sendInviteEmails } from "@/actions/emails";
import { emailEnabled } from "@/lib/email";
import { FORMATS } from "@/lib/formats";
import CopyField from "@/components/CopyField";

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    eventError?: string;
    fantasyError?: string;
    fantasyLinked?: string;
    invitesSent?: string;
    invitesFailed?: string;
    inviteError?: string;
  }>;
}) {
  const { id } = await params;
  const { saved, eventError, fantasyError, fantasyLinked, invitesSent, invitesFailed, inviteError } =
    await searchParams;
  const me = await requireCommissioner(id);
  const { league } = me;

  const [members, fantasyLink] = await Promise.all([
    db.membership.findMany({
      where: { leagueId: id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.fantasyLink.findUnique({ where: { leagueId: id } }),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const inviteUrl = `${proto}://${host}/join/${league.inviteCode}`;

  return (
    <div className="flex flex-col gap-8">
      {saved && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Settings saved.
        </p>
      )}

      <section className="card">
        <h2 className="font-bold">📨 Invite players</h2>
        <p className="mt-1 text-sm text-slate-400">
          Share this link (or the code <span className="font-mono text-slate-200">{league.inviteCode}</span>) —
          anyone with it can join.
        </p>
        <div className="mt-3">
          <CopyField value={inviteUrl} />
        </div>
        <form action={regenerateInviteCode} className="mt-3">
          <input type="hidden" name="leagueId" value={id} />
          <button className="btn-ghost !text-xs">♻️ Regenerate code (invalidates the old link)</button>
        </form>

        {invitesSent != null && (
          <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
            📨 Sent {invitesSent} invite{Number(invitesSent) === 1 ? "" : "s"}
            {Number(invitesFailed) > 0 && ` (${invitesFailed} failed — check the addresses)`}.
          </p>
        )}
        {inviteError && (
          <p className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {inviteError}
          </p>
        )}
        {emailEnabled() ? (
          <form action={sendInviteEmails} className="mt-4 border-t border-slate-800 pt-4">
            <input type="hidden" name="leagueId" value={id} />
            <label className="label" htmlFor="emails">Or email invites directly</label>
            <textarea
              className="input min-h-[4.5rem]"
              id="emails"
              name="emails"
              placeholder={"friend1@example.com, friend2@example.com…"}
            />
            <button className="btn mt-2 !text-sm">📨 Send invites</button>
          </form>
        ) : (
          <p className="mt-3 text-xs text-slate-600">
            💡 Email invites light up when email sending is configured (SMTP_USER/SMTP_PASS or RESEND_API_KEY).
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="font-bold">🍻 Event night mode</h2>
        <p className="mt-1 text-sm text-slate-400">
          Running this at a bar or watch party? Guest quick-join lets walk-ins scan a QR
          code and play with just a display name — no account — and unlocks a big-screen
          leaderboard for the TV.
        </p>
        {eventError === "no-venue" && (
          <p className="mt-3 rounded-lg border border-amber-900 bg-amber-950/50 px-4 py-2 text-sm text-amber-300">
            Location check needs a venue point — tap &ldquo;Set venue to my current
            location&rdquo; (from your phone, standing at the venue) and save again.
          </p>
        )}
        <form action={updateEventSettings} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="leagueId" value={id} />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="allowGuests"
              defaultChecked={league.allowGuests}
              className="h-4 w-4 accent-indigo-500"
            />
            Guest quick-join — anyone with the QR/link plays with just a display name
          </label>
          <div className="flex flex-col gap-3 rounded-lg border border-slate-800 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="requireLocation"
                defaultChecked={league.requireLocation}
                className="h-4 w-4 accent-indigo-500"
              />
              📍 Venue-only entry — joiners must share a location near the venue
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <LocationField
                  latName="venueLat"
                  lngName="venueLng"
                  label="📍 Set venue to my current location"
                  showCoords
                />
                {league.venueLat != null && league.venueLng != null && (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    saved: {league.venueLat.toFixed(5)}, {league.venueLng.toFixed(5)}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="venueRadiusM">Radius</label>
                <select
                  className="input"
                  id="venueRadiusM"
                  name="venueRadiusM"
                  defaultValue={league.venueRadiusM}
                >
                  {VENUE_RADIUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              A deterrent for couch players, not a guarantee — browser location can be
              spoofed. Members who already joined aren&rsquo;t re-checked.
            </p>
          </div>
          <button className="btn self-start">Save event settings</button>
        </form>
        {league.allowGuests && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <p className="text-sm font-semibold">📺 TV leaderboard</p>
            <p className="mt-1 text-xs text-slate-500">
              Open this on the bar&rsquo;s TV — public, read-only, auto-refreshing, with the
              join QR on screen.
            </p>
            <div className="mt-2">
              <CopyField value={`${proto}://${host}/tv/${league.inviteCode}`} />
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-bold">🗓️ Slates &amp; games</h2>
        <p className="mt-1 text-sm text-slate-400">
          Build the rounds of games players pick against and enter results.
        </p>
        <Link href={`/leagues/${id}/admin/slates`} className="btn mt-3 inline-flex">
          Manage slates &amp; results
        </Link>
      </section>

      <section className="card">
        <h2 className="font-bold">🏆 Fantasy league link</h2>
        <p className="mt-1 text-sm text-slate-400">
          Connect a Sleeper or ESPN fantasy league to run pick&rsquo;em on its weekly head-to-head
          matchups — members pick which fantasy teams win.
        </p>
        {fantasyLinked && (
          <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
            Fantasy league connected.
          </p>
        )}
        {fantasyError && (
          <p className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {fantasyError}
          </p>
        )}
        {fantasyLink ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3">
            <div>
              <p className="font-semibold">
                {fantasyLink.name}
                <span className="ml-2 rounded-full bg-indigo-950 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                  {fantasyLink.provider === "sleeper" ? "Sleeper" : "ESPN Fantasy"}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                League {fantasyLink.providerLeagueId} · {fantasyLink.season} season · import
                matchups from any slate on the slates page
              </p>
            </div>
            <form action={unlinkFantasyLeague}>
              <input type="hidden" name="leagueId" value={id} />
              <button className="btn-danger">Unlink</button>
            </form>
          </div>
        ) : (
          <form action={linkFantasyLeague} className="mt-4 grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="leagueId" value={id} />
            <div>
              <label className="label" htmlFor="provider">Platform</label>
              <select className="input" id="provider" name="provider" defaultValue="sleeper">
                <option value="sleeper">Sleeper</option>
                <option value="espn">ESPN Fantasy</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="providerLeagueId">Fantasy league ID</label>
              <input className="input" id="providerLeagueId" name="providerLeagueId" required placeholder="e.g. 289646328504385536" />
            </div>
            <div>
              <label className="label" htmlFor="fantasySeason">Season</label>
              <input className="input" id="fantasySeason" name="season" required defaultValue={league.season} placeholder="2026" />
            </div>
            <details className="text-sm text-slate-400 sm:col-span-3">
              <summary className="cursor-pointer">Private ESPN league? (espn_s2 / SWID cookies)</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="espnS2">espn_s2 cookie</label>
                  <input className="input" id="espnS2" name="espnS2" placeholder="only needed for private ESPN leagues" />
                </div>
                <div>
                  <label className="label" htmlFor="swid">SWID cookie</label>
                  <input className="input" id="swid" name="swid" placeholder="{XXXXXXXX-XXXX-...}" />
                </div>
              </div>
            </details>
            <button className="btn sm:col-span-3 sm:justify-self-start">Connect fantasy league</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="font-bold">⚙️ League settings</h2>
        <form action={updateLeagueSettings} className="mt-4 grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="leagueId" value={id} />
          <div>
            <label className="label" htmlFor="name">League name</label>
            <input className="input" id="name" name="name" defaultValue={league.name} />
          </div>
          <div>
            <label className="label" htmlFor="season">Season</label>
            <input className="input" id="season" name="season" defaultValue={league.season} />
          </div>
          <div>
            <label className="label" htmlFor="buyIn">Buy-in ($)</label>
            <input className="input" id="buyIn" name="buyIn" type="number" min="0" step="1" defaultValue={league.buyIn} />
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="format">Format</label>
            <select className="input sm:max-w-xs" id="format" name="format" defaultValue={league.format}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.emoji} {f.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-amber-400">
              ⚠️ Changing format mid-season rescores all existing picks under the new rules.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-3">
            <input type="checkbox" name="blindPicks" defaultChecked={league.blindPicks} className="h-4 w-4 accent-indigo-500" />
            Blind picks — hide picks until each game locks
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-3">
            <input type="checkbox" name="adminCanSeePicks" defaultChecked={league.adminCanSeePicks} className="h-4 w-4 accent-indigo-500" />
            Commissioners can view hidden picks (for dispute resolution)
          </label>
          <button className="btn sm:col-span-3 sm:justify-self-start">Save settings</button>
        </form>
      </section>

      <section className="card !p-0">
        <h2 className="px-5 pt-5 font-bold">👥 Members ({members.length})</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-800/50">
                <td className="px-5 py-3">
                  <span className="font-semibold" style={{ color: m.teamColor }}>
                    {m.teamEmoji} {m.teamName}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {m.user.name} · {m.user.isGuest ? "🎟️ guest" : m.user.email}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  {m.role === "COMMISSIONER" ? (
                    <span className="rounded-full bg-indigo-950 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                      Commissioner
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Player</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {m.id !== me.id && (
                    <span className="flex justify-end gap-2">
                      <form action={toggleRole}>
                        <input type="hidden" name="leagueId" value={id} />
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="btn-ghost !px-2 !py-1 !text-xs">
                          {m.role === "COMMISSIONER" ? "Demote" : "Make admin"}
                        </button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="leagueId" value={id} />
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="btn-danger">Remove</button>
                      </form>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
