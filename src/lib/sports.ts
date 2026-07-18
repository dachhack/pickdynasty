export const SPORTS = [
  { id: "nfl", label: "NFL", emoji: "🏈" },
  { id: "cfb", label: "College Football", emoji: "🏈" },
  { id: "nba", label: "NBA", emoji: "🏀" },
  { id: "cbb", label: "College Basketball", emoji: "🏀" },
  { id: "march-madness", label: "March Madness", emoji: "🌪️" },
  { id: "mlb", label: "MLB", emoji: "⚾" },
  { id: "cws", label: "College World Series", emoji: "⚾" },
  { id: "llws", label: "Little League World Series", emoji: "⚾" },
  { id: "nhl", label: "NHL", emoji: "🏒" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "mls", label: "MLS", emoji: "⚽" },
  { id: "soccer", label: "Soccer (other)", emoji: "⚽" },
  { id: "golf", label: "Golf", emoji: "⛳" },
  { id: "other", label: "Other", emoji: "🏆" },
] as const;

export function sportLabel(id: string): string {
  const s = SPORTS.find((s) => s.id === id);
  return s ? s.label : id;
}

export function sportEmoji(id: string): string {
  const s = SPORTS.find((s) => s.id === id);
  return s ? s.emoji : "🏆";
}
