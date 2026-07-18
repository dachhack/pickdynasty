import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GIF search proxy (Tenor v2). Keeps the API key server-side. Returns
 * {disabled: true} when no TENOR_API_KEY is configured so the UI hides
 * the GIF button. contentfilter=medium keeps results group-chat safe.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.TENOR_API_KEY;
  if (!key) return NextResponse.json({ disabled: true, results: [] });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ disabled: false, results: [] });

  const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${key}&limit=12&contentfilter=medium&media_filter=gif,tinygif`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ disabled: false, results: [] });
  const data: any = await res.json();
  const results = (data.results ?? [])
    .map((r: any) => ({
      id: String(r.id),
      url: r.media_formats?.gif?.url ?? null,
      preview: r.media_formats?.tinygif?.url ?? r.media_formats?.gif?.url ?? null,
    }))
    .filter((r: any) => r.url && r.preview);
  return NextResponse.json({ disabled: false, results });
}
