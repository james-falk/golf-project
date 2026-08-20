import { describe, expect, it } from "vitest";
import { confirmed2026Rules } from "./config";
import { final2026State } from "./final-2026";
import { allRoundKeys, fieldForRound, paidEntriesForRound } from "./live-state";
import { calculatePlayerPayoutBreakdowns } from "./payouts";
import { calculateScramblePayouts, calculateSkinPayouts, calculateSkins } from "./rules";
import { tributeCourse } from "./seed";
import type { RoundKey, ScrambleDay, SkinDay } from "./state";

const cardKey = (day: string, id: string | number) => `${day}:${id}`;
const state = final2026State;
const entriesFor = (round: RoundKey) => paidEntriesForRound(state, round, state.players.length);

// The same derivation the payout dashboard performs, run over the frozen record.
const skinRounds = (["thursday", "friday", "saturday"] as SkinDay[]).map((day) => {
  const field = fieldForRound(state, `skins-${day}`, state.players);
  const scores = Object.fromEntries(field.map((player) => [player.id, state.skinScores[cardKey(day, player.id)] ?? []]));
  const results = calculateSkins(field, tributeCourse, scores, confirmed2026Rules.skinRound);
  return {
    day,
    field,
    results,
    payoutByHole: calculateSkinPayouts(entriesFor(`skins-${day}`), results, confirmed2026Rules.skinRound),
    closestToPinWinnerIds: confirmed2026Rules.skinRound.closestToPinHoleNumbers.flatMap((hole) =>
      state.closestToPin[cardKey(day, hole)] ? [state.closestToPin[cardKey(day, hole)]] : [],
    ),
  };
});
const scrambleRounds = (["friday", "saturday"] as ScrambleDay[]).map((day) => {
  const teams = state.teamsByDay[day];
  const results = teams.map((team) => ({ teamId: team.id, total: Number(state.scrambleOfficialTotals[cardKey(day, team.id)]) || 0 }));
  return { day, teams, payouts: calculateScramblePayouts(results, entriesFor(`scramble-${day}`), confirmed2026Rules.scrambleRound) };
});

describe("the frozen 2026 record", () => {
  it("is a finished tournament: every round posted, every card complete", () => {
    allRoundKeys.forEach((round) => expect(state.postings[round]?.status, round).toBe("posted"));
    Object.entries(state.skinScores).forEach(([key, holes]) => {
      expect(holes.map((hole) => hole.holeNumber), key).toStrictEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    });
    expect(skinRounds.map((round) => round.field.length)).toStrictEqual([22, 22, 21]);
    expect(Object.keys(state.skinScores)).toHaveLength(65);
    skinRounds.forEach((round) => expect(round.closestToPinWinnerIds, round.day).toHaveLength(4));
  });

  it("resolves every skin exactly as posted in 2026", () => {
    expect(skinRounds[0].payoutByHole).toStrictEqual({ 4: 40, 6: 40, 8: 40, 11: 40, 12: 40, 13: 40, 15: 40, 16: 40, 18: 40 });
    expect(skinRounds[1].payoutByHole).toStrictEqual({ 5: 72, 7: 72, 9: 72, 13: 72, 18: 72 });
    expect(skinRounds[2].payoutByHole).toStrictEqual({ 1: 33, 2: 33, 3: 33, 5: 33, 6: 33, 7: 33, 9: 33, 11: 33, 13: 32, 16: 32, 17: 32 });
  });

  it("pays the scrambles exactly as posted in 2026", () => {
    expect(scrambleRounds[0].payouts).toStrictEqual([
      { teamId: "team-1", place: 1, teamPayout: 360 },
      { teamId: "team-2", place: 2, teamPayout: 80 },
    ]);
    expect(scrambleRounds[1].payouts).toStrictEqual([
      { teamId: "team-3", place: 1, teamPayout: 360 },
      { teamId: "team-2", place: 2, teamPayout: 80 },
    ]);
  });

  it("produces the official 2026 payout leaderboard, to the dollar", () => {
    const rows = calculatePlayerPayoutBreakdowns(state.players, skinRounds, scrambleRounds, confirmed2026Rules.skinRound.closestToPinPrize);
    const name = (playerId: string) => state.players.find((player) => player.id === playerId)?.name;
    expect(rows.map((row) => ({ ...row, name: name(row.playerId) }))).toStrictEqual([
      { playerId: "player-14", name: "Lucas", skins: 152, closestToPin: 0, scramble: 90, total: 242 },
      { playerId: "player-17", name: "Cam", skins: 80, closestToPin: 20, scramble: 140, total: 240 },
      { playerId: "player-22", name: "Jake", skins: 176, closestToPin: 0, scramble: 0, total: 176 },
      { playerId: "player-20", name: "Brandon", skins: 145, closestToPin: 0, scramble: 20, total: 165 },
      { playerId: "player-8", name: "Thomas", skins: 65, closestToPin: 0, scramble: 90, total: 155 },
      { playerId: "player-3", name: "Roger", skins: 33, closestToPin: 0, scramble: 120, total: 153 },
      { playerId: "player-11", name: "Spencer", skins: 0, closestToPin: 20, scramble: 120, total: 140 },
      { playerId: "player-16", name: "Greg", skins: 112, closestToPin: 0, scramble: 20, total: 132 },
      { playerId: "player-4", name: "Jeff", skins: 0, closestToPin: 40, scramble: 90, total: 130 },
      { playerId: "player-10", name: "James", skins: 0, closestToPin: 0, scramble: 110, total: 110 },
      { playerId: "player-6", name: "Jim", skins: 0, closestToPin: 80, scramble: 0, total: 80 },
      { playerId: "player-13", name: "Bryce", skins: 33, closestToPin: 20, scramble: 20, total: 73 },
      { playerId: "player-19", name: "Pete", skins: 33, closestToPin: 20, scramble: 20, total: 73 },
      { playerId: "player-2", name: "John", skins: 33, closestToPin: 20, scramble: 20, total: 73 },
      { playerId: "player-7", name: "Sam", skins: 66, closestToPin: 0, scramble: 0, total: 66 },
      { playerId: "player-5", name: "Ethan", skins: 40, closestToPin: 0, scramble: 20, total: 60 },
      { playerId: "player-21", name: "Aiden", skins: 32, closestToPin: 20, scramble: 0, total: 52 },
      { playerId: "player-15", name: "Mitchell", skins: 40, closestToPin: 0, scramble: 0, total: 40 },
      { playerId: "player-9", name: "Logan", skins: 40, closestToPin: 0, scramble: 0, total: 40 },
      { playerId: "player-1", name: "Steve", skins: 0, closestToPin: 0, scramble: 0, total: 0 },
      { playerId: "player-12", name: "Kent", skins: 0, closestToPin: 0, scramble: 0, total: 0 },
      { playerId: "player-18", name: "Matt", skins: 0, closestToPin: 0, scramble: 0, total: 0 },
    ]);
  });

  it("accounts for the entire $2,200 prize pool", () => {
    const rows = calculatePlayerPayoutBreakdowns(state.players, skinRounds, scrambleRounds, confirmed2026Rules.skinRound.closestToPinPrize);
    const prizePool = allRoundKeys.reduce((sum, round) => sum + entriesFor(round) * confirmed2026Rules.skinRound.playerEntryFee, 0);
    expect(prizePool).toBe(2200);
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(2200);
  });
});
