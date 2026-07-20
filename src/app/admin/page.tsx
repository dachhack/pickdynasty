import Link from "next/link";
import { db } from "@/lib/db";
import { isEnvSuperAdmin, requireSuperAdmin, userIsSuperAdmin } from "@/lib/superadmin";
import { formatMeta } from "@/lib/formats";
import { sportEmoji } from "@/lib/sports";
import {
  adminDeleteLeague,
  adminDeleteUser,
  adminGlobalSync,
  toggleSuperAdmin,
} from "@/actions/superadmin";
import { createPickPack, deletePickPack, togglePackPublished } from "@/actions/packs";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; checked?: string; error?: string }>;
}) {
  const me = await requireSuperAdmin();
  const { synced, checked, error } = await searchParams;

  const packs = await db.pickPack.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { games: true } } },
  });
  const [users, leagues, counts] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true, leagues: true } } },
    }),
    db.league.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: true,
        _count: { select: { memberships: true, slates: true } },
      },
    }),
    Promise.all([db.game.count(), db.pick.count(), db.message.count()]),
  ]);
  const [gameCount, pickCount, messageCount] = counts;

  const stats = [
    { label: "Users", value: users.length },
    { label: "Leagues", value: leagues.length },
    { label: "Games", value: gameCount },
    { label: "Picks", value: pickCount },
    { label: "Messages", value: messageCount },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">🛡️ HQ</h1>
          <p className="text-sm text-slate-400">
            Site-wide operations. Signed in as {me.email}.
          </p>
        </div>
        <form action={adminGlobalSync}>
          <button className="btn">📡 Sync all league results</button>
        </form>
      </div>

      {synced != null && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Synced {synced} games across {checked} leagues with pending results.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card !py-4 text-center">
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="font-bold">🎁 Pick packs</h2>
        <p className="mt-1 text-sm text-slate-400">
          Curated game bundles every commissioner sees in the slate builder. Rule-based packs
          (city teams, women&rsquo;s sports) maintain themselves; these are your hand-picked ones.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {packs.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <span className="font-semibold">{p.emoji} {p.title}</span>
              <span className="text-xs text-slate-500">{p._count.games} games</span>
              {p.published ? (
                <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Published</span>
              ) : (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Draft</span>
              )}
              <span className="ml-auto flex gap-2">
                <Link href={`/admin/packs/${p.id}`} className="btn-ghost !px-2 !py-1 !text-xs">Edit games</Link>
                <form action={togglePackPublished} className="inline">
                  <input type="hidden" name="packId" value={p.id} />
                  <button className="btn-ghost !px-2 !py-1 !text-xs">{p.published ? "Unpublish" : "Publish"}</button>
                </form>
                <form action={deletePickPack} className="inline">
                  <input type="hidden" name="packId" value={p.id} />
                  <ConfirmButton message={`Delete pack "${p.title}"?`}>✕</ConfirmButton>
                </form>
              </span>
            </div>
          ))}
          {packs.length === 0 && <p className="text-sm text-slate-500">No curated packs yet.</p>}
        </div>
        <form action={createPickPack} className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-4">
          <div>
            <label className="label">Emoji</label>
            <input className="input text-center" name="emoji" defaultValue="🎁" maxLength={4} />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Title</label>
            <input className="input" name="title" required placeholder="Top Games of September" />
          </div>
          <div className="sm:col-span-4">
            <label className="label">Description</label>
            <input className="input" name="description" placeholder="The month's cant-miss matchups across every sport" />
          </div>
          <button className="btn sm:col-span-4 sm:justify-self-start">Create pack → pick the games</button>
        </form>
      </section>

      <section className="card overflow-x-auto !p-0">
        <h2 className="px-5 pt-5 font-bold">Leagues</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2">League</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2 text-right">Members</th>
              <th className="px-3 py-2 text-right">Slates</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-5 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((l) => (
              <tr key={l.id} className="border-b border-slate-800/50 last:border-0">
                <td className="px-5 py-3">
                  <Link href={`/leagues/${l.id}`} className="font-semibold text-indigo-400 hover:underline">
                    {sportEmoji(l.sport)} {l.name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">by {l.createdBy.name}</span>
                </td>
                <td className="px-3 py-3 text-slate-400">{formatMeta(l.format).emoji} {formatMeta(l.format).label}</td>
                <td className="px-3 py-3 text-right">{l._count.memberships}</td>
                <td className="px-3 py-3 text-right">{l._count.slates}</td>
                <td className="px-3 py-3 text-slate-500">{dateFmt.format(l.createdAt)}</td>
                <td className="px-5 py-3 text-right">
                  <form action={adminDeleteLeague} className="inline">
                    <input type="hidden" name="leagueId" value={l.id} />
                    <ConfirmButton message={`Delete league "${l.name}" and ALL its picks, money entries, and chat? This cannot be undone.`}>
                      Delete
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {leagues.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500">No leagues yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto !p-0">
        <h2 className="px-5 pt-5 font-bold">Users</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2">User</th>
              <th className="px-3 py-2 text-right">Leagues</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-5 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const envAdmin = isEnvSuperAdmin(u.email);
              const admin = userIsSuperAdmin(u);
              const self = u.id === me.id;
              return (
                <tr key={u.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-5 py-3">
                    <span className="font-semibold">{u.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {u.isGuest ? "🎟️ guest" : u.email}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">{u._count.memberships}</td>
                  <td className="px-3 py-3 text-slate-500">{dateFmt.format(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    {admin ? (
                      <span className="rounded-full bg-indigo-950 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                        🛡️ Super admin{envAdmin && " (env)"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Member</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!self && !envAdmin && (
                      <span className="inline-flex gap-2">
                        <form action={toggleSuperAdmin} className="inline">
                          <input type="hidden" name="userId" value={u.id} />
                          <button className="btn-ghost !px-2 !py-1 !text-xs">
                            {u.isSuperAdmin ? "Revoke admin" : "Make admin"}
                          </button>
                        </form>
                        <form action={adminDeleteUser} className="inline">
                          <input type="hidden" name="userId" value={u.id} />
                          <ConfirmButton message={`Delete user ${u.email} and all their picks and memberships? This cannot be undone.`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      </span>
                    )}
                    {self && <span className="text-xs text-slate-600">you</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
