import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function AppHeader({ userName }: { userName?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={userName ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">🏆</span>
          PickDynasty
        </Link>
        <nav className="flex items-center gap-2">
          {userName ? (
            <>
              <span className="hidden text-sm text-slate-500 sm:inline">Hi, {userName}</span>
              <Link href="/dashboard" className="btn-secondary">My leagues</Link>
              <form action={logoutAction}>
                <button className="btn-secondary" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">Sign in</Link>
              <Link href="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
