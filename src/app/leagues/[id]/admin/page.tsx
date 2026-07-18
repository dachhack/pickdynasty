import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireCommissioner } from "@/lib/league";
import {
  regenerateInviteCode,
  removeMember,
  toggleRole,
  updateLeagueSettings,
} from "@/actions/admin";
import CopyField from "@/components/CopyField";

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const me = await requireCommissioner(id);
  const { league } = me;

  const members = await db.membership.findMany({
    where: { leagueId: id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

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
                    {m.user.name} · {m.user.email}
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
