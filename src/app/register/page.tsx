import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getSessionUser();
  if (user) redirect(searchParams.next?.startsWith("/") ? searchParams.next : "/dashboard");
  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">Then start a league or join one with an invite code.</p>
        <div className="card mt-6">
          <RegisterForm next={searchParams.next} />
        </div>
      </main>
    </div>
  );
}
