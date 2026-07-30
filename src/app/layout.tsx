import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { parseTheme } from "@/lib/theme";
import { userIsSuperAdmin } from "@/lib/superadmin";
import { logout } from "@/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Epic Pick'em — Pick'em Leagues With Friends",
  description:
    "Set up, track, and compete in pick'em leagues for any sport — NFL, college football, March Madness, MLB, NHL, tennis, and more.",
  metadataBase: new URL("https://epicpickem.com"),
  manifest: "/manifest.json",
  openGraph: {
    title: "Epic Pick'em — Pick'em Leagues With Friends",
    description: "Pick'em leagues with friends — every sport, all season long.",
    url: "https://epicpickem.com",
    siteName: "Epic Pick'em",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Epic Pick'em — Pick'em Leagues With Friends",
    description: "Pick'em leagues with friends — every sport, all season long.",
    images: ["/og.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Epic Pick'em", statusBarStyle: "black-translucent" },
};

const LIGHT_BG = "#eef2f7"; // keep in sync with --background in globals.css
const DARK_BG = "#0b1120";

export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get("ep_theme")?.value);
  if (theme === "light") return { themeColor: LIGHT_BG };
  if (theme === "system") {
    return {
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: LIGHT_BG },
        { media: "(prefers-color-scheme: dark)", color: DARK_BG },
      ],
    };
  }
  return { themeColor: DARK_BG };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, store] = await Promise.all([getCurrentUser(), cookies()]);
  const theme = parseTheme(store.get("ep_theme")?.value);
  return (
    <html lang="en" data-theme={theme} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-lg font-black tracking-tight">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" className="h-7 w-7" />
              Epic<span className="text-indigo-400">Pick&rsquo;em</span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <Link href="/dashboard" className="text-slate-300 hover:text-slate-100">
                    My Leagues
                  </Link>
                  {userIsSuperAdmin(user) && (
                    <Link href="/admin" className="text-indigo-400 hover:text-indigo-300">
                      🛡️ HQ
                    </Link>
                  )}
                  {user.isGuest && (
                    <Link href="/claim" className="text-indigo-400 hover:text-indigo-300">
                      🎟️ Claim account
                    </Link>
                  )}
                  <span className="hidden text-slate-500 sm:inline">{user.name}</span>
                  <form action={logout}>
                    <button className="btn-ghost !px-3 !py-1.5 !text-xs">Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-300 hover:text-slate-100">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn !px-3 !py-1.5 !text-xs">
                    Sign up
                  </Link>
                </>
              )}
              <ThemeToggle initial={theme} />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
          Epic Pick&rsquo;em · epicpickem.com — bragging rights, tracked properly.
        </footer>
      </body>
    </html>
  );
}
