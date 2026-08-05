import { describe, expect, it } from "vitest";
import { makeMockTournamentState } from "./mock-state";
import { applyHermesScoringCommand } from "./hermes-command";
import type { TournamentState } from "./state";

const card = [4, 5, 4, 5, 4, 3, 5, 4, 3, 4, 5, 4, 3, 4, 4, 5, 3, 4];

/** The mock board ships every round posted; scoring commands need an open round. */
function openBoard(): TournamentState {
  const state = makeMockTournamentState();
  return {
    ...state,
    postings: Object.fromEntries(
      Object.entries(state.postings).map(([key, posting]) => [key, { ...posting!, status: "review" as const }]),
    ),
  };
}

describe("Hermes scoring commands", () => {
  it("saves a complete player card by name", () => {
    const result = applyHermesScoringCommand(openBoard(), { type: "player-card", day: "thursday", player: "Ethan", scores: card });
    expect(result.total).toBe(73);
    expect(result.state.skinScores["thursday:player-5"]).toHaveLength(18);
  });

  it("corrects one player hole without replacing the remaining card", () => {
    const initial = applyHermesScoringCommand(openBoard(), { type: "player-card", day: "friday", player: "Ethan", scores: card }).state;
    const result = applyHermesScoringCommand(initial, { type: "player-hole", day: "friday", player: "Ethan", hole: 7, strokes: 6 });
    expect(result.state.skinScores["friday:player-5"].find((score) => score.holeNumber === 7)?.strokes).toBe(6);
    expect(result.state.skinScores["friday:player-5"]).toHaveLength(18);
  });

  it("records a closest-to-pin winner", () => {
    const result = applyHermesScoringCommand(openBoard(), { type: "ctp", day: "saturday", hole: 6, player: "James" });
    expect(result.state.closestToPin["saturday:6"]).toBe("player-10");
  });

  it("rejects malformed cards and Thursday scramble", () => {
    expect(() => applyHermesScoringCommand(openBoard(), { type: "player-card", day: "thursday", player: "Ethan", scores: [4, 5] })).toThrow("exactly 18");
    expect(() => applyHermesScoringCommand(openBoard(), { type: "round-status", day: "thursday", round: "scramble", status: "posted" })).toThrow("no Thursday scramble");
  });
});
