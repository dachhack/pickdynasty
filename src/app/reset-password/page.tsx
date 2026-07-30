import Link from "next/link";
import { verifyPasswordResetToken } from "@/lib/auth";
import { supabaseEnabled, supabaseServer } from "@/lib/supabase";
import { ResetPasswordForm } from "@/components/PasswordResetForms";

export const dynamic = "force-dynamic";

/**
 * Landing page for password-reset links. Supabase driver: the recovery link
 * went through /auth/callback, which established a session — no token in the
 * URL. Local driver: the emailed single-use token rides the query string.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Dead-link check up front so the user isn't teased with a form that
  // can only fail. (The action re-verifies before writing anything.)
  let valid: boolean;
  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    valid = Boolean(user);
  } else {
    valid = Boolean(token && (await verifyPasswordResetToken(token)));
  }

  if (!valid) {
    return (
      <div className="mx-auto mt-8 w-full max-w-sm">
        <div className="card text-center">
          <p className="text-4xl">⏳</p>
          <h1 className="mt-2 text-xl font-bold">That link isn&rsquo;t valid anymore</h1>
          <p className="mt-2 text-sm text-slate-400">
            Reset links work once and expire after 30 minutes.
          </p>
          <Link href="/forgot-password" className="btn mt-4 inline-flex">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
