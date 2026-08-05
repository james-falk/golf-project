import { describe, expect, it } from "vitest";
import { applyHermesScoringCommand } from "./hermes-command";
import { isTournamentLocked, makeCleanTournamentState, mergeSiteSave, teamsCoverRoster } from "./live-state";
import { makeMockTournamentState } from "./mock-state";
import { makeTeams, startingRoster } from "./seed";
import type { TournamentState } from "./state";

const lockedAt = "2026-08-06T12:00:00.000Z";
const card = Array.from({ length: 18 }, (_, index) => ({ holeNumber: index + 1, strokes: 4 }));

function startedTournament(overrides: Partial<TournamentState> = {}): TournamentState {
  return { ...makeCleanTournamentState(null, lockedAt), ...overrides };
}

describe("starting the tournament for real", () => {
  it("keeps the confirmed field and drops every score from the testing period", () => {
    const state = makeCleanTournamentState(makeMockTournamentState(), lockedAt);
    expect(state.players).toEqual(startingRoster);
    expect(state.players).toHaveLength(23);
    expect(state.skinScores).toEqual({});
    expect(state.scrambleScores).toEqual({});
    expect(state.skinOfficialTotals).toEqual({});
    expect(state.scrambleOfficialTotals).toEqual({});
    expect(state.closestToPin).toEqual({});
    expect(state.postings).toEqual({});
    expect(isTournamentLocked(state)).toBe(true);
  });

  it("carries the arranged teams through but rebuilds any that no longer describe the field", () => {
    const arranged = makeTeams(startingRoster).map((team, index) => ({ ...team, name: `Arranged ${index + 1}` }));
    const carried = makeCleanTournamentState({ teamsByDay: { friday: arranged, saturday: [] } }, lockedAt);
    expect(carried.teamsByDay.friday.map((team) => team.name)).toEqual(arranged.map((team) => team.name));
    expect(teamsCoverRoster(carried.teamsByDay.saturday, startingRoster)).toBe(true);
  });

  it("rejects a team set that drops or duplicates a player", () => {
    const teams = makeTeams(startingRoster);
    expect(teamsCoverRoster(teams, startingRoster)).toBe(true);
    const dropped = teams.map((team, index) => index === 0 ? { ...team, playerIds: team.playerIds.slice(1) } : team);
    expect(teamsCoverRoster(dropped, startingRoster)).toBe(false);
    const duplicated = teams.map((team, index) => index === 0 ? { ...team, playerIds: [...team.playerIds.slice(1), teams[1].playerIds[0]] } : team);
    expect(teamsCoverRoster(duplicated, startingRoster)).toBe(false);
  });

  it("leaves an unstarted board unlocked", () => {
    expect(isTournamentLocked(makeCleanTournamentState(null))).toBe(false);
  });
});

describe("saving from the site once the tournament is locked", () => {
  it("ignores any roster or teams the browser sends", () => {
    const current = startedTournament();
    const tampered: TournamentState = {
      ...current,
      players: [{ id: "player-99", name: "Ringer", tier: "A" }],
      teamsByDay: { friday: [], saturday: [] },
      skinScores: { "thursday:player-1": card },
    };
    const { merged } = mergeSiteSave(current, tampered);
    expect(merged.players).toEqual(startingRoster);
    expect(merged.teamsByDay.friday).toEqual(current.teamsByDay.friday);
    expect(merged.skinScores["thursday:player-1"]).toHaveLength(18);
    expect(merged.lockedAt).toBe(lockedAt);
  });

  it("accepts the roster and teams while the tournament has not started", () => {
    const current = makeCleanTournamentState(null);
    const incoming: TournamentState = { ...current, players: current.players.slice(0, 20) };
    const { merged, rejected } = mergeSiteSave(current, incoming);
    expect(merged.players).toHaveLength(20);
    expect(rejected).toEqual([]);
  });

  it("accepts scores for a round that is still in review", () => {
    const current = startedTournament({ postings: { "skins-thursday": { status: "review", revision: 0 } } });
    const { merged, rejected } = mergeSiteSave(current, { ...current, skinScores: { "thursday:player-1": card } });
    expect(rejected).toEqual([]);
    expect(merged.skinScores["thursday:player-1"]).toHaveLength(18);
  });

  it("refuses to change a posted round and keeps the published scores", () => {
    const posted = { status: "posted" as const, postedAt: lockedAt, revision: 1 };
    const current = startedTournament({
      skinScores: { "thursday:player-1": card },
      postings: { "skins-thursday": posted },
    });
    const overwrite = card.map((score) => ({ ...score, strokes: 9 }));
    const { merged, rejected } = mergeSiteSave(current, { ...current, skinScores: { "thursday:player-1": overwrite } });
    expect(rejected).toEqual(["skins-thursday"]);
    expect(merged.skinScores["thursday:player-1"]).toEqual(card);
  });

  it("allows a correction when the same save also returns the round to review", () => {
    const posted = { status: "posted" as const, postedAt: lockedAt, revision: 1 };
    const current = startedTournament({
      skinScores: { "thursday:player-1": card },
      postings: { "skins-thursday": posted },
    });
    const corrected = card.map((score) => ({ ...score, strokes: 5 }));
    const { merged, rejected } = mergeSiteSave(current, {
      ...current,
      skinScores: { "thursday:player-1": corrected },
      postings: { "skins-thursday": { status: "review", revision: 1 } },
    });
    expect(rejected).toEqual([]);
    expect(merged.skinScores["thursday:player-1"]).toEqual(corrected);
  });

  it("does not let one posted round block a different round that is still open", () => {
    const posted = { status: "posted" as const, postedAt: lockedAt, revision: 1 };
    const current = startedTournament({
      skinScores: { "thursday:player-1": card },
      postings: { "skins-thursday": posted },
    });
    const { merged, rejected } = mergeSiteSave(current, {
      ...current,
      skinScores: { "thursday:player-1": card.map((score) => ({ ...score, strokes: 9 })), "friday:player-1": card },
    });
    expect(rejected).toEqual(["skins-thursday"]);
    expect(merged.skinScores["thursday:player-1"]).toEqual(card);
    expect(merged.skinScores["friday:player-1"]).toHaveLength(18);
  });
});

describe("Hermes writes against a posted round", () => {
  const posted = { status: "posted" as const, postedAt: lockedAt, revision: 1 };

  it("refuses every kind of score write while the round is posted", () => {
    const state = startedTournament({ postings: { "skins-thursday": posted, "scramble-friday": posted } });
    const scores = Array.from({ length: 18 }, () => 4);
    expect(() => applyHermesScoringCommand(state, { type: "player-card", day: "thursday", player: "Ethan", scores })).toThrow(/posted/);
    expect(() => applyHermesScoringCommand(state, { type: "player-hole", day: "thursday", player: "Ethan", hole: 4, strokes: 5 })).toThrow(/posted/);
    expect(() => applyHermesScoringCommand(state, { type: "ctp", day: "thursday", hole: 6, player: "Ethan" })).toThrow(/posted/);
    expect(() => applyHermesScoringCommand(state, { type: "scramble-card", day: "friday", team: "Team 1", scores })).toThrow(/posted/);
    expect(() => applyHermesScoringCommand(state, { type: "scramble-hole", day: "friday", team: "Team 1", hole: 2, strokes: 3 })).toThrow(/posted/);
  });

  it("accepts the same write after the commissioner returns the round to review", () => {
    const state = startedTournament({ postings: { "skins-thursday": posted } });
    const reopened = applyHermesScoringCommand(state, { type: "round-status", day: "thursday", round: "skins", status: "review" }).state;
    const result = applyHermesScoringCommand(reopened, { type: "player-hole", day: "thursday", player: "Ethan", hole: 4, strokes: 5 });
    expect(result.state.skinScores["thursday:player-5"]).toHaveLength(1);
  });

  it("keeps the lock in place across a scoring write", () => {
    const state = startedTournament();
    const result = applyHermesScoringCommand(state, { type: "player-hole", day: "thursday", player: "Ethan", hole: 4, strokes: 5 });
    expect(isTournamentLocked(result.state)).toBe(true);
  });
});
