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
    teamCount: 5,
    teamSize: 4,
    // Preserves 2025's $280 / $80 split when 18 players make a $360 pot.
    firstPlaceShare: 280 / 360,
    secondPlaceShare: 80 / 360,
  },
};
