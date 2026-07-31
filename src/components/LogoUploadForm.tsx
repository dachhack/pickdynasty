"use client";

import { useState } from "react";
import { uploadVenueLogo } from "@/actions/venues";

const MAX_MB = 8;

/**
 * Venue logo upload form. The size check runs client-side too because a
 * file past Next's server-action transport cap dies with a bare 500
 * before the action's friendly redirect can happen — so never send it.
 */
export default function LogoUploadForm({ venueId }: { venueId: string }) {
  const [error, setError] = useState("");

  return (
    <form
      action={uploadVenueLogo}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem("logo") as HTMLInputElement;
        const file = input.files?.[0];
        if (file && file.size > MAX_MB * 1024 * 1024) {
          e.preventDefault();
          setError(
            `That file is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${MAX_MB} MB. Shrink it and try again.`
          );
          return;
        }
        setError("");
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="venueId" value={venueId} />
      <input
        type="file"
        name="logo"
        accept="image/*"
        required
        className="text-sm text-slate-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-200"
      />
      <button className="btn !text-sm">Upload</button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </form>
  );
}
