import Link from "next/link";
import { requireMembership } from "@/lib/league";
import { formatMeta } from "@/lib/formats";
import { sportEmoji, sportLabel } from "@/lib/sports";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership(id);
  const { league } = membership;
  const isAdmin = membership.role === "COMMISSIONER";

  const tabs = [
    { href: `/leagues/${id}`, label: "Standings" },
    { href: `/leagues/${id}/picks`, label: "Picks" },
    { href: `/leagues/${id}/money`, label: "Money" },
    { href: `/leagues/${id}/team`, label: "My Team" },
    ...(isAdmin ? [{ href: `/leagues/${id}/admin`, label: "Admin" }] : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl">{sportEmoji(league.sport)}</span>
        <div>
          <h1 className="text-2xl font-black">{league.name}</h1>
          <p className="text-sm text-slate-400">
            {sportLabel(league.sport)} · {league.season} season ·{" "}
            {formatMeta(league.format).emoji} {formatMeta(league.format).label}
            {league.blindPicks && " · 🕶️ blind picks"}
          </p>
        </div>
      </div>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-800 pb-px">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
