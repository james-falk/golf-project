import { describe, expect, it } from "vitest";
import { confirmed2026Rules } from "./config";
import { calculateScramblePayouts, calculateSkins, payoutPerSkin, skinRoundPot, strokesReceivedOnHole } from "./rules";
import type { Course, Player } from "./types";

const players: Player[] = [
  { id: "a", name: "A Player", tier: "A" },
  { id: "b", name: "B Player", tier: "B" },
  { id: "c", name: "C Player", tier: "C" },
];
const course: Course = { id: "test", name: "Test", holes: [{ number: 1, par: 4, strokeIndex: 1 }, { number: 2, par: 4, strokeIndex: 8 }] };

describe("2026 confirmed tournament rules", () => {
  it("allocates B strokes to the six hardest Tribute holes", () => {
    expect(strokesReceivedOnHole("B", 1, confirmed2026Rules.skinRound)).toBe(1);
    expect(strokesReceivedOnHole("B", 6, confirmed2026Rules.skinRound)).toBe(1);
    expect(strokesReceivedOnHole("B", 7, confirmed2026Rules.skinRound)).toBe(0);
    expect(strokesReceivedOnHole("D", 18, confirmed2026Rules.skinRound)).toBe(1);
  });

  it("kills a tied low-net skin instead of carrying or splitting it", () => {
    const skins = calculateSkins(players, course, {
      a: [{ holeNumber: 1, strokes: 4 }],
      b: [{ holeNumber: 1, strokes: 5 }], // net 4 after a B stroke
    }, confirmed2026Rules.skinRound);
    expect(skins[0]).toMatchObject({ holeNumber: 1, isTie: true });
    expect(skins[0].winnerId).toBeUndefined();
  });

  it("uses the legacy $20 per player money map", () => {
    expect(skinRoundPot(18, confirmed2026Rules.skinRound)).toEqual({ total: 360, closestToPinTotal: 80, skinsTotal: 280 });
    const skins = [{ holeNumber: 1, winnerId: "a", isTie: false }, { holeNumber: 2, winnerId: "b", isTie: false }, { holeNumber: 3, winnerId: "c", isTie: false }];
    expect(payoutPerSkin(18, skins, confirmed2026Rules.skinRound)).toBe(93);
  });

  it("splits a first-place scramble tie across the full pot and removes second", () => {
    expect(calculateScramblePayouts([{ teamId: "one", total: 65 }, { teamId: "two", total: 65 }, { teamId: "three", total: 68 }], 18, confirmed2026Rules.scrambleRound))
      .toEqual([{ teamId: "one", place: 1, teamPayout: 180 }, { teamId: "two", place: 1, teamPayout: 180 }]);
  });

  it("splits only the second-place share when second is tied", () => {
    expect(calculateScramblePayouts([{ teamId: "one", total: 64 }, { teamId: "two", total: 65 }, { teamId: "three", total: 65 }], 18, confirmed2026Rules.scrambleRound))
      .toEqual([{ teamId: "one", place: 1, teamPayout: 280 }, { teamId: "two", place: 2, teamPayout: 40 }, { teamId: "three", place: 2, teamPayout: 40 }]);
  });
});
