import type { Course, Player } from "./types";

export const tributeCourse: Course = {
  id: "tribute",
  name: "The Tribute — Otsego Club",
  holes: [
    [4, 13], [4, 9], [4, 17], [5, 7], [4, 5], [3, 11], [5, 3], [4, 1], [3, 15],
    [4, 12], [5, 8], [4, 6], [3, 14], [4, 4], [4, 16], [5, 2], [3, 18], [4, 10],
  ].map(([par, strokeIndex], index) => ({ number: index + 1, par, strokeIndex })),
};

export const classicCourse: Course = {
  id: "classic",
  name: "The Classic — Otsego Club",
  holes: [
    [5, 1], [4, 11], [4, 9], [4, 3], [5, 5], [3, 13], [4, 7], [3, 17], [4, 15],
    [5, 4], [4, 18], [5, 8], [3, 10], [4, 6], [3, 14], [4, 2], [4, 12], [4, 16],
  ].map(([par, strokeIndex], index) => ({ number: index + 1, par, strokeIndex })),
};

/**
 * The confirmed 2026 field. Ids are explicit and permanent: scores, teams and
 * CTP winners are all keyed by id, so an id must never be reused or reassigned
 * to a different player. Add a player by appending the next free id; drop one by
 * deleting the row and retiring its id for good.
 */
export const startingRoster: Player[] = [
  ["player-1", "Steve", "A"], ["player-2", "John", "A"], ["player-3", "Roger", "A"],
  ["player-4", "Jeff", "A"], ["player-5", "Ethan", "A"], ["player-6", "Jim", "A"],
  ["player-7", "Sam", "B"], ["player-8", "Thomas", "B"], ["player-9", "Logan", "B"],
  ["player-10", "James", "B"], ["player-11", "Spencer", "B"], ["player-12", "Kent", "B"],
  ["player-13", "Bryce", "C"], ["player-14", "Lucas", "C"], ["player-15", "Mitchell", "C"],
  ["player-16", "Greg", "C"], ["player-17", "Cam", "C"], ["player-18", "Matt", "C"],
  ["player-19", "Pete", "D"], ["player-20", "Brandon", "D"], ["player-21", "Aiden", "D"],
  ["player-22", "Jake", "D"],
].map(([id, name, tier]) => ({ id, name, tier: tier as Player["tier"] }));

export function makeTeams(players: Player[]) {
  const teamCount = 6;
  return Array.from({ length: teamCount }, (_, teamIndex) => ({
    id: `team-${teamIndex + 1}`,
    playerIds: players.filter((_, playerIndex) => playerIndex % teamCount === teamIndex).map((player) => player.id),
  }));
}
