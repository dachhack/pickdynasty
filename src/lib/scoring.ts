type ScorableGame = {
  id: string;
  winner: string | null;
  spread: number | null;
  homeScore: number | null;
  awayScore: number | null;
  points: number;
  locksAt: Date;
};

type ScorablePick = { gameId: string; choice: string };

export function gameIsFinal(game: ScorableGame): boolean {
  return game.winner !== null && game.winner !== "VOID";
}

export function gameIsLocked(game: ScorableGame, now = new Date()): boolean {
  return game.locksAt.getTime() <= now.getTime();
}

/**
 * Returns HOME/AWAY/PUSH for who covered, honoring the spread when the league
 * plays against the spread and scores are recorded; falls back to the admin's
 * declared winner otherwise.
 */
export function coveringSide(game: ScorableGame, pickType: string): string | null {
  if (!gameIsFinal(game)) return null;
  if (
    pickType === "AGAINST_SPREAD" &&
    game.spread !== null &&
    game.homeScore !== null &&
    game.awayScore !== null
  ) {
    // Home spread of -3.5 means home is favored by 3.5: home covers when margin beats the spread.
    const margin = game.homeScore - game.awayScore + game.spread;
    if (margin > 0) return "HOME";
    if (margin < 0) return "AWAY";
    return "PUSH";
  }
  return game.winner; // HOME | AWAY | TIE
}

export type MemberScore = {
  membershipId: string;
  correct: number;
  incorrect: number;
  pushes: number;
  points: number;
  picksMade: number;
};

export function scoreMember(
  membershipId: string,
  picks: ScorablePick[],
  games: ScorableGame[],
  pickType: string
): MemberScore {
  const gameMap = new Map(games.map((g) => [g.id, g]));
  let correct = 0;
  let incorrect = 0;
  let pushes = 0;
  let points = 0;
  for (const pick of picks) {
    const game = gameMap.get(pick.gameId);
    if (!game || !gameIsFinal(game)) continue;
    const result = coveringSide(game, pickType);
    if (result === "PUSH" || result === "TIE") {
      pushes += 1;
    } else if (result === pick.choice) {
      correct += 1;
      points += game.points;
    } else {
      incorrect += 1;
    }
  }
  return { membershipId, correct, incorrect, pushes, points, picksMade: picks.length };
}
