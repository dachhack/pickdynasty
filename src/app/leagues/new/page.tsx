import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CreateLeagueForm } from "@/components/CreateLeagueForm";

export const metadata = { title: "New league" };

export default async function NewLeaguePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/leagues/new");

  return (
    <div>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Start a new league</h1>
        <p className="mt-1 text-sm text-slate-600">
          You&rsquo;ll be the commissioner. You can invite players and build the schedule right after.
        </p>
        <div className="card mt-6">
          <CreateLeagueForm />
        </div>
      </main>
    </div>
  );
}
