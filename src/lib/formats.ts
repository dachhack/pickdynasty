// League formats. The format changes how picks are made and scored;
// slates, blind picks, money, and result sync work identically in all of them.

export const FORMATS = [
  {
    id: "classic",
    label: "Classic pick'em",
    emoji: "✅",
    blurb: "Pick every game's winner. 1 point per correct pick.",
  },
  {
    id: "confidence",
    label: "Confidence points",
    emoji: "🎯",
    blurb:
      "Pick every game AND rank your confidence 1–N. Correct picks score their rank, so your surest pick is worth the most.",
  },
  {
    id: "survivor",
    label: "Survivor",
    emoji: "💀",
    blurb:
      "Pick ONE team per slate. Win and you advance — but you can never pick that team again. Lose (or forget to pick) and you're out.",
  },
  {
    id: "spread",
    label: "Against the spread",
    emoji: "📏",
    blurb:
      "Pick winners against the point spread (imported from ESPN odds). Favorites must cover; underdogs can lose and still win you the pick.",
  },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];

export function formatMeta(id: string) {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

/** Formats where every game gets a pick (vs survivor's one pick per slate). */
export function picksEveryGame(format: string): boolean {
  return format !== "survivor";
}

/** Label helper: "Michigan -3.5" / "Ohio State +3.5" for spread leagues. */
export function spreadLabel(side: "HOME" | "AWAY", spread: number | null): string {
  if (spread == null) return "";
  const line = side === "HOME" ? spread : -spread;
  return ` ${line > 0 ? "+" : ""}${line}`;
}

/** Against-the-spread result from a final score. */
export function atsWinner(
  homeScore: number,
  awayScore: number,
  spread: number
): "HOME" | "AWAY" | "TIE" {
  const adjusted = homeScore + spread - awayScore;
  return adjusted > 0 ? "HOME" : adjusted < 0 ? "AWAY" : "TIE";
}
