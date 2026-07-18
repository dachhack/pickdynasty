"use client";

import confetti from "canvas-confetti";

/** Tiny haptic tick on supported mobile browsers. */
export function tapHaptic() {
  if (typeof navigator !== "undefined") navigator.vibrate?.(10);
}

/** Full celebration: confetti volley + haptic pattern. */
export function celebrate() {
  if (typeof navigator !== "undefined") navigator.vibrate?.([30, 40, 60]);
  const colors = ["#6366f1", "#34d399", "#fbbf24", "#f472b6"];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors });
  setTimeout(
    () => confetti({ particleCount: 45, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors }),
    150
  );
  setTimeout(
    () => confetti({ particleCount: 45, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors }),
    300
  );
}
