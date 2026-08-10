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
      teams: [{ id: "team-1", playerIds: ["a", "b", "c", "d"] }],
      payouts: [{ teamId: "team-1", place: 1, teamPayout: 240 }],
    }], 20);

    expect(rows.find((row) => row.playerId === "a")).toEqual({ playerId: "a", skins: 80, closestToPin: 20, scramble: 60, total: 160 });
    expect(rows.find((row) => row.playerId === "b")).toEqual({ playerId: "b", skins: 40, closestToPin: 20, scramble: 60, total: 120 });
    expect(rows.find((row) => row.playerId === "c")?.total).toBe(60);
  });

  it("splits tied team payouts by the actual team size", () => {
    const rows = calculatePlayerPayoutBreakdowns(players.slice(0, 2), [], [{
      teams: [{ id: "team-1", playerIds: ["a", "b"] }],
      payouts: [{ teamId: "team-1", place: 1, teamPayout: 180 }],
    }], 20);
    expect(rows.map((row) => row.scramble)).toEqual([90, 90]);
  });
});

describe("2025 parity", () => {
  it("rounds a team share down, so an uneven team matches the old board", () => {
    // 23 players: five teams of four and one of three. First place is $380.
    const threePlayerTeam = { id: "team-6", playerIds: ["x", "y", "z"] };
    const [share] = calculatePlayerPayoutBreakdowns(
      [{ id: "x", name: "X", tier: "A" }],
      [],
      [{ teams: [threePlayerTeam], payouts: [{ teamId: "team-6", place: 1, teamPayout: 380 }] }],
      20,
    );
    // 380 / 3 = 126.66…; the 2025 board paid 126.
    expect(share.scramble).toBe(126);
    expect(Number.isInteger(share.total)).toBe(true);
  });
});
