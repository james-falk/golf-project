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

export const startingRoster: Player[] = [
  ["Steve", "A"], ["John", "A"], ["Roger", "A"], ["Jeff", "A"], ["Ethan", "A"], ["Jim", "A"],
  ["Sam", "B"], ["Thomas", "B"], ["Logan", "B"], ["James", "B"], ["Spencer", "B"], ["Kent", "B"],
  ["Bryce", "C"], ["Tate", "C"], ["Lucas", "C"], ["Mitchell", "C"], ["Greg", "C"], ["Cam", "C"],
  ["Pete", "D"], ["Brandon", "D"], ["Matt", "D"], ["Aiden", "D"], ["Jake", "D"], ["Maxwell", "D"],
].map(([name, tier], index) => ({ id: `player-${index + 1}`, name, tier: tier as Player["tier"] }));
