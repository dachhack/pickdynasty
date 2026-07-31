import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SPORTS } from "@/lib/sports";
import { FORMATS } from "@/lib/formats";
import { VENUE_RADIUS_OPTIONS } from "@/lib/geo";
import { createStandaloneVenue } from "@/actions/venues";
import LocationField from "@/components/LocationField";

/** Venue-first flow: set up the bar, then start game nights from its console. */
export default async function NewVenuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/venues/new");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-black">🍻 Set up a venue</h1>
      <p className="mt-2 text-sm text-slate-400">
        For bars and recurring watch parties: one venue, many game nights. You get a
        one-tap &ldquo;start tonight&rsquo;s game&rdquo;, an all-time <em>bar regulars</em>{" "}
        leaderboard across nights, and a permanent TV link you bookmark once.
      </p>
      <form action={createStandaloneVenue} className="card mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label" htmlFor="name">Venue name</label>
            <input className="input" id="name" name="name" required maxLength={60} placeholder="Murphy's Taproom" />
          </div>
          <div>
            <label className="label" htmlFor="emoji">Icon (emoji)</label>
            <input className="input" id="emoji" name="emoji" defaultValue="🍺" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="sport">Usual sport</label>
          <select className="input" id="sport" name="sport" defaultValue="nfl">
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Just the default for new nights — any night can mix in games from other sports.
          </p>
        </div>
        <div>
          <span className="label">Night format</span>
          <div className="flex flex-col gap-2">
            {FORMATS.map((f, i) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500"
              >
                <input
                  type="radio"
                  name="format"
                  value={f.id}
                  defaultChecked={i === 0}
                  className="mt-1 h-4 w-4 accent-indigo-500"
                />
                <span>
                  <span className="text-sm font-semibold">{f.emoji} {f.label}</span>
                  <span className="block text-xs text-slate-400">{f.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-slate-800 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="requireLocation"
              className="h-4 w-4 accent-indigo-500"
            />
            📍 Venue-only entry — joiners must share a location near the venue
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <LocationField
              latName="venueLat"
              lngName="venueLng"
              label="📍 Set venue to my current location"
              hint="Best done from your phone, standing at the venue. You can also do this later."
              showCoords
            />
            <div>
              <label className="label" htmlFor="venueRadiusM">Radius</label>
              <select className="input" id="venueRadiusM" name="venueRadiusM" defaultValue={150}>
                {VENUE_RADIUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <button className="btn">Create venue</button>
      </form>
    </div>
  );
}
