import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getSessionUser();
  if (user) redirect(searchParams.next?.startsWith("/") ? searchParams.next : "/dashboard");
  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to see your leagues and make your picks.</p>
        <div className="card mt-6">
          <LoginForm next={searchParams.next} />
        </div>
      </main>
    </div>
  );
}
