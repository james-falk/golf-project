import { describe, expect, it } from "vitest";
import { applyHermesScoringCommand } from "./hermes-command";
import { isTournamentLocked, makeCleanTournamentState, mergeSiteSave, paidEntriesForRound, teamsCoverRoster } from "./live-state";
import { calculateScramblePayouts, calculateSkinPayouts, skinRoundPot } from "./rules";
import { confirmed2026Rules } from "./config";
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
    expect(state.players).toHaveLength(22);
    expect(state.skinScores).toEqual({});
    expect(state.scrambleScores).toEqual({});
    expect(state.skinOfficialTotals).toEqual({});
    expect(state.scrambleOfficialTotals).toEqual({});
    expect(state.closestToPin).toEqual({});
    expect(state.postings).toEqual({});
    expect(isTournamentLocked(state)).toBe(true);
  });

  it("carries the arranged teams through but rebuilds any that no longer describe the field", () => {
    const arranged = makeTeams(startingRoster).map((team) => ({ ...team, playerIds: [...team.playerIds].reverse() }));
    const carried = makeCleanTournamentState({ teamsByDay: { friday: arranged, saturday: [] } }, lockedAt);
    expect(carried.teamsByDay.friday.map((team) => team.playerIds)).toEqual(arranged.map((team) => team.playerIds));
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
    expect(() => applyHermesScoringCommand(state, { type: "scramble-total", day: "friday", team: "Team 1", toPar: -5 })).toThrow(/posted/);
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


describe("naming a scramble team by its players", () => {
  const board = () => makeCleanTournamentState(null, lockedAt);
  // makeTeams deals round-robin, so team-1 is every sixth player from the top.
  const teamOne = () => {
    const ids = makeTeams(startingRoster)[0].playerIds;
    return ids.map((id) => startingRoster.find((p) => p.id === id)!.name);
  };

  it("finds the team when every player on it is named", () => {
    const result = applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: teamOne().join(", "), toPar: -5 });
    expect(result.state.scrambleOfficialTotals["friday:team-1"]).toBe("67");
    expect(result.summary).toContain(teamOne().join(", "));
  });

  it("does not care about order, spacing or separator", () => {
    const names = teamOne();
    for (const query of [names.join(","), names.join(" and "), [...names].reverse().join(" / "), names.join("  ,  ")]) {
      const result = applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: query, toPar: -2 });
      expect(result.state.scrambleOfficialTotals["friday:team-1"]).toBe("70");
    }
  });

  it("refuses a name that is not a player", () => {
    const wrong = [...teamOne().slice(1), "Maxwell"].join(", ");
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: wrong, toPar: -5 })).toThrow(/Unknown player: Maxwell/);
  });

  it("refuses a set of real players who are not a team together", () => {
    const mixed = [...teamOne().slice(0, 3), makeTeams(startingRoster)[1].playerIds.map((id) => startingRoster.find((p) => p.id === id)!.name)[0]].join(", ");
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: mixed, toPar: -5 })).toThrow(/are not a friday team/);
  });

  it("refuses a partial line-up rather than guessing", () => {
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: teamOne().slice(0, 2).join(", "), toPar: -5 })).toThrow(/3 or 4 players/);
  });

  it("refuses the same player listed twice", () => {
    const names = teamOne();
    const doubled = [names[0], names[0], names[1], names[2]].join(", ");
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: doubled, toPar: -5 })).toThrow(/names the same player twice/);
  });

  it("still accepts the bare position, which is an id rather than a name", () => {
    for (const alias of ["Team 1", "team1", "team-1"]) {
      const result = applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: alias, toPar: -5 });
      expect(result.state.scrambleOfficialTotals["friday:team-1"]).toBe("67");
    }
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 9", toPar: -5 })).toThrow(/Unknown team/);
  });
});

describe("a player who paid and then did not play", () => {
  it("prices a round from paid entries, not from the size of the field", () => {
    const state = { paidEntries: { "skins-thursday": 23 } } as Partial<TournamentState>;
    // Maxwell is out of the field but his $20 stays in Thursday's pot.
    expect(paidEntriesForRound(state, "skins-thursday", 22)).toBe(23);
    expect(skinRoundPot(paidEntriesForRound(state, "skins-thursday", 22), confirmed2026Rules.skinRound).total).toBe(460);
    expect(skinRoundPot(paidEntriesForRound(state, "skins-thursday", 22), confirmed2026Rules.skinRound).skinsTotal).toBe(380);
  });

  it("falls back to the field for every round without an override", () => {
    const state = { paidEntries: { "skins-thursday": 23 } } as Partial<TournamentState>;
    expect(paidEntriesForRound(state, "skins-friday", 22)).toBe(22);
    expect(skinRoundPot(paidEntriesForRound(state, "skins-friday", 22), confirmed2026Rules.skinRound).total).toBe(440);
    expect(paidEntriesForRound(null, "skins-saturday", 22)).toBe(22);
    expect(paidEntriesForRound({ paidEntries: {} }, "scramble-friday", 22)).toBe(22);
  });

  it("ignores a nonsense override rather than zeroing a pot", () => {
    expect(paidEntriesForRound({ paidEntries: { "skins-thursday": 0 } }, "skins-thursday", 22)).toBe(22);
    expect(paidEntriesForRound({ paidEntries: { "skins-thursday": -5 } }, "skins-thursday", 22)).toBe(22);
  });

  it("still awards every dollar of a 23-entry pot to a 22-man field", () => {
    const entries = 23;
    const skins = Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, isTie: false, isComplete: true, winnerId: `player-${(i % 22) + 1}`, bestNetScore: 3 }));
    const payouts = calculateSkinPayouts(entries, skins, confirmed2026Rules.skinRound);
    const paid = Object.values(payouts).reduce((a, b) => a + b, 0);
    expect(paid).toBe(380);
    expect(paid + confirmed2026Rules.skinRound.closestToPinHoleNumbers.length * confirmed2026Rules.skinRound.closestToPinPrize).toBe(460);
  });
});

describe("a scramble result sent as a number against par", () => {
  const board = () => ({ ...makeCleanTournamentState(null, lockedAt), postings: {} });

  it("stores strokes so ranking and payouts stay in one unit", () => {
    // The Classic is par 72, so five under is 67 on the card.
    expect(applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: -5 }).state.scrambleOfficialTotals["friday:team-1"]).toBe("67");
    expect(applyHermesScoringCommand(board(), { type: "scramble-total", day: "saturday", team: "Team 2", toPar: 0 }).state.scrambleOfficialTotals["saturday:team-2"]).toBe("72");
    expect(applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 3", toPar: 3 }).state.scrambleOfficialTotals["friday:team-3"]).toBe("75");
  });

  it("reads the result back the way it was spoken", () => {
    expect(applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: -5 }).summary).toContain("-5 (67)");
    expect(applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: 0 }).summary).toContain("even (72)");
    expect(applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: 4 }).summary).toContain("+4 (76)");
  });

  it("catches a total typed in where a to-par was meant", () => {
    // 67 is a plausible team score but a nonsensical result against par.
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: 67 })).toThrow(/not the total strokes/);
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: -40 })).toThrow(/between -30 and \+30/);
    expect(() => applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team: "Team 1", toPar: 1.5 })).toThrow(/whole number/);
  });

  it("ranks and pays from the stored strokes", () => {
    let state = board();
    for (const [team, toPar] of [["Team 1", -5], ["Team 2", -3], ["Team 3", 1]] as Array<[string, number]>) {
      state = applyHermesScoringCommand(state, { type: "scramble-total", day: "friday", team, toPar }).state;
    }
    const results = state.teamsByDay.friday.map((team) => ({ teamId: team.id, total: Number(state.scrambleOfficialTotals[`friday:${team.id}`]) || 0 }));
    const payouts = calculateScramblePayouts(results, 22, confirmed2026Rules.scrambleRound);
    expect(payouts).toEqual([
      { teamId: "team-1", place: 1, teamPayout: 360 },
      { teamId: "team-2", place: 2, teamPayout: 80 },
    ]);
  });
});

describe("nothing in the ledger is lost on a save", () => {
  // A played Thursday: cards, a CTP winner, a posting and a paid-entry override.
  const played = () => ({
    players: startingRoster,
    teamsByDay: { friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) },
    skinScores: { "thursday:player-1": card },
    skinOfficialTotals: { "thursday:player-1": "72" },
    closestToPin: { "thursday:6": "player-4" },
    scrambleScores: {},
    scrambleOfficialTotals: {},
    postings: { "skins-thursday": { status: "posted" as const, postedAt: lockedAt, revision: 2 } },
    paidEntries: { "skins-thursday": 23 },
  }) as TournamentState;

  it("keeps the paid-entry override that sets Thursday's pot", () => {
    const stored = played();
    const { merged } = mergeSiteSave(stored, stored);
    expect(merged.paidEntries).toEqual({ "skins-thursday": 23 });
    expect(skinRoundPot(paidEntriesForRound(merged, "skins-thursday", 22), confirmed2026Rules.skinRound).total).toBe(460);
  });

  it("keeps it even when the browser sends a payload that has none", () => {
    const stored = played();
    const stale = { ...stored };
    delete (stale as Partial<TournamentState>).paidEntries;
    const { merged } = mergeSiteSave(stored, stale as TournamentState);
    expect(merged.paidEntries).toEqual({ "skins-thursday": 23 });
  });

  it("survives repeated saves rather than decaying over time", () => {
    let state = played();
    for (let i = 0; i < 25; i++) state = mergeSiteSave(state, state).merged;
    expect(state.paidEntries).toEqual({ "skins-thursday": 23 });
    expect(state.skinScores["thursday:player-1"]).toHaveLength(18);
    expect(state.closestToPin["thursday:6"]).toBe("player-4");
    expect(state.postings["skins-thursday"]?.revision).toBe(2);
  });

  it("carries every key the stored ledger had", () => {
    const stored = played();
    const { merged } = mergeSiteSave(stored, stored);
    for (const key of Object.keys(stored)) {
      expect(merged, `"${key}" was dropped by a site save`).toHaveProperty(key);
    }
  });

  it("does not lose a field this merge has never heard of", () => {
    // Stands in for any column added to the state after this code was written.
    const stored = { ...played(), somethingAddedLater: { keep: true } } as unknown as TournamentState;
    const { merged } = mergeSiteSave(stored, played());
    expect((merged as unknown as Record<string, unknown>).somethingAddedLater).toEqual({ keep: true });
  });
});
