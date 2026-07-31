"use client";

import { useSyncExternalStore } from "react";

const subscribeFullscreen = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};
const subscribeNever = () => () => {};

/**
 * Floating fullscreen toggle for the TV boards — one tap when setting up
 * the bar screen, Esc (or tap again) to leave. Hidden on browsers without
 * the Fullscreen API (e.g. iPhone Safari).
 */
export default function FullscreenButton() {
  const active = useSyncExternalStore(
    subscribeFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false
  );
  const supported = useSyncExternalStore(
    subscribeNever,
    () => Boolean(document.documentElement.requestFullscreen),
    () => false
  );

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 opacity-60 backdrop-blur transition hover:opacity-100 cursor-pointer"
    >
      {active ? "✕ Exit full screen" : "⛶ Full screen"}
    </button>
  );
}
