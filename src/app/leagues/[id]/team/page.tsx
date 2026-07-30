import {
  computeTrophyCase,
  loadLeagueForStandings,
  requireMembership,
} from "@/lib/league";
import { updateTeam } from "@/actions/leagues";
import ShareCardButton from "@/components/ShareCardButton";

const PRESET_COLORS = [
  "#4f46e5", "#dc2626", "#16a34a", "#d97706", "#0891b2",
  "#c026d3", "#e11d48", "#65a30d", "#7c3aed", "#f59e0b",
];

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const membership = await requireMembership(id);
  const league = await loadLeagueForStandings(id);
  const trophies = computeTrophyCase(league, membership.id);
  const latestFinal = [...league.slates]
    .reverse()
    .find((s) => s.games.length > 0 && s.games.every((g) => g.winner));

  const shelf = [
    { emoji: "🥇", value: trophies.weeklyWins, label: "slate wins" },
    { emoji: "💯", value: trophies.perfectSlates, label: "perfect slates" },
    { emoji: "🔥", value: trophies.bestStreak, label: "best streak" },
    {
      emoji: trophies.seasonRank === 1 ? "👑" : "📈",
      value: trophies.seasonRank > 0 ? `#${trophies.seasonRank}` : "—",
      label: `of ${trophies.players} this season`,
    },
  ];

  return (
    <div className="mx-auto max-w-lg">
      <div className="card text-center">
        <p className="text-5xl">{membership.teamEmoji}</p>
        <p className="mt-2 text-xl font-black" style={{ color: membership.teamColor }}>
          {membership.teamName}
        </p>
        <p className="text-xs text-slate-500">This is how you appear in standings and picks.</p>
      </div>

      <section className="card mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">🏆 Trophy case</h2>
          {latestFinal && <ShareCardButton leagueId={id} slateId={latestFinal.id} label="📸 Share my latest" />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {shelf.map((t) => (
            <div key={t.label} className="rounded-lg border border-slate-800 py-3">
              <p className="text-2xl">{t.emoji}</p>
              <p className="mt-1 text-xl font-black">{t.value}</p>
              <p className="text-xs text-slate-500">{t.label}</p>
            </div>
          ))}
        </div>
        {trophies.currentStreak >= 3 && (
          <p className="mt-3 rounded-lg border border-orange-900 bg-orange-950/40 px-3 py-2 text-sm text-orange-300">
            🔥 You&rsquo;re riding a {trophies.currentStreak}-pick heater right now.
          </p>
        )}
      </section>

      {saved && (
        <p className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
          Team saved.
        </p>
      )}

      <form action={updateTeam} className="card mt-4 flex flex-col gap-4">
        <input type="hidden" name="leagueId" value={id} />
        <div>
          <label className="label" htmlFor="teamName">Team name</label>
          <input className="input" id="teamName" name="teamName" defaultValue={membership.teamName} required maxLength={40} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="teamColor">Team color</label>
            <input
              className="h-10 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950"
              id="teamColor"
              name="teamColor"
              type="color"
              defaultValue={membership.teamColor}
              list="preset-colors"
            />
            <datalist id="preset-colors">
              {PRESET_COLORS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="teamEmoji">Emoji / logo</label>
            <input className="input text-center text-xl" id="teamEmoji" name="teamEmoji" defaultValue={membership.teamEmoji} maxLength={4} />
          </div>
        </div>
        <button className="btn">Save team</button>
      </form>
    </div>
  );
}
