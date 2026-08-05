import type { HoleScore, Player } from "./types";

export type Scores = Record<string, HoleScore[]>;
export type Team = { id: string; name: string; playerIds: string[] };
export type SkinDay = "thursday" | "friday" | "saturday";
export type ScrambleDay = "friday" | "saturday";
export type RoundKey = `skins-${SkinDay}` | `scramble-${ScrambleDay}`;
export type RoundPosting = {
  status: "review" | "posted";
  postedAt?: string;
  revision: number;
};

export type TournamentState = {
  players: Player[];
  skinScores: Scores;
  skinOfficialTotals: Record<string, string>;
  closestToPin: Record<string, string>;
  teamsByDay: Record<"friday" | "saturday", Team[]>;
  scrambleScores: Scores;
  scrambleOfficialTotals: Record<string, string>;
  postings: Partial<Record<RoundKey, RoundPosting>>;
  /**
   * Set once, when the commissioner starts the tournament for real. While it is
   * present the stored ledger is authoritative: nothing reseeds it, and the site
   * cannot change the roster or the teams. Clearing it is a backend-only action.
   */
  lockedAt?: string;
};
