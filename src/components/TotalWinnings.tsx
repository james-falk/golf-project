'use client';

import React from 'react';
import { TournamentData } from '@/types/golf';
import { calculatePlayerScrambleWinnings } from '@/utils/scrambleUtils';

interface TotalWinningsProps {
  tournamentData: TournamentData;
}

const TotalWinnings: React.FC<TotalWinningsProps> = ({ tournamentData }) => {
  // Calculate total winnings across all rounds
  const calculateTotalWinnings = () => {
    const totals: { [playerId: string]: number } = {};
    
    tournamentData.rounds.forEach(round => {
      // Add skins winnings
      round.skinsGame.skinResults.forEach(skin => {
        if (skin.winner) {
          totals[skin.winner] = (totals[skin.winner] || 0) + skin.pot;
        }
      });
      
      // Add closest to pin winnings
      round.closestToPinGame.holes.forEach(hole => {
        if (hole.winner) {
          totals[hole.winner] = (totals[hole.winner] || 0) + hole.prize;
        }
      });
      
      // Add scramble winnings - per-player payout based on team size
      // Get all unique players from this round
      const roundPlayers = new Set<string>();
      round.skinsGame.players.forEach(player => roundPlayers.add(player.id));
      round.closestToPinGame.players.forEach(player => roundPlayers.add(player.id));
      
      // Calculate scramble winnings for each player
      roundPlayers.forEach(playerId => {
        const scrambleWinnings = calculatePlayerScrambleWinnings(playerId, round);
        if (scrambleWinnings > 0) {
          totals[playerId] = (totals[playerId] || 0) + scrambleWinnings;
        }
      });
    });
    
    return totals;
  };

  const totalWinnings = calculateTotalWinnings();
  const players = tournamentData.rounds[0]?.skinsGame.players || [];
  const topWinners = players
    .map(player => ({
      ...player,
      totalWinnings: totalWinnings[player.id] || 0
    }))
    .sort((a, b) => b.totalWinnings - a.totalWinnings)
    .slice(0, 3);

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-green-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">🏆 Tournament Leaders</h3>
      <div className="space-y-2">
        {topWinners.map((player, index) => (
          <div key={player.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-600">
                {index + 1}.
              </span>
              <span className="text-sm font-medium text-gray-900">
                {player.name}
              </span>
            </div>
            <span className="text-sm font-bold text-green-600">
              ${Math.round(player.totalWinnings)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-yellow-200">
        <div className="text-xs text-gray-600 text-center">
          Total across all rounds
        </div>
      </div>
    </div>
  );
};

export default TotalWinnings;