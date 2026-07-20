import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { joinLeague } from "@/actions/leagues";
import GuestJoinForm from "@/components/GuestJoinForm";
import LocationField from "@/components/LocationField";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ loc?: string }>;
}) {
  const { code } = await params;
  const { loc } = await searchParams;
  const normalized = code.toUpperCase();
  const user = await getCurrentUser();

  const league = await db.league.findUnique({
    where: { inviteCode: normalized },
    include: { memberships: true },
  });
  if (!league) redirect(user ? "/dashboard?error=bad-code" : "/");

  const already = user && league.memberships.some((m) => m.userId === user.id);
  if (already) redirect(`/leagues/${league.id}`);

  // Signed out + guest entry closed -> the classic login wall.
  if (!user && !league.allowGuests) redirect(`/login?next=/join/${normalized}`);

  const needsLocation =
    league.requireLocation && league.venueLat != null && league.venueLng != null;

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-5xl">{sportEmoji(league.sport)}</p>
      <h1 className="mt-3 text-2xl font-black">You&rsquo;re invited to {league.name}</h1>
      <p className="mt-1 text-slate-400">
        {sportLabel(league.sport)} · {league.season} season · {league.memberships.length} players
        {league.buyIn > 0 && <> · ${league.buyIn} buy-in</>}
      </p>

      {loc && (
        <p className="mt-4 rounded-lg border border-amber-900 bg-amber-950/50 px-4 py-2 text-sm text-amber-300">
          This league only lets people at the venue join — share your location below.
        </p>
      )}

      {user ? (
        <form action={joinLeague} className="card mt-6 flex flex-col gap-4 text-left">
          <input type="hidden" name="code" value={normalized} />
          <div>
            <label className="label" htmlFor="teamName">Name your team</label>
            <input className="input" id="teamName" name="teamName" placeholder={`${user.name}'s Team`} />
          </div>
          {needsLocation && (
            <LocationField hint="This league checks that you're at the venue." />
          )}
          <button className="btn">Join league</button>
        </form>
      ) : (
        <>
          <div className="mt-6">
            <GuestJoinForm code={normalized} requireLocation={needsLocation} />
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Have an account?{" "}
            <Link href={`/login?next=/join/${normalized}`} className="text-indigo-400 hover:underline">
              Log in
            </Link>{" "}
            to join with it.
          </p>
        </>
      )}
    </div>
  );
}
