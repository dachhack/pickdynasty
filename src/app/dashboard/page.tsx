import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { joinLeague } from "@/actions/leagues";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { league: { include: { memberships: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">My Leagues</h1>
        <Link href="/leagues/new" className="btn">+ New league</Link>
      </div>

      {error === "bad-code" && (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          That invite code didn&rsquo;t match any league. Double-check it and try again.
        </p>
      )}

      {memberships.length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl">🏟️</p>
          <p className="mt-2 font-semibold">No leagues yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Start one and invite your friends, or join with an invite code below.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map((m) => (
            <Link key={m.id} href={`/leagues/${m.leagueId}`} className="card transition hover:border-indigo-600">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{sportEmoji(m.league.sport)}</span>
                {m.role === "COMMISSIONER" && (
                  <span className="rounded-full bg-indigo-950 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                    Commissioner
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-bold">{m.league.name}</h2>
              <p className="text-sm text-slate-400">
                {sportLabel(m.league.sport)} · {m.league.season} · {m.league.memberships.length}{" "}
                {m.league.memberships.length === 1 ? "player" : "players"}
              </p>
              <p className="mt-2 text-sm" style={{ color: m.teamColor }}>
                {m.teamEmoji} {m.teamName}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="card max-w-md">
        <h2 className="font-bold">Join with an invite code</h2>
        <form action={joinLeague} className="mt-3 flex gap-2">
          <input
            className="input uppercase"
            name="code"
            placeholder="e.g. K7PQ2XWM"
            required
            maxLength={8}
          />
          <button className="btn shrink-0">Join</button>
        </form>
      </div>
    </div>
  );
}
