import { db } from "@/lib/db";
import { requireMembership } from "@/lib/league";
import { addMoneyEntry, deleteMoneyEntry, toggleSettled } from "@/actions/money";

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2).replace(/\.00$/, "")}`;

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function MoneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership(id);
  const { league } = membership;
  const isAdmin = membership.role === "COMMISSIONER";

  const [entries, members] = await Promise.all([
    db.moneyEntry.findMany({
      where: { leagueId: id },
      include: { membership: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.membership.findMany({ where: { leagueId: id }, include: { user: true } }),
  ]);

  const settledIn = entries.filter((e) => e.settled && e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const settledOut = entries.filter((e) => e.settled && e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const pot = settledIn + settledOut;

  // Per-member: has their buy-in been collected? what have they been paid?
  const perMember = members.map((m) => {
    const mine = entries.filter((e) => e.membershipId === m.id);
    const paidIn = mine.filter((e) => e.amount > 0 && e.settled).reduce((s, e) => s + e.amount, 0);
    const owedIn = mine.filter((e) => e.amount > 0 && !e.settled).reduce((s, e) => s + e.amount, 0);
    const paidOut = mine.filter((e) => e.amount < 0 && e.settled).reduce((s, e) => s - e.amount, 0);
    const owedOut = mine.filter((e) => e.amount < 0 && !e.settled).reduce((s, e) => s - e.amount, 0);
    return { m, paidIn, owedIn, paidOut, owedOut };
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500">
        💡 PickDynasty tracks money — it never moves it. Settle up in cash, Venmo, or however your
        group does it, then mark entries as settled here.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pot (settled)</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">{money(pot)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">Collected</p>
          <p className="mt-1 text-2xl font-black">{money(settledIn)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">Paid out</p>
          <p className="mt-1 text-2xl font-black">{money(-settledOut)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 text-right">Paid in</th>
              <th className="px-4 py-3 text-right">Owes</th>
              <th className="px-4 py-3 text-right">Won (paid)</th>
              <th className="px-4 py-3 text-right">Won (pending)</th>
            </tr>
          </thead>
          <tbody>
            {perMember.map(({ m, paidIn, owedIn, paidOut, owedOut }) => (
              <tr key={m.id} className="border-b border-slate-800/50 last:border-0">
                <td className="px-4 py-3">
                  <span className="font-semibold" style={{ color: m.teamColor }}>
                    {m.teamEmoji} {m.teamName}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">{m.user.name}</span>
                </td>
                <td className="px-4 py-3 text-right">{money(paidIn)}</td>
                <td className={`px-4 py-3 text-right ${owedIn > 0 ? "font-bold text-red-400" : "text-slate-500"}`}>
                  {money(owedIn)}
                </td>
                <td className="px-4 py-3 text-right">{money(paidOut)}</td>
                <td className={`px-4 py-3 text-right ${owedOut > 0 ? "font-bold text-amber-400" : "text-slate-500"}`}>
                  {money(owedOut)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <form action={addMoneyEntry} className="card grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="leagueId" value={id} />
          <div className="sm:col-span-2">
            <label className="label">Player</label>
            <select className="input" name="membershipId" defaultValue="">
              <option value="">— whole league —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.teamName} ({m.user.name})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" name="type" defaultValue="BUY_IN">
              <option value="BUY_IN">Buy-in</option>
              <option value="PAYOUT">Payout</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
          <div>
            <label className="label">Amount ($)</label>
            <input className="input" name="amount" type="number" min="0.01" step="0.01" required
              defaultValue={league.buyIn > 0 ? league.buyIn : undefined} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Note</label>
            <input className="input" name="note" placeholder="Week 3 side pot…" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-3">
            <input type="checkbox" name="settled" className="h-4 w-4 accent-indigo-500" />
            Money already changed hands
          </label>
          <button className="btn sm:col-span-3 sm:justify-self-end">Add entry</button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ledger</h2>
        {entries.length === 0 && <p className="text-sm text-slate-500">No entries yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="card flex flex-wrap items-center gap-3 !py-3">
            <span className={`w-20 font-bold ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {e.amount >= 0 ? "+" : ""}{money(e.amount)}
            </span>
            <span className="text-sm">
              {e.membership ? (
                <span style={{ color: e.membership.teamColor }}>
                  {e.membership.teamEmoji} {e.membership.teamName}
                </span>
              ) : (
                <span className="text-slate-400">League</span>
              )}
              <span className="ml-2 text-xs text-slate-500">
                {e.type.replace("_", "-").toLowerCase()}
                {e.note && ` · ${e.note}`} · {dateFmt.format(e.createdAt)}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-2">
              {e.settled ? (
                <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">Settled</span>
              ) : (
                <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">Unsettled</span>
              )}
              {isAdmin && (
                <>
                  <form action={toggleSettled}>
                    <input type="hidden" name="leagueId" value={id} />
                    <input type="hidden" name="entryId" value={e.id} />
                    <button className="btn-ghost !px-2 !py-1 !text-xs">
                      {e.settled ? "Unsettle" : "Mark settled"}
                    </button>
                  </form>
                  <form action={deleteMoneyEntry}>
                    <input type="hidden" name="leagueId" value={id} />
                    <input type="hidden" name="entryId" value={e.id} />
                    <button className="btn-danger">✕</button>
                  </form>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
