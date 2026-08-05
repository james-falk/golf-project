import type { TournamentRules } from "./types";

export const confirmed2026Rules: TournamentRules = {
  skinRound: {
    playerEntryFee: 20,
    closestToPinHoleNumbers: [6, 9, 13, 17],
    closestToPinPrize: 20,
    tierStrokes: { A: 0, B: 6, C: 12, D: 18 },
  },
  scrambleRound: {
    playerEntryFee: 20,
    teamCount: 6,
    teamSize: 4,
    // Legacy money map: second receives $80 and first receives the remainder.
    secondPlacePrize: 80,
  },
};
