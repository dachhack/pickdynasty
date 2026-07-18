import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SPORTS } from "@/lib/sports";
import { FORMATS } from "@/lib/formats";
import { createLeague } from "@/actions/leagues";

export default async function NewLeaguePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/leagues/new");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-black">Start a new league</h1>
      <form action={createLeague} className="card mt-6 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="name">League name</label>
          <input className="input" id="name" name="name" required placeholder="Saturday Tailgate Pick'em" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="sport">Sport</label>
            <select className="input" id="sport" name="sport" defaultValue="nfl">
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="season">Season</label>
            <input className="input" id="season" name="season" placeholder="2026" defaultValue={new Date().getFullYear()} />
          </div>
        </div>
        <div>
          <span className="label">Format</span>
          <div className="flex flex-col gap-2">
            {FORMATS.map((f, i) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500"
              >
                <input
                  type="radio"
                  name="format"
                  value={f.id}
                  defaultChecked={i === 0}
                  className="mt-1 h-4 w-4 accent-indigo-500"
                />
                <span>
                  <span className="text-sm font-semibold">{f.emoji} {f.label}</span>
                  <span className="block text-xs text-slate-400">{f.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="buyIn">Buy-in ($, 0 = free)</label>
            <input className="input" id="buyIn" name="buyIn" type="number" min="0" step="1" defaultValue="0" />
          </div>
          <div>
            <label className="label" htmlFor="teamName">Your team name</label>
            <input className="input" id="teamName" name="teamName" placeholder={`${user.name}'s Team`} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" name="blindPicks" defaultChecked className="h-4 w-4 accent-indigo-500" />
          Blind picks — hide everyone&rsquo;s picks until each game locks
        </label>
        <button className="btn">Create league</button>
      </form>
    </div>
  );
}
