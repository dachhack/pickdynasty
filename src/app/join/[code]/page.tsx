import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { joinLeague } from "@/actions/leagues";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.toUpperCase();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/join/${normalized}`);

  const league = await db.league.findUnique({
    where: { inviteCode: normalized },
    include: { memberships: true },
  });
  if (!league) redirect("/dashboard?error=bad-code");

  const already = league.memberships.some((m) => m.userId === user.id);
  if (already) redirect(`/leagues/${league.id}`);

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-5xl">{sportEmoji(league.sport)}</p>
      <h1 className="mt-3 text-2xl font-black">You&rsquo;re invited to {league.name}</h1>
      <p className="mt-1 text-slate-400">
        {sportLabel(league.sport)} · {league.season} season · {league.memberships.length} players
        {league.buyIn > 0 && <> · ${league.buyIn} buy-in</>}
      </p>
      <form action={joinLeague} className="card mt-6 flex flex-col gap-4 text-left">
        <input type="hidden" name="code" value={normalized} />
        <div>
          <label className="label" htmlFor="teamName">Name your team</label>
          <input className="input" id="teamName" name="teamName" placeholder={`${user.name}'s Team`} />
        </div>
        <button className="btn">Join league</button>
      </form>
    </div>
  );
}
