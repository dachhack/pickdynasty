"use client";

import { useState } from "react";

/**
 * Captures browser geolocation into hidden form inputs. Used by the join
 * flow (prove you're at the venue) and by commissioners (set the venue
 * point). Server-side distance check is the source of truth.
 */
export default function LocationField({
  latName = "lat",
  lngName = "lng",
  label = "📍 Share my location",
  hint,
  showCoords = false,
}: {
  latName?: string;
  lngName?: string;
  label?: string;
  hint?: string;
  showCoords?: boolean;
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  const capture = () => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("This browser can't share location.");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ok");
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location was blocked — allow it in your browser and try again."
            : "Couldn't get a location fix. Try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  return (
    <div>
      {coords && (
        <>
          <input type="hidden" name={latName} value={coords.lat} />
          <input type="hidden" name={lngName} value={coords.lng} />
        </>
      )}
      {status === "ok" ? (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
          ✓ Location captured
          {showCoords && coords && (
            <span className="ml-2 font-mono text-xs text-emerald-400/70">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </p>
      ) : (
        <button
          type="button"
          onClick={capture}
          disabled={status === "loading"}
          className="btn-ghost !text-sm"
        >
          {status === "loading" ? "Locating…" : label}
        </button>
      )}
      {status === "error" && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {hint && status !== "ok" && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
