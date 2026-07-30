// User-selectable UI theme (dark is the house default). The choice lives in
// the ep_theme cookie — per device, works for guests, no DB involved. The
// root layout stamps it on <html data-theme>, globals.css does the rest.

export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(raw: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(raw ?? "") ? (raw as Theme) : "dark";
}
