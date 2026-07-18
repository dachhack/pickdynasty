import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { SPORTS } from "@/lib/sports";

const FEATURES = [
  {
    emoji: "🕶️",
    title: "Blind picks",
    body: "Nobody sees anyone else's picks until the game locks. No copying, no gamesmanship — just pure conviction.",
  },
  {
    emoji: "🛠️",
    title: "Full admin control",
    body: "Invite players, build weekly slates, enter results, promote co-admins, and manage your league from one place.",
  },
  {
    emoji: "💵",
    title: "Money tracker",
    body: "Track buy-ins, payments, and payouts without moving a dollar through the app. Everyone sees who's settled up.",
  },
  {
    emoji: "🎨",
    title: "Team identity",
    body: "Name your team, pick your colors and emblem, and talk your talk with a team motto on the leaderboard.",
  },
  {
    emoji: "📊",
    title: "Live standings",
    body: "Automatic scoring the moment results go final — straight up or against the spread, with per-game point values.",
  },
  {
    emoji: "📱",
    title: "Works everywhere",
    body: "A fast mobile-first web app you can install to your home screen on iPhone and Android.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div>
      <AppHeader />
      <main>
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Pick&rsquo;em leagues with friends, for <span className="text-brand-600">every sport</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Set up a league in minutes, invite your crew, make blind picks, track the money, and battle
            for the crown all season long.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">Start a league</Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">I have an invite</Link>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {SPORTS.filter((s) => s.key !== "OTHER").map((s) => (
              <span key={s.key} className="badge border border-slate-200 bg-white text-slate-600">
                {s.emoji} {s.label}
              </span>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div className="text-3xl">{f.emoji}</div>
                <h3 className="mt-3 font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
          PickDynasty — friendly competition, zero payment processing. Settle up in person. 🤝
        </footer>
      </main>
    </div>
  );
}
