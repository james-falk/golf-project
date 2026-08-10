import { describe, expect, it } from "vitest";
import { applyHermesScoringCommand } from "./hermes-command";
import { fieldForRound, isTournamentLocked, makeCleanTournamentState, mergeSiteSave, paidEntriesForRound, teamsCoverRoster } from "./live-state";
import { calculateScramblePayouts, calculateSkinPayouts, calculateSkins, skinRoundPot } from "./rules";
import { confirmed2026Rules } from "./config";
import { makeMockTournamentState } from "./mock-state";
import { makeTeams, startingRoster, tributeCourse } from "./seed";
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

  it("starts with no scramble teams at all", () => {
    // Teams are not arranged in advance; each one is created when its result is
    // reported, so a fresh board has none on either day.
    const state = makeCleanTournamentState(makeMockTournamentState(), lockedAt);
    expect(state.teamsByDay.friday).toEqual([]);
    expect(state.teamsByDay.saturday).toEqual([]);
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


describe("a scramble team is created by reporting its result", () => {
  const board = () => makeCleanTournamentState(null, lockedAt);
  const four = ["Roger", "Logan", "Mitchell", "Aiden"];
  const three = ["Ethan", "Spencer", "Cam"];
  const report = (state: TournamentState, team: string, toPar: number) =>
    applyHermesScoringCommand(state, { type: "scramble-total", day: "friday", team, toPar });

  it("creates the team the first time, from nothing", () => {
    const before = board();
    expect(before.teamsByDay.friday).toHaveLength(0);
    const after = report(before, four.join(", "), -5).state;
    expect(after.teamsByDay.friday).toHaveLength(1);
    expect(after.scrambleOfficialTotals[`friday:${after.teamsByDay.friday[0].id}`]).toBe("67");
  });

  it("names the same players again to correct, rather than making a second team", () => {
    let state = report(board(), four.join(", "), -5).state;
    state = report(state, [...four].reverse().join(" and "), -7).state;
    expect(state.teamsByDay.friday).toHaveLength(1);
    expect(state.scrambleOfficialTotals[`friday:${state.teamsByDay.friday[0].id}`]).toBe("65");
  });

  it("keeps separate teams apart and gives each its own id", () => {
    let state = report(board(), four.join(", "), -5).state;
    state = report(state, three.join(", "), -2).state;
    expect(state.teamsByDay.friday.map((team) => team.id)).toEqual(["team-1", "team-2"]);
    expect(state.teamsByDay.friday.map((team) => team.playerIds.length)).toEqual([4, 3]);
  });

  it("does not touch the other day", () => {
    const state = report(board(), four.join(", "), -5).state;
    expect(state.teamsByDay.saturday).toHaveLength(0);
  });

  it("still refuses a name that is not a player", () => {
    expect(() => report(board(), "Roger, Logan, Mitchell, Maxwell", -5)).toThrow(/Unknown player: Maxwell/);
  });

  it("still refuses a partial list or a repeated name", () => {
    expect(() => report(board(), "Roger, Logan", -5)).toThrow(/3 or 4 players/);
    expect(() => report(board(), "Roger, Roger, Logan, Aiden", -5)).toThrow(/names the same player twice/);
  });

  it("warns, without blocking, when a player turns up on two teams the same day", () => {
    const state = report(board(), four.join(", "), -5).state;
    const result = report(state, "Roger, Jeff, James, Greg", -3);
    expect(result.summary).toContain("Roger already on another friday team");
    expect(result.state.teamsByDay.friday).toHaveLength(2);
  });

  it("pays first and second from only the two teams that were reported", () => {
    // Only the teams in the money get reported, so the round is two teams long.
    let state = report(board(), four.join(", "), -8).state;
    state = report(state, three.join(", "), -6).state;
    const results = state.teamsByDay.friday.map((team) => ({
      teamId: team.id,
      total: Number(state.scrambleOfficialTotals[`friday:${team.id}`]) || 0,
    }));
    expect(calculateScramblePayouts(results, 22, confirmed2026Rules.scrambleRound)).toEqual([
      { teamId: "team-1", place: 1, teamPayout: 360 },
      { teamId: "team-2", place: 2, teamPayout: 80 },
    ]);
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
  const board = () => makeCleanTournamentState(null, lockedAt);
  const team = "Roger, Logan, Mitchell, Aiden";
  const report = (toPar: number) =>
    applyHermesScoringCommand(board(), { type: "scramble-total", day: "friday", team, toPar });

  it("stores strokes so ranking and payouts stay in one unit", () => {
    // The Classic is par 72.
    expect(report(-5).state.scrambleOfficialTotals["friday:team-1"]).toBe("67");
    expect(report(0).state.scrambleOfficialTotals["friday:team-1"]).toBe("72");
    expect(report(3).state.scrambleOfficialTotals["friday:team-1"]).toBe("75");
  });

  it("reads the result back the way it was spoken", () => {
    expect(report(-5).summary).toContain("-5 (67)");
    expect(report(0).summary).toContain("even (72)");
    expect(report(4).summary).toContain("+4 (76)");
  });

  it("catches a total typed in where a to-par was meant", () => {
    expect(() => report(67)).toThrow(/not the total strokes/);
    expect(() => report(-40)).toThrow(/between -30 and \+30/);
    expect(() => report(1.5)).toThrow(/whole number/);
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

describe("a player who sat a round out", () => {
  const round = "skins-saturday" as const;
  const matt = startingRoster.find((p) => p.name === "Matt")!;

  it("drops him from that round's field and nothing else", () => {
    const state = { absences: { [round]: [matt.id] } } as Partial<TournamentState>;
    const field = fieldForRound(state, round, startingRoster);
    expect(field).toHaveLength(21);
    expect(field.some((p) => p.id === matt.id)).toBe(false);
    // Every other round still has the whole field.
    expect(fieldForRound(state, "skins-friday", startingRoster)).toHaveLength(22);
    expect(fieldForRound(state, "skins-thursday", startingRoster)).toHaveLength(22);
  });

  it("leaves the round's pot alone, because he paid", () => {
    const state = { absences: { [round]: [matt.id] } } as Partial<TournamentState>;
    // The pot follows paid entries, which still defaults to the full roster.
    expect(skinRoundPot(paidEntriesForRound(state, round, startingRoster.length), confirmed2026Rules.skinRound).total).toBe(440);
  });

  it("lets a round resolve that a missing card had frozen", () => {
    const field = startingRoster;
    const cardFor = (offset: number) => Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, strokes: 4 + ((i + offset) % 3) }));
    const scoresAll = Object.fromEntries(field.map((p, i) => [p.id, p.id === matt.id ? [] : cardFor(i)]));

    // With Matt in the field and no card, not one hole resolves.
    const stuck = calculateSkins(field, tributeCourse, scoresAll, confirmed2026Rules.skinRound);
    expect(stuck.every((r) => !r.isComplete)).toBe(true);

    // Marking him absent unblocks every hole.
    const playing = fieldForRound({ absences: { [round]: [matt.id] } }, round, field);
    const resolved = calculateSkins(playing, tributeCourse, scoresAll, confirmed2026Rules.skinRound);
    expect(resolved.every((r) => r.isComplete)).toBe(true);
  });

  it("survives a site save", () => {
    const current = { ...makeCleanTournamentState(null, lockedAt), absences: { [round]: [matt.id] } } as TournamentState;
    const stale = { ...current };
    delete (stale as Partial<TournamentState>).absences;
    const { merged } = mergeSiteSave(current, stale as TournamentState);
    expect(merged.absences).toEqual({ [round]: [matt.id] });
  });
});
