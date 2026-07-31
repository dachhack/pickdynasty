import { db } from "@/lib/db";

/**
 * Serves a venue's uploaded logo (public — it appears on the public TV
 * board). Immutable-cached: VenueMark busts the URL with ?v=<timestamp>
 * whenever a new logo is uploaded.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueId: string }> }
) {
  const { venueId } = await params;
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { logo: true, logoType: true },
  });
  if (!venue?.logo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(venue.logo), {
    headers: {
      "Content-Type": venue.logoType ?? "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
