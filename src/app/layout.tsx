import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/actions/auth";

export const metadata: Metadata = {
  title: "PickDynasty — Pick'em Leagues With Friends",
  description:
    "Set up, track, and compete in pick'em leagues for any sport — NFL, college football, March Madness, MLB, NHL, tennis, and more.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "PickDynasty", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b1120",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} className="text-lg font-black tracking-tight">
              🏟️ Pick<span className="text-indigo-400">Dynasty</span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <Link href="/dashboard" className="text-slate-300 hover:text-white">
                    My Leagues
                  </Link>
                  <span className="hidden text-slate-500 sm:inline">{user.name}</span>
                  <form action={logout}>
                    <button className="btn-ghost !px-3 !py-1.5 !text-xs">Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-300 hover:text-white">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn !px-3 !py-1.5 !text-xs">
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
          PickDynasty — bragging rights, tracked properly.
        </footer>
      </body>
    </html>
  );
}
