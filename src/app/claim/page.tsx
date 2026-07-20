import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ClaimForm from "@/components/ClaimForm";

export default async function ClaimPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isGuest) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md">
      <p className="text-center text-5xl">🎟️</p>
      <h1 className="mt-3 text-center text-2xl font-black">Keep your picks, {user.name}</h1>
      <p className="mt-2 text-center text-sm text-slate-400">
        You&rsquo;re playing as a guest on this device. Add an email and password and
        your leagues, picks, and bragging rights come with you — on any device.
      </p>
      <div className="mt-6">
        <ClaimForm />
      </div>
    </div>
  );
}
