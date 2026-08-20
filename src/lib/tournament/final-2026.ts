import type { TournamentState } from "./state";
import type { HoleScore } from "./types";

/**
 * The 2026 tournament, preserved exactly as it finished.
 *
 * This is the permanent record of the East Coast Big Playas 2026 Invitational,
 * copied verbatim from the production Neon ledger (final write
 * 2026-08-10T17:23:47.848Z, when the last Saturday round was posted). The site
 * serves this module instead of a database, so the record can never drift,
 * expire, or depend on external storage again.
 *
 * Nothing may edit this file except to correct a proven transcription error
 * against the source ledger. final-2026.test.ts pins the payout table this
 * data produces, so any change to a number here fails the build.
 */

/** A complete 18-hole card: strokes for holes 1 through 18, in order. */
const card = (...strokes: number[]): HoleScore[] =>
  strokes.map((value, index) => ({ holeNumber: index + 1, strokes: value }));

/** One shared record serves every request, so it is frozen against mutation. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** When the ledger was last written; served as the archive's updatedAt. */
export const final2026UpdatedAt = "2026-08-10T17:23:47.848Z";

export const final2026State = deepFreeze<TournamentState>({
  players: [
    { id: "player-1", name: "Steve", tier: "A" },
    { id: "player-2", name: "John", tier: "A" },
    { id: "player-3", name: "Roger", tier: "A" },
    { id: "player-4", name: "Jeff", tier: "A" },
    { id: "player-5", name: "Ethan", tier: "A" },
    { id: "player-6", name: "Jim", tier: "A" },
    { id: "player-7", name: "Sam", tier: "B" },
    { id: "player-8", name: "Thomas", tier: "B" },
    { id: "player-9", name: "Logan", tier: "B" },
    { id: "player-10", name: "James", tier: "B" },
    { id: "player-11", name: "Spencer", tier: "B" },
    { id: "player-12", name: "Kent", tier: "B" },
    { id: "player-13", name: "Bryce", tier: "C" },
    { id: "player-14", name: "Lucas", tier: "C" },
    { id: "player-15", name: "Mitchell", tier: "C" },
    { id: "player-16", name: "Greg", tier: "C" },
    { id: "player-17", name: "Cam", tier: "C" },
    { id: "player-18", name: "Matt", tier: "C" },
    { id: "player-19", name: "Pete", tier: "D" },
    { id: "player-20", name: "Brandon", tier: "D" },
    { id: "player-21", name: "Aiden", tier: "D" },
    { id: "player-22", name: "Jake", tier: "D" },
  ],
  skinScores: {
    // Thursday — 22 cards
    "thursday:player-1": card(5, 4, 4, 5, 4, 3, 7, 5, 4, 4, 5, 5, 4, 3, 6, 6, 5, 5),
    "thursday:player-2": card(6, 4, 4, 5, 7, 5, 4, 5, 4, 4, 5, 4, 4, 5, 4, 7, 5, 5),
    "thursday:player-3": card(4, 5, 3, 6, 6, 4, 5, 6, 3, 4, 5, 4, 3, 5, 4, 5, 3, 5),
    "thursday:player-4": card(5, 5, 4, 6, 5, 4, 6, 4, 3, 5, 5, 3, 4, 4, 4, 6, 3, 6),
    "thursday:player-5": card(5, 5, 4, 7, 4, 4, 6, 4, 4, 6, 4, 4, 4, 5, 2, 6, 3, 5),
    "thursday:player-6": card(4, 5, 4, 7, 5, 5, 4, 5, 3, 4, 7, 5, 3, 5, 4, 7, 3, 4),
    "thursday:player-7": card(5, 4, 5, 6, 6, 4, 5, 6, 4, 4, 5, 6, 3, 5, 6, 6, 4, 4),
    "thursday:player-8": card(4, 6, 4, 5, 6, 3, 5, 6, 4, 5, 6, 7, 3, 4, 6, 7, 6, 4),
    "thursday:player-9": card(6, 5, 4, 6, 4, 3, 6, 5, 3, 5, 5, 4, 3, 5, 5, 4, 4, 4),
    "thursday:player-10": card(4, 4, 4, 7, 7, 4, 5, 5, 6, 5, 5, 5, 4, 6, 5, 6, 4, 5),
    "thursday:player-11": card(6, 6, 4, 5, 4, 5, 7, 8, 4, 6, 8, 6, 5, 6, 4, 6, 4, 5),
    "thursday:player-12": card(5, 6, 6, 6, 4, 5, 7, 6, 4, 6, 5, 5, 5, 6, 7, 6, 5, 6),
    "thursday:player-13": card(8, 7, 4, 7, 8, 4, 6, 9, 5, 8, 8, 8, 5, 4, 4, 8, 5, 8),
    "thursday:player-14": card(4, 6, 4, 5, 4, 3, 7, 6, 6, 5, 8, 6, 5, 6, 4, 8, 3, 5),
    "thursday:player-15": card(6, 5, 8, 8, 6, 4, 7, 7, 4, 6, 6, 5, 5, 6, 3, 7, 5, 4),
    "thursday:player-16": card(5, 6, 7, 7, 5, 5, 8, 4, 4, 5, 6, 5, 5, 5, 4, 7, 4, 7),
    "thursday:player-17": card(4, 6, 7, 6, 5, 4, 7, 8, 5, 5, 4, 6, 2, 5, 5, 6, 5, 5),
    "thursday:player-18": card(6, 7, 5, 7, 5, 4, 8, 6, 6, 5, 8, 8, 4, 6, 3, 7, 4, 6),
    "thursday:player-19": card(7, 7, 8, 9, 5, 4, 8, 5, 6, 5, 6, 6, 5, 5, 4, 6, 4, 5),
    "thursday:player-20": card(7, 8, 6, 7, 7, 7, 9, 8, 4, 7, 6, 3, 5, 9, 8, 8, 6, 8),
    "thursday:player-21": card(6, 6, 7, 8, 7, 4, 5, 5, 4, 6, 7, 7, 4, 6, 4, 8, 6, 7),
    "thursday:player-22": card(6, 6, 4, 8, 6, 4, 6, 5, 4, 5, 6, 6, 4, 4, 4, 7, 4, 7),
    // Friday — 22 cards
    "friday:player-1": card(4, 5, 4, 6, 8, 3, 8, 4, 3, 4, 7, 6, 4, 4, 4, 6, 4, 5),
    "friday:player-2": card(4, 4, 3, 5, 6, 4, 5, 5, 3, 4, 5, 4, 4, 4, 4, 5, 3, 5),
    "friday:player-3": card(4, 3, 4, 5, 5, 3, 7, 4, 4, 4, 7, 4, 4, 3, 3, 6, 5, 6),
    "friday:player-4": card(4, 5, 3, 4, 5, 5, 6, 6, 3, 4, 6, 4, 4, 4, 4, 7, 3, 6),
    "friday:player-5": card(4, 5, 5, 5, 6, 3, 7, 4, 4, 4, 6, 4, 3, 5, 3, 6, 4, 4),
    "friday:player-6": card(4, 4, 5, 6, 5, 4, 8, 4, 5, 4, 5, 4, 4, 5, 3, 7, 3, 4),
    "friday:player-7": card(6, 6, 7, 5, 6, 5, 6, 5, 4, 6, 5, 4, 4, 4, 4, 7, 4, 5),
    "friday:player-8": card(7, 5, 7, 6, 5, 6, 6, 4, 4, 5, 6, 5, 4, 5, 4, 6, 3, 6),
    "friday:player-9": card(5, 5, 4, 5, 5, 5, 7, 4, 6, 4, 6, 4, 5, 6, 5, 5, 3, 4),
    "friday:player-10": card(5, 5, 5, 5, 5, 4, 6, 7, 5, 7, 5, 5, 3, 5, 4, 7, 5, 6),
    "friday:player-11": card(5, 6, 6, 7, 6, 5, 6, 7, 4, 5, 6, 6, 3, 5, 4, 6, 3, 6),
    "friday:player-12": card(7, 6, 4, 6, 5, 5, 6, 5, 4, 5, 6, 5, 6, 6, 6, 7, 3, 6),
    "friday:player-13": card(5, 7, 5, 8, 6, 6, 9, 7, 5, 7, 7, 4, 6, 7, 4, 7, 4, 5),
    "friday:player-14": card(5, 5, 7, 6, 8, 6, 5, 6, 6, 6, 7, 7, 4, 5, 6, 6, 6, 5),
    "friday:player-15": card(6, 5, 5, 7, 7, 5, 8, 8, 4, 5, 6, 7, 4, 4, 5, 8, 6, 5),
    "friday:player-16": card(6, 8, 6, 10, 4, 5, 10, 8, 6, 6, 9, 6, 5, 5, 5, 8, 4, 7),
    "friday:player-17": card(5, 6, 6, 6, 7, 5, 8, 6, 4, 6, 8, 6, 4, 5, 5, 7, 4, 6),
    "friday:player-18": card(6, 4, 5, 8, 6, 3, 7, 7, 6, 8, 6, 5, 5, 5, 5, 7, 4, 5),
    "friday:player-19": card(6, 6, 8, 8, 6, 3, 9, 6, 6, 8, 9, 7, 6, 5, 4, 8, 5, 6),
    "friday:player-20": card(9, 6, 8, 7, 5, 6, 6, 8, 4, 5, 6, 6, 3, 6, 7, 6, 4, 6),
    "friday:player-21": card(9, 8, 6, 8, 5, 6, 8, 8, 4, 8, 10, 8, 4, 7, 7, 6, 4, 8),
    "friday:player-22": card(5, 6, 5, 5, 7, 4, 6, 6, 3, 6, 6, 7, 4, 6, 5, 5, 4, 4),
    // Saturday — 21 cards
    "saturday:player-1": card(5, 6, 5, 6, 4, 3, 5, 4, 4, 6, 7, 5, 3, 5, 5, 6, 3, 5),
    "saturday:player-2": card(4, 3, 5, 5, 5, 4, 5, 5, 4, 5, 6, 6, 3, 6, 4, 6, 4, 5),
    "saturday:player-3": card(3, 4, 5, 5, 4, 3, 5, 6, 3, 5, 5, 4, 3, 5, 4, 5, 3, 5),
    "saturday:player-4": card(5, 5, 4, 6, 5, 4, 5, 5, 3, 7, 6, 7, 5, 5, 5, 5, 4, 4),
    "saturday:player-5": card(4, 5, 4, 5, 4, 3, 5, 6, 4, 5, 7, 4, 3, 4, 3, 4, 3, 4),
    "saturday:player-6": card(5, 4, 4, 6, 6, 3, 6, 6, 4, 5, 6, 7, 3, 4, 5, 7, 3, 6),
    "saturday:player-7": card(6, 6, 3, 6, 4, 4, 7, 6, 3, 4, 6, 5, 4, 5, 5, 7, 3, 5),
    "saturday:player-8": card(5, 6, 6, 5, 5, 4, 5, 4, 4, 4, 5, 5, 4, 5, 5, 4, 4, 4),
    "saturday:player-9": card(6, 6, 5, 5, 5, 3, 6, 5, 4, 5, 5, 6, 3, 5, 7, 10, 7, 8),
    "saturday:player-10": card(5, 5, 5, 7, 6, 3, 7, 4, 6, 4, 7, 5, 4, 5, 5, 7, 4, 5),
    "saturday:player-11": card(4, 4, 4, 4, 5, 3, 8, 5, 3, 5, 7, 5, 4, 7, 4, 6, 3, 4),
    "saturday:player-12": card(6, 5, 6, 7, 5, 4, 6, 5, 4, 5, 6, 5, 3, 5, 5, 8, 4, 7),
    "saturday:player-13": card(4, 5, 5, 6, 5, 2, 6, 4, 5, 5, 5, 6, 4, 6, 3, 7, 4, 5),
    "saturday:player-14": card(5, 8, 4, 6, 6, 3, 6, 5, 3, 5, 6, 4, 4, 5, 4, 5, 4, 5),
    "saturday:player-15": card(6, 5, 5, 7, 5, 3, 8, 7, 5, 4, 8, 4, 3, 5, 4, 5, 5, 5),
    "saturday:player-16": card(5, 6, 6, 7, 6, 3, 7, 5, 4, 5, 7, 6, 5, 5, 3, 7, 5, 7),
    "saturday:player-17": card(4, 7, 4, 6, 6, 4, 7, 4, 6, 5, 5, 4, 4, 4, 5, 6, 4, 5),
    "saturday:player-19": card(7, 6, 6, 5, 5, 6, 6, 7, 3, 5, 6, 7, 4, 6, 5, 8, 5, 8),
    "saturday:player-20": card(8, 5, 5, 6, 8, 4, 8, 6, 4, 5, 4, 5, 4, 5, 5, 6, 5, 5),
    "saturday:player-21": card(8, 8, 7, 7, 5, 3, 8, 4, 6, 7, 8, 8, 3, 7, 5, 6, 4, 7),
    "saturday:player-22": card(5, 7, 6, 5, 6, 3, 6, 6, 5, 4, 6, 6, 5, 4, 5, 7, 3, 6),
  },
  skinOfficialTotals: {},
  closestToPin: {
    "thursday:6": "player-4",
    "thursday:9": "player-21",
    "thursday:13": "player-17",
    "thursday:17": "player-6",
    "friday:6": "player-6",
    "friday:9": "player-6",
    "friday:13": "player-11",
    "friday:17": "player-4",
    "saturday:6": "player-6",
    "saturday:9": "player-19",
    "saturday:13": "player-2",
    "saturday:17": "player-13",
  },
  teamsByDay: {
    // A scramble team exists only because its result was reported; on Friday
    // only the two teams in the money were ever reported.
    friday: [
      { id: "team-1", playerIds: ["player-3", "player-11", "player-17"] },
      { id: "team-2", playerIds: ["player-2", "player-10", "player-13", "player-19"] },
    ],
    saturday: [
      { id: "team-1", playerIds: ["player-3", "player-11", "player-15", "player-22"] },
      { id: "team-2", playerIds: ["player-5", "player-20", "player-17", "player-16"] },
      { id: "team-3", playerIds: ["player-4", "player-10", "player-8", "player-14"] },
      { id: "team-4", playerIds: ["player-6", "player-19", "player-7", "player-12"] },
      { id: "team-5", playerIds: ["player-2", "player-1", "player-21", "player-13"] },
    ],
  },
  scrambleScores: {},
  scrambleOfficialTotals: {
    "friday:team-1": "60",
    "friday:team-2": "63",
    "saturday:team-1": "67",
    "saturday:team-2": "66",
    "saturday:team-3": "61",
    "saturday:team-4": "68",
    "saturday:team-5": "67",
  },
  postings: {
    "skins-thursday": { status: "posted", postedAt: "2026-08-07T04:02:06.611Z", revision: 2 },
    "skins-friday": { status: "posted", postedAt: "2026-08-10T16:49:53.947Z", revision: 2 },
    "scramble-friday": { status: "posted", postedAt: "2026-08-10T14:23:30.549Z", revision: 1 },
    "skins-saturday": { status: "posted", postedAt: "2026-08-10T17:23:47.841Z", revision: 2 },
    "scramble-saturday": { status: "posted", postedAt: "2026-08-10T15:17:44.998Z", revision: 1 },
  },
  // Matt sat out Saturday skins; his paid entry stayed in that round's pot.
  absences: { "skins-saturday": ["player-18"] },
});
