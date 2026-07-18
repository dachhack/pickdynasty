import Link from "next/link";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/league";

// Slate index: pick the latest slate or list all.
export default async function PicksIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMembership(id);

  const slates = await db.slate.findMany({
    where: { leagueId: id },
    orderBy: { order: "asc" },
    include: { games: true },
  });

  if (slates.length === 0) {
    return (
      <div className="card text-center text-slate-400">
        <p className="text-3xl">📋</p>
        <p className="mt-2">
          No slates yet. The commissioner hasn&rsquo;t added any games to pick.
        </p>
      </div>
    );
  }

  const now = new Date();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slates.map((s) => {
        const decided = s.games.filter((g) => g.winner).length;
        const upcoming = s.games.some((g) => g.startTime > now);
        return (
          <Link key={s.id} href={`/leagues/${id}/picks/${s.id}`} className="card transition hover:border-indigo-600">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{s.name}</h2>
              {upcoming ? (
                <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-300">Open</span>
              ) : decided === s.games.length && s.games.length > 0 ? (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Final</span>
              ) : (
                <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">In progress</span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {s.games.length} games · {decided} decided
            </p>
          </Link>
        );
      })}
    </div>
  );
}
