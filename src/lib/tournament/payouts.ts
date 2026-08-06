import type { ScramblePayout } from "./rules";
import type { Team } from "./state";
import type { Player, SkinResult } from "./types";

export type PayoutSkinRound = {
  results: SkinResult[];
  payoutByHole: Record<number, number>;
  closestToPinWinnerIds: string[];
};

export type PayoutScrambleRound = {
  teams: Team[];
  payouts: ScramblePayout[];
};

export type PlayerPayoutBreakdown = {
  playerId: string;
  skins: number;
  closestToPin: number;
  scramble: number;
  total: number;
};

export function calculatePlayerPayoutBreakdowns(
  players: Player[],
  skinRounds: PayoutSkinRound[],
  scrambleRounds: PayoutScrambleRound[],
  closestToPinPrize: number,
): PlayerPayoutBreakdown[] {
  return players.map((player) => {
    const skins = skinRounds.reduce((total, round) => total + round.results.filter((result) => result.winnerId === player.id).reduce((roundTotal, result) => roundTotal + (round.payoutByHole[result.holeNumber] ?? 0), 0), 0);
    const closestToPin = skinRounds.reduce((total, round) => total + round.closestToPinWinnerIds.filter((winnerId) => winnerId === player.id).length * closestToPinPrize, 0);
    // A team share is rounded down, per round, exactly as the 2025 board did.
    // It matters here because a 23-player field leaves one team of three.
    const scramble = scrambleRounds.reduce((total, round) => {
      const team = round.teams.find((entry) => entry.playerIds.includes(player.id));
      if (!team) return total;
      const payout = round.payouts.find((entry) => entry.teamId === team.id);
      return total + (payout ? Math.floor(payout.teamPayout / Math.max(team.playerIds.length, 1)) : 0);
    }, 0);
    return { playerId: player.id, skins, closestToPin, scramble, total: skins + closestToPin + scramble };
  }).sort((a, b) => b.total - a.total || a.playerId.localeCompare(b.playerId));
}
