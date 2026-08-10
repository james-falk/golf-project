import type { HoleScore, Player } from "./types";

export type Scores = Record<string, HoleScore[]>;
/** A team has no name. It is identified by who is on it. */
export type Team = { id: string; playerIds: string[] };
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
  /**
   * Players who did not play a particular round, by round. A skin is only
   * awarded once everyone in that round's field has a number on the hole, so
   * somebody who sat out has to be taken out of the field or the whole round
   * stays uncalculated. Their money stays in the pot: see `paidEntries`.
   */
  absences?: Partial<Record<RoundKey, string[]>>;
  /**
   * How many $20 entries a round was actually paid for, when that differs from
   * the size of the field. A player who pays and then does not play leaves the
   * pot untouched but stops being scored, so the two numbers come apart. Absent
   * means the round's pot is simply the field size.
   */
  paidEntries?: Partial<Record<RoundKey, number>>;
};
