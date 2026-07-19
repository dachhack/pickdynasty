import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GIF search proxy — keeps API keys server-side. GIPHY is the primary
 * provider (free keys at developers.giphy.com); Tenor is supported only for
 * grandfathered keys, since Google stopped accepting new Tenor API clients
 * in Jan 2026. Returns {disabled: true} when no key is configured so the UI
 * hides the GIF button. Ratings are capped for group-chat safety.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const giphyKey = process.env.GIPHY_API_KEY;
  const tenorKey = process.env.TENOR_API_KEY;
  if (!giphyKey && !tenorKey) return NextResponse.json({ disabled: true, results: [] });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ disabled: false, results: [] });

  try {
    if (giphyKey) {
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(q)}&limit=12&rating=pg-13`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return NextResponse.json({ disabled: false, results: [] });
      const data: any = await res.json();
      const results = (data.data ?? [])
        .map((g: any) => ({
          id: String(g.id),
          url: g.images?.original?.url ?? null,
          preview: g.images?.fixed_width_small?.url ?? g.images?.original?.url ?? null,
        }))
        .filter((r: any) => r.url && r.preview);
      return NextResponse.json({ disabled: false, results });
    }

    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${tenorKey}&limit=12&contentfilter=medium&media_filter=gif,tinygif`;
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
  } catch {
    return NextResponse.json({ disabled: false, results: [] });
  }
}
