import { redirect } from "next/navigation";
import { getLeagueView } from "@/lib/leagueView";
import { AppHeader } from "@/components/AppHeader";
import { LeagueNav } from "@/components/LeagueNav";
import { isAdminRole } from "@/lib/league";
import { sportByKey } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { leagueId: string };
}) {
  const { user, membership, league } = await getLeagueView(params.leagueId);
  if (!user) redirect(`/login?next=/leagues/${params.leagueId}`);
  if (!membership || !league) redirect("/dashboard");

  const sport = sportByKey(league.sport);

  return (
    <div>
      <AppHeader userName={user.name} />
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-5">
          <h1 className="text-xl font-bold text-slate-900">{league.name}</h1>
          <p className="mb-3 text-sm text-slate-500">
            {sport.emoji} {sport.label} · {league.season}
            {league.blindPicks ? " · 🕶️ Blind picks" : ""}
            {league.pickType === "AGAINST_SPREAD" ? " · Against the spread" : " · Straight up"}
          </p>
          <LeagueNav leagueId={league.id} isAdmin={isAdminRole(membership.role)} />
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
