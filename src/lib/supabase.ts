import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Auth is the production auth driver — pointing both Epic Pick'em
 * and Drip League FF at the SAME Supabase project gives users one shared
 * account across both products. When these env vars are absent (local dev,
 * CI, tests), lib/auth.ts falls back to the self-contained JWT driver.
 */
export function supabaseEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Admin client — needed to mint auth links ourselves via
 * auth.admin.generateLink so Epic can send its OWN branded auth emails
 * instead of the shared project's Drip-branded ones (generateLink returns
 * the link without sending anything). Set SUPABASE_SECRET_KEY (an
 * sb_secret_... key from the dashboard — preferred: individually revocable,
 * survives JWT-secret rotation) to enable; the legacy service_role JWT via
 * SUPABASE_SERVICE_ROLE_KEY still works as an alias. Without either, auth
 * flows fall back to Supabase-sent emails.
 */
function supabaseAdminKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function supabaseAdminEnabled(): boolean {
  return supabaseEnabled() && Boolean(supabaseAdminKey());
}

/**
 * True when an auth call failed on OUR credentials rather than the user's:
 * an expired/revoked anon key, or a project JWT-secret rotation that
 * invalidated every legacy `eyJ...` key signed with it.
 *
 * Worth separating from a bad password. We share ONE Supabase project with
 * Drip League FF, so a key rotation over there silently breaks sign-in
 * here — and Supabase reports it as just another auth error, which used to
 * render as "Invalid email or password." to every user at once. Callers
 * should log this and say sign-in is unavailable instead of blaming the
 * password. (Wrong credentials come back as 400 "Invalid login
 * credentials", which deliberately does NOT match.)
 */
export function isSupabaseKeyError(
  error: { status?: number; message?: string } | null | undefined
): boolean {
  if (!error?.message) return false;
  return /invalid api key|no api key|api key found|jwt expired|invalid jwt|signature is invalid/i.test(
    error.message
  );
}

export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseAdminKey()!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookie writes are handled by
            // the middleware session refresh instead.
          }
        },
      },
    }
  );
}
