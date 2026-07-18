import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
