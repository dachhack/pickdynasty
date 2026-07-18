"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LeagueNav({ leagueId, isAdmin }: { leagueId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/picks`, label: "Picks" },
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/money`, label: "Money" },
    { href: `${base}/team`, label: "My team" },
    ...(isAdmin ? [{ href: `${base}/admin`, label: "Admin" }] : []),
  ];
  return (
    <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const active = "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
