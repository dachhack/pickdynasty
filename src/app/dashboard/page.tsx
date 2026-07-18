import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppHeader } from "@/components/AppHeader";
import { TeamBadge } from "@/components/TeamBadge";
import { JoinLeagueForm } from "@/components/JoinLeagueForm";
import { sportByKey } from "@/lib/sports";

export const metadata = { title: "My leagues" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const memberships = await db.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      league: { include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } } },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">My leagues</h1>
          <Link href="/leagues/new" className="btn-primary">+ New league</Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {memberships.map(({ league, ...m }) => {
            const sport = sportByKey(league.sport);
            return (
              <Link key={league.id} href={`/leagues/${league.id}`} className="card hover:border-brand-300 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{league.name}</div>
                    <div className="text-sm text-slate-500">
                      {sport.emoji} {sport.label} · {league.season} · {league._count.memberships} players
                    </div>
                  </div>
                  {m.role !== "PLAYER" ? (
                    <span className="badge bg-brand-50 text-brand-700 border border-brand-200">
                      {m.role === "COMMISSIONER" ? "Commissioner" : "Admin"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <TeamBadge emoji={m.teamEmoji} color={m.teamColor} name={m.teamName ?? user.name} sub={m.teamMotto ?? undefined} size="sm" />
                </div>
              </Link>
            );
          })}
          {memberships.length === 0 ? (
            <div className="card sm:col-span-2 text-center text-slate-600">
              <p className="text-3xl">🏟️</p>
              <p className="mt-2 font-semibold text-slate-900">No leagues yet</p>
              <p className="mt-1 text-sm">Start one, or join with an invite code below.</p>
            </div>
          ) : null}
        </div>

        <div className="card mt-8 max-w-md">
          <h2 className="font-bold text-slate-900">Have an invite code?</h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">Enter it to join a friend&rsquo;s league.</p>
          <JoinLeagueForm />
        </div>
      </main>
    </div>
  );
}
