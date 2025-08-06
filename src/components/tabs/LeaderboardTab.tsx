'use client';

import React, { useState, useEffect } from 'react';
import { Player, RoundData, TournamentData } from '@/types/golf';
import { calculatePlayerScrambleWinnings } from '@/utils/scrambleUtils';

interface LeaderboardTabProps {
  tournamentData: TournamentData;
}

type PayoutTab = 'thursday' | 'friday' | 'saturday' | 'total';

const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ tournamentData }) => {
  const [activePayoutTab, setActivePayoutTab] = useState<PayoutTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golf-active-payout-tab');
      if (saved && ['thursday', 'friday', 'saturday', 'total'].includes(saved)) {
        return saved as PayoutTab;
      }
    }
    return 'total';
  });



  // Save active payout tab to localStorage
  useEffect(() => {
    localStorage.setItem('golf-active-payout-tab', activePayoutTab);
  }, [activePayoutTab]);

  // Calculate winnings for a specific player on a specific round
  const calculatePlayerRoundWinnings = (playerId: string, round: RoundData) => {
    let roundWinnings = 0;

    // Skins winnings
    const skinsWinnings = round.skinsGame.skinResults
      .filter(skin => skin.winner === playerId)
      .reduce((sum, skin) => sum + skin.pot, 0);
    roundWinnings += skinsWinnings;

    // Closest to Pin winnings ($20 per win)
    const ctpWinnings = round.closestToPinGame.holes
      .filter(hole => hole.winner === playerId).length * 20;
    roundWinnings += ctpWinnings;

    // Scramble winnings - per-player payout based on team size
    const scrambleWinnings = calculatePlayerScrambleWinnings(playerId, round);
    roundWinnings += scrambleWinnings;

    return roundWinnings;
  };

  // Calculate total winnings for each player across all rounds
  const calculatePlayerTotalWinnings = (playerId: string) => {
    return tournamentData.rounds.reduce((total, round) => {
      return total + calculatePlayerRoundWinnings(playerId, round);
    }, 0);
  };

  // Get all unique players from all rounds
  const getAllPlayers = (): Player[] => {
    const playersMap = new Map<string, Player>();
    
    tournamentData.rounds.forEach(round => {
      // Add players from skins game
      round.skinsGame.players.forEach(player => {
        playersMap.set(player.id, player);
      });
      
      // Add players from closest to pin game
      round.closestToPinGame.players.forEach(player => {
        playersMap.set(player.id, player);
      });
    });

    return Array.from(playersMap.values());
  };

  const allPlayers = getAllPlayers();



  // Get hardcoded prize pool amounts
  const getPrizePool = (tab: PayoutTab): number => {
    switch (tab) {
      case 'thursday': return 360;
      case 'friday': return 720;
      case 'saturday': return 720;
      case 'total': return 1800;
      default: return 0;
    }
  };

  // Get the current data based on active tab
  const getCurrentData = () => {
    if (activePayoutTab === 'total') {
      // Total across all rounds
      const leaderboard = allPlayers.map(player => ({
        ...player,
        totalWinnings: calculatePlayerTotalWinnings(player.id)
      })).sort((a, b) => b.totalWinnings - a.totalWinnings);

      const totalPayout = getPrizePool('total'); // Use hardcoded amount

      return {
        leaderboard,
        totalPayout,
        title: 'Total Tournament Payout',
        rounds: tournamentData.rounds
      };
    } else {
      // Single day
      const round = tournamentData.rounds.find(r => r.id === activePayoutTab);
      if (!round) return null;

      const leaderboard = allPlayers.map(player => ({
        ...player,
        totalWinnings: calculatePlayerRoundWinnings(player.id, round)
      })).sort((a, b) => b.totalWinnings - a.totalWinnings);

      const totalPayout = getPrizePool(activePayoutTab); // Use hardcoded amount

      return {
        leaderboard,
        totalPayout,
        title: round.name,
        rounds: [round]
      };
    }
  };

  const currentData = getCurrentData();
  if (!currentData) return <div>Round not found</div>;

  const payoutTabs = [
    { id: 'thursday' as PayoutTab, label: 'Thursday' },
    { id: 'friday' as PayoutTab, label: 'Friday' },
    { id: 'saturday' as PayoutTab, label: 'Saturday' },
    { id: 'total' as PayoutTab, label: 'Total' },
  ];

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Tournament Summary */}
      <div className="bg-gradient-to-r from-yellow-50 to-green-50 border border-yellow-200 rounded-lg p-3 sm:p-6">
        <div className="text-center">
          <h2 className="font-bold text-gray-900 text-lg sm:text-2xl mb-1 sm:mb-2">🏆 Tournament Payout Leaderboard</h2>
          <p className={`text-gray-700 ${false ? 'text-sm' : 'text-sm sm:text-lg'}`}>
            {activePayoutTab === 'thursday' ? 'Thursday' :
             activePayoutTab === 'friday' ? 'Friday' :
             activePayoutTab === 'saturday' ? 'Saturday' :
             'Total'} Prize Pool: <span className="font-bold text-green-600">${currentData.totalPayout}</span>
          </p>
          <p className={`text-gray-600 mt-1 ${false ? 'text-xs' : 'text-xs sm:text-sm'}`}>
            Combined winnings from Skins, Closest to Pin, and Scramble competitions
          </p>
        </div>
      </div>

      {/* Payout Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <div className={`${false ? 'px-3' : 'px-3 sm:px-6'}`}>
            <nav className={`flex overflow-x-auto ${false ? 'space-x-4' : 'space-x-4 sm:space-x-8'}`} aria-label="Payout tabs">
              {payoutTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivePayoutTab(tab.id)}
                  className={`${
                    activePayoutTab === tab.id
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap border-b-2 font-medium transition-colors duration-200 flex-shrink-0 ${
                    false ? 'py-3 px-2 text-xs' : 'py-3 sm:py-4 px-2 sm:px-1 text-xs sm:text-sm'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className={`${false ? 'p-3' : 'p-3 sm:p-6'}`}>
          <div className={`${false ? 'mb-3' : 'mb-3 sm:mb-6'}`}>
            <h3 className={`font-semibold text-gray-900 ${false ? 'text-lg' : 'text-lg sm:text-xl'}`}>{currentData.title}</h3>
            <p className={`text-gray-600 mt-1 ${false ? 'text-xs' : 'text-xs sm:text-sm'}`}>
              East Coast Big Playas 2.0 • Otsego Club, Gaylord, MI • Generated {new Date().toLocaleDateString()}
            </p>
          </div>
          
          {/* Leaderboard */}
          <div className={`${false ? 'space-y-2 mb-4' : 'space-y-2 sm:space-y-3 mb-4 sm:mb-8'}`}>
            {currentData.leaderboard.map((player, index) => (
              <div key={player.id} className={`flex items-center justify-between rounded-lg border-2 ${
                false ? 'p-2' : 'p-2 sm:p-4'
              } ${
                index === 0 && player.totalWinnings > 0
                  ? 'border-yellow-300 bg-yellow-50' // First place
                  : index === 1 && player.totalWinnings > 0
                  ? 'border-gray-300 bg-gray-50' // Second place
                  : index === 2 && player.totalWinnings > 0
                  ? 'border-orange-300 bg-orange-50' // Third place
                  : 'border-gray-200 bg-white' // Everyone else
              }`}>
                <div className={`flex items-center ${false ? 'space-x-1' : 'space-x-1 sm:space-x-4'}`}>
                  <div className={`font-bold ${
                    false ? 'text-base' : 'text-base sm:text-2xl'
                  } ${
                    index === 0 && player.totalWinnings > 0 ? 'text-yellow-600' :
                    index === 1 && player.totalWinnings > 0 ? 'text-gray-600' :
                    index === 2 && player.totalWinnings > 0 ? 'text-orange-600' :
                    'text-gray-400'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className={`font-semibold text-gray-900 ${false ? 'text-sm' : 'text-sm sm:text-lg'}`}>{player.name}</div>
                    <div className="text-xs text-gray-600">{player.group} Player</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`font-bold ${
                    false ? 'text-base' : 'text-base sm:text-2xl'
                  } ${
                    player.totalWinnings > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    ${player.totalWinnings}
                  </div>
                  {index === 0 && player.totalWinnings > 0 && (
                    <div className="text-xs text-yellow-600 font-medium">👑 Champion</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown by Game Type */}
          <div className={`bg-gray-50 rounded-lg ${false ? 'p-3' : 'p-3 sm:p-6'}`}>
            <h4 className={`font-semibold text-gray-900 ${false ? 'text-base mb-2' : 'text-base sm:text-lg mb-2 sm:mb-4'}`}>Winnings Breakdown</h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={`text-left font-semibold text-gray-900 ${
                      false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                    }`}>Player</th>
                    <th className={`text-right font-semibold text-gray-900 ${
                      false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                    }`}>Skins</th>
                    <th className={`text-right font-semibold text-gray-900 ${
                      false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                    }`}>CTP</th>
                    {(activePayoutTab === 'friday' || activePayoutTab === 'saturday' || activePayoutTab === 'total') && (
                      <th className={`text-right font-semibold text-gray-900 ${
                        false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                      }`}>Scramble</th>
                    )}
                    <th className={`text-right font-semibold text-gray-900 border-l border-gray-200 ${
                      false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                    }`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.leaderboard.map((player) => {
                    // Calculate individual game winnings for the selected period
                    let skinsTotal = 0;
                    let ctpTotal = 0;
                    const scrambleTotal = 0;

                    currentData.rounds.forEach(round => {
                      // Skins
                      skinsTotal += round.skinsGame.skinResults
                        .filter(skin => skin.winner === player.id)
                        .reduce((sum, skin) => sum + skin.pot, 0);
                      
                      // Closest to Pin
                      ctpTotal += round.closestToPinGame.holes
                        .filter(hole => hole.winner === player.id).length * 20;
                      
                      // Scramble (TODO: implement when scramble structure is ready)
                    });

                    return (
                      <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className={`font-medium text-gray-900 ${
                          false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                        }`}>{player.name}</td>
                        <td className={`text-right text-gray-700 ${
                          false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                        }`}>${skinsTotal}</td>
                        <td className={`text-right text-gray-700 ${
                          false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                        }`}>${ctpTotal}</td>
                        {(activePayoutTab === 'friday' || activePayoutTab === 'saturday' || activePayoutTab === 'total') && (
                          <td className={`text-right text-gray-700 ${
                            false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                          }`}>${scrambleTotal}</td>
                        )}
                        <td className={`text-right font-bold text-green-600 border-l border-gray-200 ${
                          false ? 'py-2 px-2 text-xs' : 'py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm'
                        }`}>
                          ${player.totalWinnings}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardTab;