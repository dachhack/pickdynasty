"use client";

import { useState } from "react";
import { tapHaptic } from "@/components/boards/celebrate";

/**
 * Fetches the member's personal result card and hands it to the phone's
 * share sheet (Web Share API with files); falls back to a download on
 * desktop browsers that can't share files.
 */
export default function ShareCardButton({
  leagueId,
  slateId,
  label = "📸 Share my card",
}: {
  leagueId: string;
  slateId: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function share() {
    setBusy(true);
    setError("");
    tapHaptic();
    try {
      const res = await fetch(`/api/leagues/${leagueId}/card/${slateId}`);
      if (!res.ok) throw new Error("card failed");
      const blob = await res.blob();
      const file = new File([blob], "epic-pickem.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Epic Pick'em",
          text: "My Epic Pick'em week — think you can beat me? epicpickem.com",
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "epic-pickem.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // AbortError = user closed the share sheet — not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError("Couldn't build your card — try again.");
      }
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={share} disabled={busy} className="btn-ghost !px-2.5 !py-1 !text-xs">
        {busy ? "Building…" : label}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
