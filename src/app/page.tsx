import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SPORTS } from "@/lib/sports";

const FEATURES = [
  {
    emoji: "🕶️",
    title: "Blind picks",
    body: "Nobody sees anyone else's picks until each game locks. No copying the leader.",
  },
  {
    emoji: "💰",
    title: "Money tracker",
    body: "Track buy-ins, side pots, and payouts — who's paid and who still owes. No payment processing, just the ledger.",
  },
  {
    emoji: "🎨",
    title: "Your team, your brand",
    body: "Name your team, pick your colors and emoji. Standings should look like a rivalry.",
  },
  {
    emoji: "🛠️",
    title: "Commissioner tools",
    body: "Invite with a link, build slates of games, enter results, and manage members from a proper admin area.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-14 py-6">
      <section className="text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
          Pick&rsquo;em leagues with friends, for <span className="text-indigo-400">every</span> sport.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          NFL Sundays, March Madness, the College World Series, Wimbledon — one place to set up,
          track, administer, and win your leagues.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/signup" className="btn !px-6 !py-3">
            Start a league
          </Link>
          <Link href="/login" className="btn-ghost !px-6 !py-3">
            Log in
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <div className="text-2xl">{f.emoji}</div>
            <h2 className="mt-2 font-bold">{f.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="text-center">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Any sport, any season
        </h2>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SPORTS.map((s) => (
            <span
              key={s.id}
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300"
            >
              {s.emoji} {s.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
