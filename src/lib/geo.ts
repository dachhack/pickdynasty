// Venue geofence for event-night leagues. Coordinates are client-reported
// browser geolocation — a deterrent against couch players, not proof of
// presence, so this is only ever used as an OPTIONAL join gate.

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Indoor GPS is easily tens of meters off; joiners get this much slack
// beyond the venue radius before being turned away.
export const GPS_GRACE_M = 75;

type VenueLeague = {
  requireLocation: boolean;
  venueLat: number | null;
  venueLng: number | null;
  venueRadiusM: number;
};

/**
 * Null when the joiner passes the league's venue check (or the league
 * doesn't have one); otherwise a player-facing error message.
 */
export function venueCheckError(
  league: VenueLeague,
  lat: number | null,
  lng: number | null
): string | null {
  if (!league.requireLocation || league.venueLat == null || league.venueLng == null) {
    return null;
  }
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "This league only lets people at the venue join — share your location to play.";
  }
  const d = distanceMeters(lat, lng, league.venueLat, league.venueLng);
  if (d > league.venueRadiusM + GPS_GRACE_M) {
    const away = d >= 2000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
    return `You look about ${away} from the venue — this league only lets people at the venue join.`;
  }
  return null;
}

export const VENUE_RADIUS_OPTIONS = [
  { value: 100, label: "100 m — inside the building" },
  { value: 150, label: "150 m — the venue + patio" },
  { value: 300, label: "300 m — the block" },
  { value: 1000, label: "1 km — the neighborhood" },
] as const;
