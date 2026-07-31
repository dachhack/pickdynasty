"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeInviteCode, requireCommissioner } from "@/lib/league";
import { VENUE_RADIUS_OPTIONS } from "@/lib/geo";
import { SPORTS } from "@/lib/sports";
import { FORMATS } from "@/lib/formats";

const nightDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

/** Loads a venue the signed-in user hosts, redirecting if it isn't theirs. */
async function requireVenueHost(venueId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.createdById !== user.id) redirect("/dashboard");
  return { user, venue };
}

/**
 * Venue-first flow: creates a venue directly (no league yet). Nights are
 * started from the console afterwards; the first one uses the sport/format
 * defaults captured here.
 */
export async function createStandaloneVenue(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/venues/new");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) redirect("/venues/new");
  const emoji =
    [...String(formData.get("emoji") ?? "").trim()].slice(0, 2).join("") || "🍺";
  const sport = String(formData.get("sport") ?? "other");
  const format = String(formData.get("format") ?? "classic");
  if (!SPORTS.some((s) => s.id === sport)) redirect("/venues/new");
  if (!FORMATS.some((f) => f.id === format)) redirect("/venues/new");

  const coord = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  const venueLat = coord("venueLat");
  const venueLng = coord("venueLng");
  const radius = Number(formData.get("venueRadiusM") ?? 0);
  const requireLocation =
    formData.get("requireLocation") === "on" && venueLat != null && venueLng != null;

  const venue = await db.venue.create({
    data: {
      name,
      emoji,
      sport,
      format,
      code: makeInviteCode(),
      createdById: user.id,
      requireLocation,
      venueLat,
      venueLng,
      venueRadiusM: VENUE_RADIUS_OPTIONS.some((o) => o.value === radius) ? radius : 150,
    },
  });
  redirect(`/venues/${venue.id}?created=1`);
}

/**
 * Promotes an event-night league into a recurring venue: creates the Venue
 * (inheriting the league's geofence as the saved default) and links the
 * league as its first night.
 */
export async function createVenue(formData: FormData) {
  const leagueId = String(formData.get("leagueId") ?? "");
  const me = await requireCommissioner(leagueId);
  if (me.league.venueId) redirect(`/venues/${me.league.venueId}`);

  const name =
    String(formData.get("name") ?? "").trim().slice(0, 60) || me.league.name;

  const venue = await db.venue.create({
    data: {
      name,
      sport: me.league.sport,
      format: me.league.format,
      code: makeInviteCode(),
      createdById: me.userId,
      requireLocation: me.league.requireLocation,
      venueLat: me.league.venueLat,
      venueLng: me.league.venueLng,
      venueRadiusM: me.league.venueRadiusM,
    },
  });
  // Guest quick-join is the point of venue nights — switch it on now.
  await db.league.update({
    where: { id: leagueId },
    data: { venueId: venue.id, allowGuests: true },
  });
  revalidatePath(`/leagues/${leagueId}`, "layout");
  redirect(`/venues/${venue.id}`);
}

/**
 * Creates one venue night for the given date: a fresh league (new invite
 * code) cloned from the venue's most recent night (venue defaults when
 * there is none), stamped with the venue's saved geofence. The caller
 * becomes its commissioner.
 */
async function createNight(
  venue: NonNullable<Awaited<ReturnType<typeof db.venue.findUnique>>>,
  user: { id: string; name: string },
  eventAt: Date
) {
  const template = await db.league.findFirst({
    where: { venueId: venue.id },
    orderBy: { createdAt: "desc" },
  });
  const myTeam = template
    ? await db.membership.findUnique({
        where: { userId_leagueId: { userId: user.id, leagueId: template.id } },
      })
    : null;

  return db.league.create({
    data: {
      name: `${venue.name} · ${nightDateFmt.format(eventAt)}`,
      sport: template?.sport ?? venue.sport,
      season: String(eventAt.getFullYear()),
      format: template?.format ?? venue.format,
      blindPicks: template?.blindPicks ?? true,
      adminCanSeePicks: template?.adminCanSeePicks ?? false,
      buyIn: template?.buyIn ?? 0,
      currency: template?.currency ?? "USD",
      inviteCode: makeInviteCode(),
      allowGuests: true,
      requireLocation: venue.requireLocation,
      venueLat: venue.venueLat,
      venueLng: venue.venueLng,
      venueRadiusM: venue.venueRadiusM,
      venueId: venue.id,
      eventAt,
      createdById: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: "COMMISSIONER",
          // Hosts run the night without a team on the board unless they
          // opt in — carried over from the previous night's choice.
          spectator: myTeam ? myTeam.spectator : true,
          teamName: myTeam?.teamName ?? `${user.name} (host)`,
          teamColor: myTeam?.teamColor ?? "#4f46e5",
          teamEmoji: myTeam?.teamEmoji ?? "🏆",
        },
      },
    },
  });
}

/** Starts tonight's game and heads straight to the slate builder. */
export async function startNextNight(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  const { user, venue } = await requireVenueHost(venueId);
  const league = await createNight(venue, user, new Date());
  redirect(`/leagues/${league.id}/admin/slates`);
}

/**
 * Plans a FUTURE night so its slate can be built ahead of time. The TV
 * board keeps featuring the right night day-of (see pickCurrentNight).
 */
export async function planNight(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  const { user, venue } = await requireVenueHost(venueId);

  // <input type="date"> gives yyyy-mm-dd; pin to ~noon ET so the date
  // reads the same on either side of a DST switch.
  const raw = String(formData.get("date") ?? "");
  const eventAt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T16:00:00Z`) : null;
  if (!eventAt || Number.isNaN(eventAt.getTime())) {
    redirect(`/venues/${venueId}?planError=1`);
  }

  const league = await createNight(venue, user, eventAt);
  redirect(`/leagues/${league.id}/admin/slates`);
}

/** Venue settings: name/emoji + the saved geofence stamped onto FUTURE nights. */
export async function updateVenue(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  const { venue } = await requireVenueHost(venueId);

  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || venue.name;
  const emoji =
    [...String(formData.get("emoji") ?? "").trim()].slice(0, 2).join("") || venue.emoji;
  const sportRaw = String(formData.get("sport") ?? "");
  const sport = SPORTS.some((s) => s.id === sportRaw) ? sportRaw : venue.sport;
  const formatRaw = String(formData.get("format") ?? "");
  const format = FORMATS.some((f) => f.id === formatRaw) ? formatRaw : venue.format;
  let requireLocation = formData.get("requireLocation") === "on";

  const coord = (k: string) => {
    const raw = String(formData.get(k) ?? "").trim();
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  const venueLat = coord("venueLat");
  const venueLng = coord("venueLng");
  const radius = Number(formData.get("venueRadiusM") ?? 0);
  const venueRadiusM = VENUE_RADIUS_OPTIONS.some((o) => o.value === radius)
    ? radius
    : venue.venueRadiusM;

  // Location check needs a venue point — freshly captured or already saved.
  const hasPoint =
    (venueLat != null && venueLng != null) ||
    (venue.venueLat != null && venue.venueLng != null);
  if (requireLocation && !hasPoint) requireLocation = false;

  await db.venue.update({
    where: { id: venueId },
    data: {
      name,
      emoji,
      sport,
      format,
      requireLocation,
      venueRadiusM,
      ...(venueLat != null && venueLng != null ? { venueLat, venueLng } : {}),
    },
  });
  redirect(`/venues/${venueId}?saved=1`);
}

// ---------------- Venue logo (replaces the emoji mark when set) ----------------

// Uploads are normalized server-side (sharp): center-cropped square,
// 256px, WebP — crisp at every size the mark renders, tiny in the DB.
const LOGO_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const LOGO_SIZE_PX = 256;

export async function uploadVenueLogo(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  await requireVenueHost(venueId);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/venues/${venueId}?logoError=empty`);
  }
  if (file.size > LOGO_MAX_UPLOAD_BYTES) {
    redirect(`/venues/${venueId}?logoError=size`);
  }

  let logo: Uint8Array<ArrayBuffer>;
  try {
    const sharp = (await import("sharp")).default;
    logo = new Uint8Array(
      await sharp(Buffer.from(await file.arrayBuffer()))
        .rotate() // apply EXIF orientation before it's stripped
        .resize(LOGO_SIZE_PX, LOGO_SIZE_PX, { fit: "cover" })
        .webp({ quality: 90 })
        .toBuffer()
    );
  } catch {
    // Not an image sharp can decode.
    redirect(`/venues/${venueId}?logoError=type`);
  }

  await db.venue.update({
    where: { id: venueId },
    data: { logo, logoType: "image/webp", logoUpdatedAt: new Date() },
  });
  redirect(`/venues/${venueId}?saved=1`);
}

/**
 * Deletes a venue. Non-destructive to game history: nights keep existing
 * as ordinary leagues (League.venueId is ON DELETE SET NULL) with their
 * members, picks, and results — only the venue container, its regulars
 * board, saved defaults, and logo go away.
 */
export async function deleteVenue(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  await requireVenueHost(venueId);
  await db.venue.delete({ where: { id: venueId } });
  redirect("/dashboard?venueDeleted=1");
}

export async function removeVenueLogo(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  await requireVenueHost(venueId);
  await db.venue.update({
    where: { id: venueId },
    data: { logo: null, logoType: null, logoUpdatedAt: null },
  });
  redirect(`/venues/${venueId}?saved=1`);
}
