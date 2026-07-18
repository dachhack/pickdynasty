import { getLeagueView } from "@/lib/leagueView";
import { updateTeamAction } from "@/app/actions/league";
import { TeamBadge } from "@/components/TeamBadge";

export const metadata = { title: "My team" };

const EMOJI_CHOICES = ["🏆", "🔥", "🦅", "🐐", "⚡", "💀", "🦈", "🐍", "🚀", "🍀", "👑", "🎯", "🧊", "🌵", "🐻", "🦁"];

export default async function TeamPage({ params }: { params: { leagueId: string } }) {
  const { membership, league } = await getLeagueView(params.leagueId);
  if (!membership || !league) return null;

  const save = updateTeamAction.bind(null, league.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="card">
        <h2 className="font-bold text-slate-900">Current look</h2>
        <div className="mt-3">
          <TeamBadge
            emoji={membership.teamEmoji}
            color={membership.teamColor}
            name={membership.teamName ?? "My team"}
            sub={membership.teamMotto ?? undefined}
            size="lg"
          />
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold text-slate-900">Name &amp; brand your team</h2>
        <p className="mt-1 text-sm text-slate-600">This is how you&rsquo;ll appear on leaderboards and picks in this league.</p>
        <form action={save} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="teamName">Team name</label>
            <input
              className="input"
              id="teamName"
              name="teamName"
              defaultValue={membership.teamName ?? ""}
              maxLength={40}
              placeholder="The Upset Specialists"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="teamMotto">Motto (optional)</label>
            <input
              className="input"
              id="teamMotto"
              name="teamMotto"
              defaultValue={membership.teamMotto ?? ""}
              maxLength={80}
              placeholder="Fade the public. Trust the gut."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="teamColor">Team color</label>
              <input
                className="h-10 w-full cursor-pointer rounded-lg border border-slate-300"
                id="teamColor"
                name="teamColor"
                type="color"
                defaultValue={membership.teamColor}
              />
            </div>
            <div>
              <label className="label" htmlFor="teamEmoji">Emblem</label>
              <select className="input" id="teamEmoji" name="teamEmoji" defaultValue={membership.teamEmoji}>
                {EMOJI_CHOICES.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
                {!EMOJI_CHOICES.includes(membership.teamEmoji) ? (
                  <option value={membership.teamEmoji}>{membership.teamEmoji}</option>
                ) : null}
              </select>
            </div>
          </div>
          <button className="btn-primary w-full" type="submit">Save team</button>
        </form>
      </div>
    </div>
  );
}
