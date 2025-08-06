'use client';

import React from 'react';
import { Player, ClosestToPinHole, RoundData } from '@/types/golf';

interface ClosestToPinTabProps {
  roundData: RoundData;
  updateRoundData?: (updater: (round: RoundData) => RoundData) => void;
  isReadOnly?: boolean;
}

const ClosestToPinTab: React.FC<ClosestToPinTabProps> = ({ roundData, updateRoundData, isReadOnly = false }) => {
  const players = roundData.closestToPinGame.players;
  const holes = roundData.closestToPinGame.holes;
  const totalPrizePool = roundData.closestToPinGame.totalPrizePool;

  const updateHoleWinner = (holeNumber: number, winnerId: string) => {
    if (isReadOnly || !updateRoundData) return;
    
    updateRoundData(round => ({
      ...round,
      closestToPinGame: {
        ...round.closestToPinGame,
        holes: round.closestToPinGame.holes.map(hole => 
          hole.hole === holeNumber 
            ? { ...hole, winner: winnerId, distance: undefined }
            : hole
        )
      }
    }));
  };

  const clearHoleWinner = (holeNumber: number) => {
    updateRoundData(round => ({
      ...round,
      closestToPinGame: {
        ...round.closestToPinGame,
        holes: round.closestToPinGame.holes.map(hole => 
          hole.hole === holeNumber 
            ? { ...hole, winner: undefined, distance: undefined }
            : hole
        )
      }
    }));
  };

  const getPlayerWinnings = (playerId: string): number => {
    return holes.filter(hole => hole.winner === playerId).length * 20;
  };

  const getPlayerName = (playerId: string): string => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  const getTotalAwarded = (): number => {
    return holes.filter(hole => hole.winner).reduce((sum, hole) => sum + hole.prize, 0);
  };

  const getRemainingPrize = (): number => {
    return totalPrizePool - getTotalAwarded();
  };

  return (
    <div className="space-y-8">
      {/* Prize Information Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="text-center">
          <p className="text-lg text-blue-800">
            Each par 3 hole is worth <span className="font-bold text-2xl text-blue-900">$20</span>
          </p>
        </div>
      </div>

      {/* Player Winnings Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Player Winnings</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {players.map(player => {
            const winnings = getPlayerWinnings(player.id);
            const wins = holes.filter(hole => hole.winner === player.id).length;
            return (
              <div key={player.id} className={`p-4 rounded-lg border ${
                winnings > 0 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="font-medium text-gray-900">{player.name}</div>
                <div className="text-sm text-gray-600 mb-2">
                  {wins} win{wins !== 1 ? 's' : ''}
                </div>
                <div className={`text-lg font-bold ${
                  winnings > 0 ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  ${winnings}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Par 3 Holes */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Par 3 Holes - Closest to Pin</h2>
        <div className="space-y-6">
          {holes.map(hole => (
            <div key={hole.hole} className="border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Hole {hole.hole} - Par {hole.par}
                  </h3>
                </div>
                {hole.winner && (
                  <button
                    onClick={() => clearHoleWinner(hole.hole)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Clear Winner
                  </button>
                )}
              </div>

              {hole.winner ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-blue-900">
                        🏆 Winner: {getPlayerName(hole.winner)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      $20
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-3">
                    Select the winner:
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {players.map(player => (
                      <button
                        key={player.id}
                        onClick={() => updateHoleWinner(hole.hole, player.id)}
                        disabled={isReadOnly}
                        className={`p-3 border rounded-lg transition-colors text-left ${
                          hole.winner === player.id
                            ? 'border-blue-500 bg-blue-100'
                            : isReadOnly 
                              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                        }`}
                      >
                        <div className={`font-medium ${
                          hole.winner === player.id ? 'text-blue-900' : 'text-gray-900'
                        }`}>{player.name}</div>
                        <div className={`text-sm ${
                          hole.winner === player.id ? 'text-blue-700' : 'text-gray-700'
                        }`}>{player.group} Player</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClosestToPinTab;