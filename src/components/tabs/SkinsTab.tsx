'use client';

import React, { useEffect, useCallback } from 'react';
import { Player, SkinScore, RoundData } from '@/types/golf';
import { demoCourse } from '@/data/demoData';

interface SkinsTabProps {
  roundData: RoundData;
  updateRoundData?: (updater: (round: RoundData) => RoundData) => void;
  isReadOnly?: boolean;
}

const SkinsTab: React.FC<SkinsTabProps> = ({ roundData, updateRoundData, isReadOnly = false }) => {
  const players = roundData.skinsGame.players;
  const scores = roundData.skinsGame.scores;
  const potPerHole = roundData.skinsGame.potPerHole;
  const skinResults = roundData.skinsGame.skinResults;

  // Calculate net scores and skins
  useEffect(() => {
    calculateSkins();
  }, [calculateSkins]);

  // Helper function to check if a player gets a stroke on a specific hole
  const getStrokesOnHole = (playerGroup: 'A' | 'B' | 'C' | 'D', holeNumber: number): number => {
    const holeData = demoCourse.holes.find(h => h.number === holeNumber);
    if (!holeData || !holeData.handicap) return 0;

    let totalStrokes = 0;
    switch (playerGroup) {
      case 'A': totalStrokes = 0; break;
      case 'B': totalStrokes = 6; break;
      case 'C': totalStrokes = 12; break;
      case 'D': totalStrokes = 18; break;
    }

    if (totalStrokes === 0) return 0;

    // Each full 18 strokes gives 1 stroke on every hole
    let strokesOnHole = Math.floor(totalStrokes / 18);
    
    // Remaining strokes go to hardest holes first (lowest handicap rating)
    const remainingStrokes = totalStrokes % 18;
    if (remainingStrokes >= holeData.handicap) {
      strokesOnHole += 1;
    }
    
    return strokesOnHole;
  };

  const calculateNetScore = (score: number, par: number, playerGroup: 'A' | 'B' | 'C' | 'D', holeNumber: number): number => {
    // Fixed strokes per group system
    const holeData = demoCourse.holes.find(h => h.number === holeNumber);
    if (!holeData || !holeData.handicap) {
      return score; // No strokes if no hole data
    }

    // Group-based stroke allocation
    let totalStrokes = 0;
    switch (playerGroup) {
      case 'A': totalStrokes = 0; break;   // A players get no strokes
      case 'B': totalStrokes = 6; break;   // B players get 6 strokes
      case 'C': totalStrokes = 12; break;  // C players get 12 strokes
      case 'D': totalStrokes = 18; break;  // D players get 18 strokes
    }

    if (totalStrokes === 0) return score; // A players get no strokes

    // Calculate strokes on this hole
    let strokesOnHole = 0;
    
    // Each full 18 strokes gives 1 stroke on every hole
    strokesOnHole += Math.floor(totalStrokes / 18);
    
    // Remaining strokes go to hardest holes first (lowest handicap rating)
    const remainingStrokes = totalStrokes % 18;
    if (remainingStrokes >= holeData.handicap) {
      strokesOnHole += 1;
    }
    
    return score - strokesOnHole;
  };

  const calculateSkins = useCallback(() => {
    if (!updateRoundData) return; // Don't calculate skins if we can't update data
    
    const results: SkinScore[] = [];
    const holesWithScores = Math.max(...players.map(p => scores[p.id]?.length || 0));

    // First pass: collect all skins without pot calculation
    for (let hole = 1; hole <= holesWithScores; hole++) {
      const holeData = demoCourse.holes.find(h => h.number === hole);
      if (!holeData) continue;

      const holeScores: { playerId: string; netScore: number; grossScore: number }[] = [];

      players.forEach(player => {
        const playerScore = scores[player.id]?.find(s => s.hole === hole);
        if (playerScore) {
          const netScore = calculateNetScore(playerScore.score, holeData.par, player.group, hole);
          holeScores.push({
            playerId: player.id,
            netScore,
            grossScore: playerScore.score
          });
        }
      });

      if (holeScores.length > 0) {
        const bestNetScore = Math.min(...holeScores.map(s => s.netScore));
        const winners = holeScores.filter(s => s.netScore === bestNetScore);
        
        const skinResult: SkinScore = {
          hole,
          score: bestNetScore,
          par: holeData.par,
          netScore: bestNetScore,
          pot: 0, // Will be calculated after we know total skins
          winner: winners.length === 1 ? winners[0].playerId : undefined
        };

        results.push(skinResult);
      }
    }

    // Count actual skins won (not tied)
    const skinsWon = results.filter(skin => skin.winner !== undefined).length;
    
    // Calculate pot per skin dynamically
    const totalPot = roundData.skinsGame.totalPot; // $280
    const potPerSkin = skinsWon > 0 ? Math.round((totalPot / skinsWon) * 100) / 100 : 0; // Round to 2 decimal places
    
    // Update pot amounts for won skins
    results.forEach(skin => {
      if (skin.winner !== undefined) {
        skin.pot = potPerSkin;
      }
    });

    updateRoundData(round => ({
      ...round,
      skinsGame: {
        ...round.skinsGame,
        skinResults: results,
        potPerHole: potPerSkin // Update the display value
      }
    }));
  }, [players, scores, roundData.skinsGame.totalPot, updateRoundData]);

  const updateScore = (playerId: string, hole: number, newScore: number) => {
    if (isReadOnly || !updateRoundData) return;
    
    updateRoundData(round => {
      const currentScores = round.skinsGame.scores[playerId] || [];
      const playerScores = currentScores.filter(s => s.hole !== hole);
      
      // Only add score if it's greater than 0
      if (newScore > 0) {
        playerScores.push({ 
          hole, 
          score: newScore, 
          par: demoCourse.holes.find(h => h.number === hole)?.par || 4 
        });
      }
      
      return {
        ...round,
        skinsGame: {
          ...round.skinsGame,
          scores: {
            ...round.skinsGame.scores,
            [playerId]: playerScores.sort((a, b) => a.hole - b.hole)
          }
        }
      };
    });
  };

  const getPlayerWinnings = (playerId: string): number => {
    return skinResults.filter(skin => skin.winner === playerId).reduce((sum, skin) => sum + skin.pot, 0);
  };

  const getPlayerName = (playerId: string): string => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-8">
      {/* Game Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Game Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Skins Pot
            </label>
            <div className="px-3 py-2 bg-blue-50 border border-blue-300 rounded-md text-blue-900 font-semibold">
              ${roundData.skinsGame.totalPot}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skins Won / Pot Per Skin
            </label>
            <div className="px-3 py-2 bg-green-50 border border-green-300 rounded-md text-green-900 font-semibold">
              {skinResults.filter(skin => skin.winner).length} skins / ${potPerHole > 0 ? potPerHole.toFixed(2) : '0.00'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Players
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
              {players.length} players
            </div>
          </div>
        </div>
      </div>

      {/* Winnings Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Skins Winnings Summary</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-3">
          {players.map(player => {
            const winnings = getPlayerWinnings(player.id);
            return (
              <div key={player.id} className={`p-2 rounded-lg ${
                winnings > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="font-medium text-gray-900 text-sm">{player.name}</div>
                <div className={`text-lg font-bold ${
                  winnings > 0 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  ${winnings}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skins Results */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Skins Results</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {skinResults.map(skin => (
            <div key={skin.hole} className={`rounded-lg p-3 border-2 ${
              skin.winner ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-gray-900 text-base">Hole {skin.hole}</h3>
                <span className="text-base font-medium text-green-600">${skin.pot}</span>
              </div>
              <div className="text-base text-gray-600 mb-1">
                Par {skin.par} • Best Net: {skin.netScore}
              </div>
              {skin.winner ? (
                <div className="text-base font-medium text-green-700">
                  Winner: {getPlayerName(skin.winner)}
                </div>
              ) : (
                <div className="text-base text-gray-500">
                  Tie - No winner
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scorecard */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 overflow-x-auto">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">The Tribute Skins Calculator</h2>
        <div className="text-xs sm:text-sm text-gray-600 mb-4">
          Showing {players.length} players • Group A: 0 strokes, B: 6 strokes, C: 12 strokes, D: 18 strokes
        </div>
        <div className="min-w-full">
          <div className="space-y-8">
            {players.map(player => (
              <div key={player.id} className="border border-gray-400 rounded-lg p-4">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 text-lg">{player.name}</h3>
                  <div className="text-sm text-gray-600">
                                            {player.group} Player ({player.group === 'A' ? '0' : player.group === 'B' ? '6' : player.group === 'C' ? '12' : '18'} strokes) • 
                    Total Score: {scores[player.id]?.reduce((sum, score) => sum + score.score, 0) || 0}
                  </div>
                </div>
                
                {/* Front 9 */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-black bg-gray-100 px-3 py-2 rounded mb-2">Front Nine</h4>
                  <div className="grid grid-cols-10 gap-0 border border-gray-200 rounded">
                    <div className="text-sm font-bold underline text-gray-800 text-center py-2 border-b border-r border-gray-200 bg-gray-50">Hole</div>
                    {demoCourse.holes.slice(0, 9).map((hole, index) => {
                      const strokesOnHole = getStrokesOnHole(player.group, hole.number);
                      return (
                        <div key={hole.number} className={`text-sm font-bold underline text-center py-2 border-b border-gray-200 ${index < 8 ? 'border-r' : ''} ${
                          strokesOnHole > 0 
                            ? 'bg-yellow-200 text-yellow-900 font-bold' 
                            : 'bg-gray-50 text-gray-800'
                        }`}>
                          {hole.number}

                        </div>
                      );
                    })}
                    
                    <div className="text-sm font-bold text-gray-800 text-center py-2 border-b border-r border-gray-200">Par</div>
                    {demoCourse.holes.slice(0, 9).map((hole, index) => {
                      const strokesOnHole = getStrokesOnHole(player.group, hole.number);
                      return (
                        <div key={hole.number} className={`text-sm font-bold text-center py-2 border-b border-gray-200 ${index < 8 ? 'border-r' : ''} ${
                          strokesOnHole > 0 
                            ? 'bg-yellow-200 text-yellow-900' 
                            : 'text-gray-700'
                        }`}>
                          {hole.par}
                        </div>
                      );
                    })}
                    
                    <div className="text-sm font-bold text-gray-800 text-center py-2 border-b border-r border-gray-200">HCP</div>
                    {demoCourse.holes.slice(0, 9).map((hole, index) => {
                      const strokesOnHole = getStrokesOnHole(player.group, hole.number);
                      return (
                        <div key={hole.number} className={`text-sm font-bold text-center py-2 border-b border-gray-200 ${index < 8 ? 'border-r' : ''} ${
                          strokesOnHole > 0 
                            ? 'bg-yellow-200 text-yellow-900' 
                            : 'text-gray-700'
                        }`}>
                          {hole.handicap}
                        </div>
                      );
                    })}
                    
                    <div className="text-sm font-bold text-gray-800 text-center py-2 border-r border-gray-200">Score</div>
                    {demoCourse.holes.slice(0, 9).map(hole => {
                      const playerScore = scores[player.id]?.find(s => s.hole === hole.number);
                      const netScore = playerScore ? calculateNetScore(playerScore.score, hole.par, player.group, hole.number) : null;
                      const groupStrokes = player.group === 'A' ? 0 : player.group === 'B' ? 6 : player.group === 'C' ? 12 : 18;
                      let strokesOnHole = 0;
                      if (groupStrokes > 0 && hole.handicap) {
                        strokesOnHole = Math.floor(groupStrokes / 18) + (groupStrokes % 18 >= hole.handicap ? 1 : 0);
                      }
                      
                      return (
                        <div key={hole.number} className={`flex flex-col items-center space-y-1 py-2 ${hole.number < 9 ? 'border-r border-gray-200' : ''} ${
                          strokesOnHole > 0 ? 'bg-yellow-200' : ''
                        }`}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={playerScore?.score || ''}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^[1-9]$/.test(value)) {
                                const numValue = Number(value);
                                if (numValue >= 1 && numValue <= 9) {
                                  updateScore(player.id, hole.number, numValue);
                                  setTimeout(() => {
                                    const currentInput = e.target as HTMLInputElement;
                                    const allInputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
                                    const currentIndex = allInputs.indexOf(currentInput);
                                    const nextInput = allInputs[currentIndex + 1];
                                    if (nextInput) {
                                      nextInput.focus();
                                      nextInput.select();
                                    }
                                  }, 50);
                                }
                              } else if (value === '') {
                                updateScore(player.id, hole.number, 0);
                              } else if (/^\d{2}$/.test(value)) {
                                const numValue = Number(value);
                                if (numValue >= 10 && numValue <= 12) {
                                  updateScore(player.id, hole.number, numValue);
                                  setTimeout(() => {
                                    const currentInput = e.target as HTMLInputElement;
                                    const allInputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
                                    const currentIndex = allInputs.indexOf(currentInput);
                                    const nextInput = allInputs[currentIndex + 1];
                                    if (nextInput) {
                                      nextInput.focus();
                                      nextInput.select();
                                    }
                                  }, 50);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if ([8, 9, 27, 13, 37, 38, 39, 40, 46].includes(e.keyCode)) {
                                return;
                              }
                              if ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && e.ctrlKey) {
                                return;
                              }
                              const isMainKeyboardNumber = e.keyCode >= 49 && e.keyCode <= 57;
                              const isNumpadNumber = e.keyCode >= 97 && e.keyCode <= 105;
                              if (!isMainKeyboardNumber && !isNumpadNumber) {
                                e.preventDefault();
                              }
                            }}
                            className="w-14 sm:w-12 px-2 py-2 sm:py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-black font-semibold"
                            placeholder=""
                            maxLength={2}
                          />
                          {playerScore?.score && (
                            <button
                              onClick={() => updateScore(player.id, hole.number, 0)}
                              className="text-xs text-red-500 hover:text-red-700 font-bold"
                              title="Clear score"
                            >
                              ×
                            </button>
                          )}
                          {netScore !== null && playerScore?.score && playerScore.score > 0 && (
                            <div className="text-sm font-bold text-gray-800">
                              Net: {netScore}
                              {strokesOnHole > 0 && (
                                <div className="text-sm font-bold text-blue-600">
                                  ({strokesOnHole}★)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Back 9 */}
                <div>
                  <h4 className="text-sm font-bold text-black bg-gray-100 px-3 py-2 rounded mb-2">Back Nine</h4>
                  <div className="grid grid-cols-10 gap-0 border border-gray-200 rounded">
                    <div className="text-sm font-bold underline text-gray-800 text-center py-2 border-b border-r border-gray-200 bg-gray-50">Hole</div>
                    {demoCourse.holes.slice(9, 18).map((hole, index) => {
                      const strokesOnHole = getStrokesOnHole(player.group, hole.number);
                      return (
                        <div key={hole.number} className={`text-sm font-bold underline text-center py-2 border-b border-gray-200 ${index < 8 ? 'border-r' : ''} ${
                          strokesOnHole > 0 
                            ? 'bg-yellow-200 text-yellow-900 font-bold' 
                            : 'bg-gray-50 text-gray-800'
                        }`}>
                          {hole.number}

                        </div>
                      );
                    })}
                    
                    <div className="text-sm font-bold text-gray-800 text-center py-2 border-b border-r border-gray-200">Par</div>
                    {demoCourse.holes.slice(9, 18).map((hole, index) => {
                      const strokesOnHole = getStrokesOnHole(player.group, hole.number);
                      return (
                        <div key={hole.number} className={`text-sm font-bold text-center py-2 border-b border-gray-200 ${index < 8 ? 'border-r' : ''} ${
                          strokesOnHole > 0 
                            ? 'bg-yellow-200 text-yellow-900' 
                            : 'text-gray-700'
                        }`}>
                          {hole.par}
                        </div>
                      );
                    })}
                    
                    <div className="text-sm font-bold text-gray-800 text-center py-2 border-b border-r border-gray-200">HCP</div>
                    {demoCourse.holes.slice(9, 18).map((hole, index) => {
                      const strokesOnHole = getStrokesOnHole(player.group, hole.number);
                      return (
                        <div key={hole.number} className={`text-sm font-bold text-center py-2 border-b border-gray-200 ${index < 8 ? 'border-r' : ''} ${
                          strokesOnHole > 0 
                            ? 'bg-yellow-200 text-yellow-900' 
                            : 'text-gray-700'
                        }`}>
                          {hole.handicap}
                        </div>
                      );
                    })}
                    
                    <div className="text-sm font-bold text-gray-800 text-center py-2 border-r border-gray-200">Score</div>
                    {demoCourse.holes.slice(9, 18).map(hole => {
                      const playerScore = scores[player.id]?.find(s => s.hole === hole.number);
                      const netScore = playerScore ? calculateNetScore(playerScore.score, hole.par, player.group, hole.number) : null;
                      const groupStrokes = player.group === 'A' ? 0 : player.group === 'B' ? 6 : player.group === 'C' ? 12 : 18;
                      let strokesOnHole = 0;
                      if (groupStrokes > 0 && hole.handicap) {
                        strokesOnHole = Math.floor(groupStrokes / 18) + (groupStrokes % 18 >= hole.handicap ? 1 : 0);
                      }
                      
                      return (
                        <div key={hole.number} className={`flex flex-col items-center space-y-1 py-2 ${hole.number < 18 ? 'border-r border-gray-200' : ''} ${
                          strokesOnHole > 0 ? 'bg-yellow-200' : ''
                        }`}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={playerScore?.score || ''}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^[1-9]$/.test(value)) {
                                const numValue = Number(value);
                                if (numValue >= 1 && numValue <= 9) {
                                  updateScore(player.id, hole.number, numValue);
                                  setTimeout(() => {
                                    const currentInput = e.target as HTMLInputElement;
                                    const allInputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
                                    const currentIndex = allInputs.indexOf(currentInput);
                                    const nextInput = allInputs[currentIndex + 1];
                                    if (nextInput) {
                                      nextInput.focus();
                                      nextInput.select();
                                    }
                                  }, 50);
                                }
                              } else if (value === '') {
                                updateScore(player.id, hole.number, 0);
                              } else if (/^\d{2}$/.test(value)) {
                                const numValue = Number(value);
                                if (numValue >= 10 && numValue <= 12) {
                                  updateScore(player.id, hole.number, numValue);
                                  setTimeout(() => {
                                    const currentInput = e.target as HTMLInputElement;
                                    const allInputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
                                    const currentIndex = allInputs.indexOf(currentInput);
                                    const nextInput = allInputs[currentIndex + 1];
                                    if (nextInput) {
                                      nextInput.focus();
                                      nextInput.select();
                                    }
                                  }, 50);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if ([8, 9, 27, 13, 37, 38, 39, 40, 46].includes(e.keyCode)) {
                                return;
                              }
                              if ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && e.ctrlKey) {
                                return;
                              }
                              const isMainKeyboardNumber = e.keyCode >= 49 && e.keyCode <= 57;
                              const isNumpadNumber = e.keyCode >= 97 && e.keyCode <= 105;
                              if (!isMainKeyboardNumber && !isNumpadNumber) {
                                e.preventDefault();
                              }
                            }}
                            className="w-14 sm:w-12 px-2 py-2 sm:py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-black font-semibold"
                            placeholder=""
                            maxLength={2}
                          />
                          {playerScore?.score && (
                            <button
                              onClick={() => updateScore(player.id, hole.number, 0)}
                              className="text-xs text-red-500 hover:text-red-700 font-bold"
                              title="Clear score"
                            >
                              ×
                            </button>
                          )}
                          {netScore !== null && playerScore?.score && playerScore.score > 0 && (
                            <div className="text-sm font-bold text-gray-800">
                              Net: {netScore}
                              {strokesOnHole > 0 && (
                                <div className="text-sm font-bold text-blue-600">
                                  ({strokesOnHole}★)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SkinsTab;