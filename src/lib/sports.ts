export type Sport = {
  key: string;
  label: string;
  emoji: string;
  roundLabel: string; // what a "slate" of games is called in this sport
};

export const SPORTS: Sport[] = [
  { key: "NFL", label: "NFL", emoji: "🏈", roundLabel: "Week" },
  { key: "CFB", label: "College Football", emoji: "🏈", roundLabel: "Week" },
  { key: "NBA", label: "NBA", emoji: "🏀", roundLabel: "Slate" },
  { key: "CBB", label: "College Basketball", emoji: "🏀", roundLabel: "Slate" },
  { key: "MARCH_MADNESS", label: "March Madness", emoji: "🌪️", roundLabel: "Round" },
  { key: "MLB", label: "MLB", emoji: "⚾", roundLabel: "Series" },
  { key: "CWS", label: "College World Series", emoji: "⚾", roundLabel: "Round" },
  { key: "LLWS", label: "Little League World Series", emoji: "⚾", roundLabel: "Round" },
  { key: "NHL", label: "NHL", emoji: "🏒", roundLabel: "Slate" },
  { key: "TENNIS", label: "Tennis", emoji: "🎾", roundLabel: "Round" },
  { key: "MLS", label: "MLS", emoji: "⚽", roundLabel: "Matchday" },
  { key: "SOCCER", label: "Soccer (International)", emoji: "⚽", roundLabel: "Matchday" },
  { key: "GOLF", label: "Golf", emoji: "⛳", roundLabel: "Round" },
  { key: "OTHER", label: "Other", emoji: "🎯", roundLabel: "Round" },
];

export function sportByKey(key: string): Sport {
  return SPORTS.find((s) => s.key === key) ?? SPORTS[SPORTS.length - 1];
}
