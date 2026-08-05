import { describe, expect, it } from "vitest";
import { calculatePlayerPayoutBreakdowns } from "./payouts";

const players = [
  { id: "a", name: "A", tier: "A" as const },
  { id: "b", name: "B", tier: "B" as const },
  { id: "c", name: "C", tier: "C" as const },
  { id: "d", name: "D", tier: "D" as const },
];

describe("calculatePlayerPayoutBreakdowns", () => {
  it("combines skins, CTP, and each player's scramble share", () => {
    const rows = calculatePlayerPayoutBreakdowns(players, [{
      results: [
        { holeNumber: 1, winnerId: "a", isTie: false, isComplete: true },
        { holeNumber: 2, winnerId: "a", isTie: false, isComplete: true },
        { holeNumber: 3, winnerId: "b", isTie: false, isComplete: true },
      ],
      payoutByHole: { 1: 40, 2: 40, 3: 40 },
      closestToPinWinnerIds: ["b", "a"],
    }], [{
      teams: [{ id: "team-1", name: "One", playerIds: ["a", "b", "c", "d"] }],
      payouts: [{ teamId: "team-1", place: 1, teamPayout: 240 }],
    }], 20);

    expect(rows.find((row) => row.playerId === "a")).toEqual({ playerId: "a", skins: 80, closestToPin: 20, scramble: 60, total: 160 });
    expect(rows.find((row) => row.playerId === "b")).toEqual({ playerId: "b", skins: 40, closestToPin: 20, scramble: 60, total: 120 });
    expect(rows.find((row) => row.playerId === "c")?.total).toBe(60);
  });

  it("splits tied team payouts by the actual team size", () => {
    const rows = calculatePlayerPayoutBreakdowns(players.slice(0, 2), [], [{
      teams: [{ id: "team-1", name: "One", playerIds: ["a", "b"] }],
      payouts: [{ teamId: "team-1", place: 1, teamPayout: 180 }],
    }], 20);
    expect(rows.map((row) => row.scramble)).toEqual([90, 90]);
  });
});
