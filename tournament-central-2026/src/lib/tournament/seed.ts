import type { Course, Player } from "./types";

export const tributeCourse: Course = {
  id: "tribute",
  name: "The Tribute — Otsego Club",
  holes: [
    [4, 13], [4, 9], [4, 17], [5, 7], [4, 5], [3, 11], [5, 3], [4, 1], [3, 15],
    [4, 12], [5, 8], [4, 6], [3, 14], [4, 4], [4, 16], [5, 2], [3, 18], [4, 10],
  ].map(([par, strokeIndex], index) => ({ number: index + 1, par, strokeIndex })),
};

export const startingRoster: Player[] = [
  ["Ethan", "A"], ["John Porth", "A"], ["Roger", "A"], ["Jeff Felts", "A"], ["Robert", "A"],
  ["Steve", "B"], ["James", "B"], ["Kent", "B"], ["Thomas", "B"], ["Spencer", "B"],
  ["Ken", "C"], ["Bryce", "C"], ["Lucas", "C"], ["Tate", "C"], ["Mitchell", "C"],
  ["Maxwell", "D"], ["Greg", "D"], ["Pete", "D"],
].map(([name, tier], index) => ({ id: `player-${index + 1}`, name, tier: tier as Player["tier"] }));
