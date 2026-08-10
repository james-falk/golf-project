import { describe, expect, it } from "vitest";
import { sanitizeTournamentStateForViewer } from "./public-state";
import type { TournamentState } from "./state";

const state: TournamentState = {
  players: [{ id: "jeff", name: "Jeff", tier: "A" }],
  teamsByDay: {
    friday: [{ id: "team-1", playerIds: ["jeff"] }],
    saturday: [{ id: "team-1", playerIds: ["jeff"] }],
  },
  skinScores: {
    "thursday:jeff": [{ holeNumber: 1, strokes: 4 }],
    "friday:jeff": [{ holeNumber: 1, strokes: 3 }],
  },
  skinOfficialTotals: { "thursday:jeff": "72", "friday:jeff": "70" },
  closestToPin: { "thursday:6": "jeff", "friday:6": "jeff" },
  scrambleScores: {
    "friday:team-1": [{ holeNumber: 1, strokes: 4 }],
    "saturday:team-1": [{ holeNumber: 1, strokes: 3 }],
  },
  scrambleOfficialTotals: { "friday:team-1": "66", "saturday:team-1": "64" },
  postings: {
    "skins-thursday": { status: "posted", revision: 1, postedAt: "2026-07-21T12:00:00.000Z" },
    "skins-friday": { status: "review", revision: 0 },
    "scramble-friday": { status: "review", revision: 0 },
    "scramble-saturday": { status: "posted", revision: 2, postedAt: "2026-07-21T18:00:00.000Z" },
  },
};

describe("viewer tournament state", () => {
  it("includes only rounds that the commissioner has posted", () => {
    const viewerState = sanitizeTournamentStateForViewer(state);

    expect(Object.keys(viewerState.skinScores)).toEqual(["thursday:jeff"]);
    expect(Object.keys(viewerState.skinOfficialTotals)).toEqual(["thursday:jeff"]);
    expect(Object.keys(viewerState.closestToPin)).toEqual(["thursday:6"]);
    expect(Object.keys(viewerState.scrambleScores)).toEqual(["saturday:team-1"]);
    expect(Object.keys(viewerState.scrambleOfficialTotals)).toEqual(["saturday:team-1"]);
  });

  it("preserves the roster, teams, and posting ledger", () => {
    const viewerState = sanitizeTournamentStateForViewer(state);

    expect(viewerState.players).toEqual(state.players);
    expect(viewerState.teamsByDay).toEqual(state.teamsByDay);
    expect(viewerState.postings).toEqual(state.postings);
  });
});
