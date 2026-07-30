"use client";

import { useState } from "react";
import { THEMES, type Theme } from "@/lib/theme";

const UI: Record<Theme, { icon: string; label: string }> = {
  dark: { icon: "🌙", label: "Dark" },
  light: { icon: "☀️", label: "Light" },
  system: { icon: "🖥️", label: "Match device" },
};

/**
 * Cycles dark → light → system. Per-device preference in the ep_theme
 * cookie so the server renders the right theme with no flash; the
 * data-theme swap here makes the click take effect instantly.
 */
export default function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  const cycle = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `ep_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${UI[theme].label} — click to switch`}
      aria-label={`Theme: ${UI[theme].label} — click to switch`}
      className="rounded-lg border border-slate-700 px-2 py-1.5 text-sm leading-none transition hover:bg-slate-800 cursor-pointer"
    >
      {UI[theme].icon}
    </button>
  );
}
