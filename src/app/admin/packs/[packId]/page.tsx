import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/superadmin";
import { espnSupported, WEEKLY_SPORTS } from "@/lib/espn";
import { SPORTS } from "@/lib/sports";
import { savePackGames } from "@/actions/packs";
import SlateBuilder from "@/components/SlateBuilder";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PackEditorPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  await requireSuperAdmin();
  const { packId } = await params;
  const pack = await db.pickPack.findUnique({
    where: { id: packId },
    include: { games: { orderBy: { startTime: "asc" } } },
  });
  if (!pack) notFound();

  const initialSlate = pack.games.map((g) => ({
    sport: g.sport,
    externalId: g.externalId,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    startTime: g.startTime.toISOString(),
    winner: (g.winner as "HOME" | "AWAY" | "TIE" | null) ?? null,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    spread: g.spread,
    completed: Boolean(g.winner),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black">🎁 Edit pack: {pack.emoji} {pack.title}</h1>
        <p className="text-sm text-slate-400">
          Build the bundle — saving replaces the pack&rsquo;s games. Publish it from HQ when
          it&rsquo;s ready. The name field renames the pack.
        </p>
      </div>
      <SlateBuilder
        action={savePackGames.bind(null, pack.id)}
        saveLabel="Save pack"
        initialName={pack.title}
        initialSlate={initialSlate}
        leagueId="hq"
        leagueSport="nfl"
        leagueSeason={String(new Date().getFullYear())}
        sports={SPORTS.filter((x) => espnSupported(x.id)).map((x) => ({ id: x.id, label: x.label, emoji: x.emoji }))}
        weeklyMax={Object.fromEntries(Object.entries(WEEKLY_SPORTS).map(([k, v]) => [k, v.maxWeek]))}
        todayISO={new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}
      />
      <Link href="/admin" className="text-sm text-indigo-400 hover:underline">← Back to HQ</Link>
    </div>
  );
}
