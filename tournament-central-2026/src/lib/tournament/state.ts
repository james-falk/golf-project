import type { HoleScore, Player } from "./types";

export type Scores = Record<string, HoleScore[]>;
export type Team = { id: string; name: string; playerIds: string[] };

export type TournamentState = {
  players: Player[];
  skinScores: Scores;
  skinOfficialTotals: Record<string, string>;
  closestToPin: Record<string, string>;
  teamsByDay: Record<"friday" | "saturday", Team[]>;
  scrambleScores: Scores;
  scrambleOfficialTotals: Record<string, string>;
};
