import Link from "next/link";
import { db } from "@/lib/db";
import { requireMembership, slateStatus, SLATE_STATUS_UI } from "@/lib/league";

export default async function PicksIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership(id);
  const isSurvivor = membership.league.format === "survivor";

  const slates = await db.slate.findMany({
    where: { leagueId: id },
    orderBy: { order: "asc" },
    include: { games: { include: { picks: { where: { membershipId: membership.id } } } } },
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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slates.map((s) => {
        const status = slateStatus(s);
        const ui = SLATE_STATUS_UI[status];
        const myPicks = s.games.filter((g) => g.picks.length > 0).length;
        const needed = isSurvivor ? 1 : s.games.length;
        const done = myPicks >= needed;
        const cta =
          status === "open"
            ? done
              ? "Review picks"
              : isSurvivor
                ? "⚠️ Pick your team"
                : `⚠️ Make picks (${myPicks}/${needed})`
            : "View results";
        return (
          <Link key={s.id} href={`/leagues/${id}/picks/${s.id}`} className="card transition hover:border-indigo-600">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{s.name}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {s.games.length} games · you&rsquo;ve picked {myPicks}/{needed}
            </p>
            <p className={`mt-2 text-sm font-semibold ${status === "open" && !done ? "text-amber-400" : "text-indigo-400"}`}>
              {cta} →
            </p>
          </Link>
        );
      })}
    </div>
  );
}
