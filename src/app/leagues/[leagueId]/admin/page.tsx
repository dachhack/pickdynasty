import { redirect } from "next/navigation";
import { getLeagueView } from "@/lib/leagueView";
import { db } from "@/lib/db";
import { isAdminRole } from "@/lib/league";
import { sportByKey } from "@/lib/sports";
import { TeamBadge } from "@/components/TeamBadge";
import { regenerateInviteCodeAction, updateLeagueSettingsAction } from "@/app/actions/league";
import {
  createGameAction,
  createInviteAction,
  createRoundAction,
  deleteGameAction,
  deleteRoundAction,
  recordResultAction,
  removeMemberAction,
  revokeInviteAction,
  setMemberRoleAction,
} from "@/app/actions/admin";
import { gameIsFinal, gameIsLocked } from "@/lib/scoring";

export const metadata = { title: "Admin" };

function fmt(d: Date) {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AdminPage({ params }: { params: { leagueId: string } }) {
  const { membership, league } = await getLeagueView(params.leagueId);
  if (!membership || !league) return null;
  if (!isAdminRole(membership.role)) redirect(`/leagues/${params.leagueId}`);

  const [members, rounds, invites] = await Promise.all([
    db.membership.findMany({
      where: { leagueId: league.id, status: "ACTIVE" },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
    db.round.findMany({
      where: { leagueId: league.id },
      include: { games: { orderBy: { locksAt: "asc" } } },
      orderBy: { order: "asc" },
    }),
    db.invitation.findMany({
      where: { leagueId: league.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sport = sportByKey(league.sport);
  const now = new Date();

  return (
    <div className="space-y-8">
      {/* ---------- Invites ---------- */}
      <section className="card" id="invites">
        <h2 className="text-lg font-bold text-slate-900">📨 Invite players</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">League invite code</h3>
            <p className="mt-1 text-xs text-slate-500">Share this code — anyone with it can join from their dashboard, or via the link below.</p>
            <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-center font-mono text-xl font-bold tracking-[0.3em] text-slate-900">
              {league.inviteCode}
            </div>
            <p className="mt-2 break-all text-xs text-slate-500">Join link: /join/{league.inviteCode}</p>
            <form action={regenerateInviteCodeAction.bind(null, league.id)} className="mt-2">
              <button className="btn-secondary w-full" type="submit">♻️ Regenerate code</button>
            </form>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Personal invites</h3>
            <p className="mt-1 text-xs text-slate-500">Create a one-off code to send to a specific friend.</p>
            <form action={createInviteAction.bind(null, league.id)} className="mt-2 flex gap-2">
              <input className="input" name="email" type="email" placeholder="friend@example.com (optional)" />
              <button className="btn-primary shrink-0" type="submit">Create</button>
            </form>
            <ul className="mt-3 space-y-1.5">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono font-bold">{inv.code}</span>
                  <span className="truncate text-xs text-slate-500">{inv.email ?? "anyone"}</span>
                  <form action={revokeInviteAction.bind(null, league.id, inv.id)}>
                    <button className="text-xs text-red-600 hover:underline" type="submit">Revoke</button>
                  </form>
                </li>
              ))}
              {invites.length === 0 ? <li className="text-xs text-slate-400">No pending personal invites.</li> : null}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Members ---------- */}
      <section className="card" id="members">
        <h2 className="text-lg font-bold text-slate-900">👥 Members ({members.length})</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <TeamBadge emoji={m.teamEmoji} color={m.teamColor} name={m.teamName ?? m.user.name} sub={`${m.user.name} · ${m.user.email}`} size="sm" />
              <div className="flex items-center gap-2">
                <span className="badge bg-slate-100 text-slate-600">
                  {m.role === "COMMISSIONER" ? "👑 Commissioner" : m.role === "ADMIN" ? "Admin" : "Player"}
                </span>
                {m.role !== "COMMISSIONER" && m.id !== membership.id ? (
                  <>
                    <form action={setMemberRoleAction.bind(null, league.id, m.id, m.role === "ADMIN" ? "PLAYER" : "ADMIN")}>
                      <button className="btn-secondary px-2.5 py-1 text-xs" type="submit">
                        {m.role === "ADMIN" ? "Demote to player" : "Make admin"}
                      </button>
                    </form>
                    <form action={removeMemberAction.bind(null, league.id, m.id)}>
                      <button className="btn-danger px-2.5 py-1 text-xs" type="submit">Remove</button>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Schedule & results ---------- */}
      <section className="card" id="schedule">
        <h2 className="text-lg font-bold text-slate-900">📅 Schedule &amp; results</h2>
        <form action={createRoundAction.bind(null, league.id)} className="mt-3 flex gap-2">
          <input className="input" name="name" placeholder={`e.g. ${sport.roundLabel} ${rounds.length + 1}`} required />
          <button className="btn-primary shrink-0" type="submit">+ Add {sport.roundLabel.toLowerCase()}</button>
        </form>

        <div className="mt-4 space-y-6">
          {rounds.map((round) => (
            <div key={round.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">{round.name}</h3>
                {round.games.length === 0 ? (
                  <form action={deleteRoundAction.bind(null, league.id, round.id)}>
                    <button className="text-xs text-red-600 hover:underline" type="submit">Delete</button>
                  </form>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                {round.games.map((game) => {
                  const locked = gameIsLocked(game, now);
                  const final = gameIsFinal(game);
                  return (
                    <div key={game.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">
                          {game.awayTeam} @ {game.homeTeam}
                          {game.spread !== null ? <span className="ml-1 text-xs text-slate-500">({game.spread > 0 ? "+" : ""}{game.spread})</span> : null}
                          {game.points > 1 ? <span className="ml-1 text-xs text-slate-500">· {game.points} pts</span> : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {final ? <span className="badge bg-green-100 text-green-700">Final</span> : locked ? "🔒 Locked" : `Locks ${fmt(game.locksAt)}`}
                          {!locked ? (
                            <form action={deleteGameAction.bind(null, league.id, game.id)}>
                              <button className="text-red-600 hover:underline" type="submit">Delete</button>
                            </form>
                          ) : null}
                        </div>
                      </div>

                      <form action={recordResultAction.bind(null, league.id, game.id)} className="mt-2 flex flex-wrap items-end gap-2">
                        <div>
                          <label className="label text-xs">{game.awayTeam} score</label>
                          <input className="input w-24" name="awayScore" inputMode="numeric" defaultValue={game.awayScore ?? ""} />
                        </div>
                        <div>
                          <label className="label text-xs">{game.homeTeam} score</label>
                          <input className="input w-24" name="homeScore" inputMode="numeric" defaultValue={game.homeScore ?? ""} />
                        </div>
                        <div>
                          <label className="label text-xs">Result</label>
                          <select className="input" name="winner" defaultValue={game.winner ?? "PENDING"}>
                            <option value="PENDING">In progress / pending</option>
                            <option value="AWAY">{game.awayTeam} won</option>
                            <option value="HOME">{game.homeTeam} won</option>
                            <option value="TIE">Tie / push</option>
                            <option value="VOID">Void (no contest)</option>
                          </select>
                        </div>
                        <button className="btn-secondary" type="submit">Save result</button>
                      </form>
                    </div>
                  );
                })}
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand-600">+ Add game to {round.name}</summary>
                <form action={createGameAction.bind(null, league.id, round.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label text-xs">Away team / player</label>
                    <input className="input" name="awayTeam" placeholder="Away team" required />
                  </div>
                  <div>
                    <label className="label text-xs">Home team / player</label>
                    <input className="input" name="homeTeam" placeholder="Home team" required />
                  </div>
                  <div>
                    <label className="label text-xs">Picks lock at (local time)</label>
                    <input className="input" name="locksAt" type="datetime-local" required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label text-xs">Home spread</label>
                      <input className="input" name="spread" inputMode="decimal" placeholder="-3.5" />
                    </div>
                    <div>
                      <label className="label text-xs">Points</label>
                      <input className="input" name="points" inputMode="numeric" defaultValue="1" />
                    </div>
                  </div>
                  <button className="btn-primary sm:col-span-2" type="submit">Add game</button>
                </form>
              </details>
            </div>
          ))}
          {rounds.length === 0 ? (
            <p className="text-sm text-slate-500">
              No {sport.roundLabel.toLowerCase()}s yet — add one above, then add games to it.
            </p>
          ) : null}
        </div>
      </section>

      {/* ---------- Settings ---------- */}
      <section className="card" id="settings">
        <h2 className="text-lg font-bold text-slate-900">⚙️ League settings</h2>
        <form action={updateLeagueSettingsAction.bind(null, league.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">League name</label>
            <input className="input" name="name" defaultValue={league.name} required />
          </div>
          <div>
            <label className="label">Season</label>
            <input className="input" name="season" defaultValue={league.season} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" name="description" rows={2} defaultValue={league.description ?? ""} />
          </div>
          <div>
            <label className="label">Pick style</label>
            <select className="input" name="pickType" defaultValue={league.pickType}>
              <option value="STRAIGHT_UP">Straight up</option>
              <option value="AGAINST_SPREAD">Against the spread</option>
            </select>
          </div>
          <div>
            <label className="label">Buy-in ($, tracked only)</label>
            <input className="input" name="buyIn" inputMode="decimal" defaultValue={(league.buyInCents / 100).toString()} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="blindPicks" defaultChecked={league.blindPicks} className="h-4 w-4 rounded border-slate-300" />
            Blind picks — hide picks until each game locks
          </label>
          <button className="btn-primary sm:col-span-2" type="submit">Save settings</button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Sport ({sport.emoji} {sport.label}) can&rsquo;t be changed after creation — start a new league for a new sport or season.
        </p>
      </section>
    </div>
  );
}
