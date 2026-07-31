// Serializable game view passed from the server picks page to the client boards.
export type OtherPick = {
  teamName: string;
  teamColor: string;
  teamEmoji: string;
  choice: "HOME" | "AWAY";
  confidence: number | null;
  correct: boolean | null; // null = game not decided
};

export type GameView = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTimeLabel: string;
  locked: boolean;
  winner: "HOME" | "AWAY" | "TIE" | null;
  homeScore: number | null;
  awayScore: number | null;
  spread: number | null;
  isFantasy: boolean;
  // 🎯 Player prop: homeTeam/awayTeam already carry "Under x.5"/"Over x.5"
  // button text; this adds the headline and (once final) the actual stat.
  prop: { label: string; actual: number | null } | null;
  burnedHome: boolean;
  burnedAway: boolean;
  myChoice: "HOME" | "AWAY" | null;
  myConfidence: number | null;
  others: OtherPick[] | null; // null = blind (hidden until lock)
};

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message?: string }
  | { kind: "error"; message: string };
