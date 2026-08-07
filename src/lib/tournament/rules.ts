import type {
  Course,
  HoleScore,
  Player,
  PlayerTier,
  ScrambleRoundRules,
  SkinResult,
  SkinRoundRules,
  TeamResult,
} from "./types";

/** Applies A/B/C/D strokes to The Tribute's stroke-index holes. */
export function strokesReceivedOnHole(
  tier: PlayerTier,
  strokeIndex: number,
  rules: SkinRoundRules,
) {
  const totalStrokes = rules.tierStrokes[tier];
  return Math.floor(totalStrokes / 18) + (totalStrokes % 18 >= strokeIndex ? 1 : 0);
}

export function netScoreForHole(
  grossScore: number,
  tier: PlayerTier,
  strokeIndex: number,
  rules: SkinRoundRules,
) {
  return grossScore - strokesReceivedOnHole(tier, strokeIndex, rules);
}

/** A tied low-net score kills the hole; no carryover or split is created. */
export function calculateSkins(
  players: Player[],
  course: Course,
  scoresByPlayer: Record<string, HoleScore[]>,
  rules: SkinRoundRules,
): SkinResult[] {
  return course.holes.map((hole) => {
    const contenders = players.flatMap((player) => {
      const score = scoresByPlayer[player.id]?.find((item) => item.holeNumber === hole.number);
      return score
        ? [{ playerId: player.id, netScore: netScoreForHole(score.strokes, player.tier, hole.strokeIndex, rules) }]
        : [];
    });

    if (contenders.length !== players.length) {
      return { holeNumber: hole.number, isTie: false, isComplete: false };
    }

    const bestNetScore = Math.min(...contenders.map((entry) => entry.netScore));
    const winners = contenders.filter((entry) => entry.netScore === bestNetScore);
    return {
      holeNumber: hole.number,
      bestNetScore,
      isTie: winners.length !== 1,
      isComplete: true,
      winnerId: winners.length === 1 ? winners[0].playerId : undefined,
    };
  });
}

/** The pot is built from paid entries, which is not always the same as the number of players being scored. */
export function skinRoundPot(paidEntryCount: number, rules: SkinRoundRules) {
  const total = paidEntryCount * rules.playerEntryFee;
  const closestToPinTotal = rules.closestToPinHoleNumbers.length * rules.closestToPinPrize;
  return { total, closestToPinTotal, skinsTotal: total - closestToPinTotal };
}

/** Splits the skins pool in whole dollars and assigns any $1 remainder by hole order. */
export function calculateSkinPayouts(paidEntryCount: number, skins: SkinResult[], rules: SkinRoundRules) {
  const winners = skins.filter((skin) => skin.isComplete && skin.winnerId).sort((a, b) => a.holeNumber - b.holeNumber);
  if (!winners.length) return {} as Record<number, number>;
  const pot = skinRoundPot(paidEntryCount, rules).skinsTotal;
  const basePayout = Math.floor(pot / winners.length);
  const remainder = pot - basePayout * winners.length;
  return Object.fromEntries(winners.map((skin, index) => [skin.holeNumber, basePayout + (index < remainder ? 1 : 0)]));
}

export type ScramblePayout = { teamId: string; place: 1 | 2; teamPayout: number };

/** Reproduces the legacy rule: first-place ties split all money and eliminate second. */
export function calculateScramblePayouts(
  results: TeamResult[],
  paidEntryCount: number,
  rules: ScrambleRoundRules,
): ScramblePayout[] {
  const completed = results.filter((result) => result.total > 0).sort((a, b) => a.total - b.total);
  if (!completed.length) return [];

  const pot = paidEntryCount * rules.playerEntryFee;
  const firstScore = completed[0].total;
  const firstPlace = completed.filter((result) => result.total === firstScore);
  if (firstPlace.length > 1) {
    return firstPlace.map((result) => ({ teamId: result.teamId, place: 1, teamPayout: pot / firstPlace.length }));
  }

  const secondPlacePrize = Math.min(rules.secondPlacePrize, pot);
  const firstPayout = pot - secondPlacePrize;
  const payouts: ScramblePayout[] = [{ teamId: firstPlace[0].teamId, place: 1, teamPayout: firstPayout }];
  const secondScore = completed.find((result) => result.total > firstScore)?.total;
  if (secondScore === undefined) return payouts;

  const secondPlace = completed.filter((result) => result.total === secondScore);
  const secondPayout = secondPlacePrize / secondPlace.length;
  return payouts.concat(secondPlace.map((result) => ({ teamId: result.teamId, place: 2, teamPayout: secondPayout })));
}
