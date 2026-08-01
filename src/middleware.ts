import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase session refresh (standard @supabase/ssr pattern): keeps auth
 * tokens fresh by re-issuing cookies on navigation. No-op when running on
 * the local JWT auth driver.
 */
export async function middleware(request: NextRequest) {
  // Expose the pathname to server layouts — the root layout drops the app
  // chrome (header/footer/width cap) on the /tv/* big-screen routes.
  request.headers.set("x-pathname", request.nextUrl.pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No Supabase session cookies (guests, public TV boards, signed-out
  // visitors) → nothing to refresh; skip the network round-trip to
  // Supabase auth that would otherwise tax every request.
  const hasSupabaseSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  if (!url || !anonKey || !hasSupabaseSession) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  // Refreshes the token if expired; must be awaited before returning.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg|api/cron).*)"],
};
