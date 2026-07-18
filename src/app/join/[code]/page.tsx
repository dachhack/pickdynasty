import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppHeader } from "@/components/AppHeader";
import { joinByCodeAction } from "@/app/actions/league";
import { sportByKey } from "@/lib/sports";

export const metadata = { title: "Join league" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const user = await getSessionUser();
  if (!user) redirect(`/register?next=/join/${code}`);

  let league = await db.league.findUnique({ where: { inviteCode: code } });
  if (!league) {
    const invite = await db.invitation.findUnique({ where: { code }, include: { league: true } });
    if (invite && invite.status === "PENDING") league = invite.league;
  }

  return (
    <div>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-md px-4 py-12">
        {league ? (
          <div className="card text-center">
            <p className="text-4xl">{sportByKey(league.sport).emoji}</p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">You&rsquo;re invited to {league.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {sportByKey(league.sport).label} · {league.season}
            </p>
            <form action={joinByCodeAction} className="mt-5">
              <input type="hidden" name="code" value={code} />
              <button className="btn-primary w-full" type="submit">Join league</button>
            </form>
          </div>
        ) : (
          <div className="card text-center">
            <p className="text-4xl">🤔</p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">Invite not found</h1>
            <p className="mt-1 text-sm text-slate-600">
              That code doesn&rsquo;t match any league — it may have been revoked or regenerated.
            </p>
            <Link href="/dashboard" className="btn-secondary mt-5 w-full">Go to my leagues</Link>
          </div>
        )}
      </main>
    </div>
  );
}
