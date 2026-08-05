import { describe, expect, it } from "vitest";
import { confirmed2026Rules } from "./config";
import { makeMockTournamentState } from "./mock-state";
import { calculatePlayerPayoutBreakdowns } from "./payouts";
import { calculateScramblePayouts, calculateSkinPayouts, calculateSkins, skinRoundPot } from "./rules";
import { classicCourse, startingRoster, tributeCourse } from "./seed";

const cardKey = (day: string, id: string | number) => `${day}:${id}`;
const total = (scores: Array<{ strokes: number }>) => scores.reduce((sum, score) => sum + score.strokes, 0);

describe("2026 five-round mock tournament", () => {
  const state = makeMockTournamentState();

  it("uses the confirmed 23-player field with Tate removed", () => {
    expect(startingRoster).toHaveLength(23);
    expect(startingRoster.some((player) => player.name === "Tate")).toBe(false);
    expect(state.players).toHaveLength(23);
    expect((["A", "B", "C", "D"] as const).map((tier) => startingRoster.filter((player) => player.tier === tier).length)).toEqual([6, 6, 6, 5]);
    expect(startingRoster.find((player) => player.name === "Matt")?.tier).toBe("C");
  });

  it("keys every player by a unique id so scores are never reassigned", () => {
    expect(new Set(startingRoster.map((player) => player.id)).size).toBe(startingRoster.length);
    expect(new Set(startingRoster.map((player) => player.name)).size).toBe(startingRoster.length);
    expect(state.teamsByDay.friday.map((team) => team.playerIds.length)).toEqual([4, 4, 4, 4, 4, 3]);
    expect(state.teamsByDay.saturday.map((team) => team.playerIds.length)).toEqual([4, 4, 4, 4, 4, 3]);
    for (const day of ["friday", "saturday"] as const) {
      const assignedPlayers = state.teamsByDay[day].flatMap((team) => team.playerIds);
      expect(new Set(assignedPlayers).size).toBe(23);
      expect([...assignedPlayers].sort()).toEqual(state.players.map((player) => player.id).sort());
    }
  });

  it("reconciles the $2,300 tournament and daily pots", () => {
    const round = skinRoundPot(state.players.length, confirmed2026Rules.skinRound).total;
    expect(round).toBe(460);
    expect(round * 5).toBe(2300);
    expect(round).toBe(460);
    expect(round * 2).toBe(920);
  });

  it("contains complete, matching cards and all CTP winners for every skins round", () => {
    for (const day of ["thursday", "friday", "saturday"] as const) {
      const scoresByPlayer = Object.fromEntries(state.players.map((player) => [player.id, state.skinScores[cardKey(day, player.id)]]));
      const results = calculateSkins(state.players, tributeCourse, scoresByPlayer, confirmed2026Rules.skinRound);
      expect(results.every((result) => result.isComplete)).toBe(true);
      expect(results.some((result) => result.winnerId)).toBe(true);
      state.players.forEach((player) => {
        const scores = state.skinScores[cardKey(day, player.id)];
        expect(scores).toHaveLength(18);
        expect(state.skinOfficialTotals[cardKey(day, player.id)]).toBe(String(total(scores)));
      });
      confirmed2026Rules.skinRound.closestToPinHoleNumbers.forEach((hole) => expect(state.closestToPin[cardKey(day, hole)]).toBeTruthy());
    }
  });

  it("contains complete, matching cards for every scramble team", () => {
    for (const day of ["friday", "saturday"] as const) {
      state.teamsByDay[day].forEach((team) => {
        const scores = state.scrambleScores[cardKey(day, team.id)];
        expect(scores).toHaveLength(18);
        expect(state.scrambleOfficialTotals[cardKey(day, team.id)]).toBe(String(total(scores)));
      });
    }
  });

  it("exercises an outright scramble result and a first-place tie", () => {
    const fridayResults = state.teamsByDay.friday.map((team) => ({ teamId: team.id, total: total(state.scrambleScores[cardKey("friday", team.id)]) }));
    expect(calculateScramblePayouts(fridayResults, 23, confirmed2026Rules.scrambleRound)).toEqual([
      { teamId: "team-1", place: 1, teamPayout: 380 },
      { teamId: "team-2", place: 2, teamPayout: 80 },
    ]);
    const saturdayResults = state.teamsByDay.saturday.map((team) => ({ teamId: team.id, total: total(state.scrambleScores[cardKey("saturday", team.id)]) }));
    expect(calculateScramblePayouts(saturdayResults, 23, confirmed2026Rules.scrambleRound)).toEqual([
      { teamId: "team-1", place: 1, teamPayout: 230 },
      { teamId: "team-2", place: 1, teamPayout: 230 },
    ]);
  });

  it("posts all five mock rounds for view-only review", () => {
    expect(Object.values(state.postings)).toHaveLength(5);
    expect(Object.values(state.postings).every((posting) => posting?.status === "posted")).toBe(true);
    expect(classicCourse.holes).toHaveLength(18);
  });

  it("reconciles all mock player payouts against the full $2,300 pool", () => {
    const skinRounds = (["thursday", "friday", "saturday"] as const).map((day) => {
      const scoresByPlayer = Object.fromEntries(state.players.map((player) => [player.id, state.skinScores[cardKey(day, player.id)]]));
      const results = calculateSkins(state.players, tributeCourse, scoresByPlayer, confirmed2026Rules.skinRound);
      return {
        results,
        payoutByHole: calculateSkinPayouts(state.players.length, results, confirmed2026Rules.skinRound),
        closestToPinWinnerIds: confirmed2026Rules.skinRound.closestToPinHoleNumbers.map((hole) => state.closestToPin[cardKey(day, hole)]),
      };
    });
    const scrambleRounds = (["friday", "saturday"] as const).map((day) => {
      const teams = state.teamsByDay[day];
      const results = teams.map((team) => ({ teamId: team.id, total: total(state.scrambleScores[cardKey(day, team.id)]) }));
      return { teams, payouts: calculateScramblePayouts(results, state.players.length, confirmed2026Rules.scrambleRound) };
    });
    const payouts = calculatePlayerPayoutBreakdowns(state.players, skinRounds, scrambleRounds, confirmed2026Rules.skinRound.closestToPinPrize);
    expect(payouts.reduce((sum, player) => sum + player.total, 0)).toBe(2300);
    skinRounds.forEach((round) => expect(Object.values(round.payoutByHole).reduce((sum, payout) => sum + payout, 0) + round.closestToPinWinnerIds.length * 20).toBe(460));
    scrambleRounds.forEach((round) => expect(round.payouts.reduce((sum, payout) => sum + payout.teamPayout, 0)).toBe(460));
  });
});
