import { getLeagueView } from "@/lib/leagueView";
import { db } from "@/lib/db";
import { isAdminRole } from "@/lib/league";
import { entrySignedAmount, formatCents, LEDGER_TYPES } from "@/lib/money";
import { TeamBadge } from "@/components/TeamBadge";
import { addLedgerEntryAction, deleteLedgerEntryAction } from "@/app/actions/admin";

export const metadata = { title: "Money" };

export default async function MoneyPage({ params }: { params: { leagueId: string } }) {
  const { membership, league } = await getLeagueView(params.leagueId);
  if (!membership || !league) return null;
  const admin = isAdminRole(membership.role);

  const [members, entries] = await Promise.all([
    db.membership.findMany({
      where: { leagueId: league.id, status: "ACTIVE" },
      include: { user: true },
    }),
    db.ledgerEntry.findMany({
      where: { leagueId: league.id },
      include: { membership: { include: { user: true } }, createdBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const balances = new Map<string, number>();
  let potCents = 0;
  let paidOutCents = 0;
  for (const e of entries) {
    if (e.type === "PAYMENT") potCents += Math.abs(e.amountCents);
    if (e.type === "PAYOUT") paidOutCents += Math.abs(e.amountCents);
    if (e.membershipId) {
      balances.set(
        e.membershipId,
        (balances.get(e.membershipId) ?? 0) + entrySignedAmount(e.type, e.amountCents)
      );
    }
  }

  const addEntry = addLedgerEntryAction.bind(null, league.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid grid-cols-3 gap-3">
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-500">Pot collected</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{formatCents(potCents, league.currency)}</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-500">Paid out</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{formatCents(paidOutCents, league.currency)}</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-slate-500">Buy-in</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {league.buyInCents > 0 ? formatCents(league.buyInCents, league.currency) : "Free"}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-900">Who&rsquo;s settled up</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {members.map((m) => {
              const bal = balances.get(m.id) ?? 0;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <TeamBadge emoji={m.teamEmoji} color={m.teamColor} name={m.teamName ?? m.user.name} sub={m.user.name} size="sm" />
                  {bal >= 0 ? (
                    <span className="badge bg-green-100 text-green-700">
                      ✓ Settled{bal > 0 ? ` (+${formatCents(bal, league.currency)})` : ""}
                    </span>
                  ) : (
                    <span className="badge bg-red-100 text-red-700">Owes {formatCents(-bal, league.currency)}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            💡 PickDynasty tracks money only — no payments move through the app. Settle up with cash,
            Venmo, or however your league rolls.
          </p>
        </div>

        <div className="card overflow-x-auto p-0">
          <h2 className="px-5 pt-5 font-bold text-slate-900">Ledger</h2>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2">Date</th>
                <th className="py-2">Player</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2">Note</th>
                {admin ? <th className="px-5 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-5 py-2 text-slate-500">
                    {e.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="py-2 font-medium text-slate-900">
                    {e.membership ? e.membership.teamName ?? e.membership.user.name : "League"}
                  </td>
                  <td className="py-2">
                    <span
                      className={`badge ${
                        e.type === "BUY_IN"
                          ? "bg-amber-100 text-amber-800"
                          : e.type === "PAYMENT"
                            ? "bg-green-100 text-green-700"
                            : e.type === "PAYOUT"
                              ? "bg-brand-50 text-brand-700"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {LEDGER_TYPES.find((t) => t.key === e.type)?.label ?? e.type}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">{formatCents(Math.abs(e.amountCents), league.currency)}</td>
                  <td className="max-w-[180px] truncate py-2 text-slate-500">{e.note}</td>
                  {admin ? (
                    <td className="px-5 py-2 text-right">
                      <form action={deleteLedgerEntryAction.bind(null, league.id, e.id)}>
                        <button className="text-xs text-red-600 hover:underline" type="submit">Delete</button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={admin ? 6 : 5} className="px-5 py-6 text-center text-slate-500">
                    No money activity yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="pb-2" />
        </div>
      </div>

      <div>
        {admin ? (
          <div className="card">
            <h2 className="font-bold text-slate-900">Record money activity</h2>
            <p className="mt-1 text-xs text-slate-500">Admins only. This is a tracker, not a payment system.</p>
            <form action={addEntry} className="mt-3 space-y-3">
              <div>
                <label className="label">Player</label>
                <select className="input" name="membershipId">
                  <option value="">— League (no player) —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.teamName ?? m.user.name} ({m.user.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" name="type" defaultValue="PAYMENT">
                  {LEDGER_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount ($)</label>
                <input className="input" name="amount" inputMode="decimal" placeholder="50" required />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" name="note" placeholder="Paid via Venmo" />
              </div>
              <button className="btn-primary w-full" type="submit">Add entry</button>
            </form>
          </div>
        ) : (
          <div className="card text-sm text-slate-600">
            <h2 className="font-bold text-slate-900">How this works</h2>
            <p className="mt-2">
              League admins record buy-ins, payments, and payouts here so everyone can see who&rsquo;s
              settled. No money moves through the app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
