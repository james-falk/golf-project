'use client';

import React, { useEffect } from 'react';
import { ScrambleTeam, ScrambleScore, RoundData } from '@/types/golf';
import { getTeamPlayerCount as utilGetTeamPlayerCount, calculatePerPlayerWinnings } from '@/utils/scrambleUtils';
import { demoPlayers, demoCourse } from '@/data/demoData';

interface ScrambleTabProps {
  roundData: RoundData;
  updateRoundData: (updater: (round: RoundData) => RoundData) => void;
  isReadOnly?: boolean;
}

const ScrambleTab: React.FC<ScrambleTabProps> = ({ roundData, updateRoundData, isReadOnly = false }) => {
  const teams = roundData.scrambleGame.teams;
  const scores = roundData.scrambleGame.scores;
  const results = roundData.scrambleGame.results;

  // Ensure exactly 5 teams with correct structure
  useEffect(() => {
    
    if (teams.length !== 5 || teams.some(team => team.players.length !== 4)) {
      const initialTeams: ScrambleTeam[] = Array.from({ length: 5 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: '',
        players: [null, null, null, null] // 4 slots per team
      }));

      updateRoundData(round => ({
        ...round,
        scrambleGame: {
          ...round.scrambleGame,
          teams: initialTeams
        }
      }));
    }
  }, [teams.length]);

  // Update results in data when teams or scores change
  useEffect(() => {
    
    // Calculate team results
    const teamResults: ScrambleScore[] = teams.map(team => {
      const teamScores = scores[team.id] || [];
      const totalScore = teamScores.reduce((sum, score) => sum + score.score, 0);
      
      return {
        teamId: team.id,
        scores: teamScores,
        totalScore,
      };
    });

    // Sort by total score (lowest first), but put teams with no scores at the end
    teamResults.sort((a, b) => {
      // If both teams have no score, maintain their original order
      if (a.totalScore === 0 && b.totalScore === 0) return 0;
      // If team A has no score, put it after team B
      if (a.totalScore === 0) return 1;
      // If team B has no score, put it after team A
      if (b.totalScore === 0) return -1;
      // Both teams have scores, sort by lowest score first
      return a.totalScore - b.totalScore;
    });
    
    updateRoundData(round => ({
      ...round,
      scrambleGame: {
        ...round.scrambleGame,
        results: teamResults
      }
    }));
  }, [teams, scores]);

  const updateTeamPlayer = (teamId: string, playerIndex: number, playerId: string | null) => {
    if (isReadOnly) return;
    
    updateRoundData(round => ({
      ...round,
      scrambleGame: {
        ...round.scrambleGame,
        teams: round.scrambleGame.teams.map(team => 
          team.id === teamId 
            ? { 
                ...team, 
                players: team.players.map((p, i) => i === playerIndex ? playerId : p)
              }
            : team
        )
      }
    }));
  };

  const updateTeamName = (teamId: string, newName: string) => {
    if (isReadOnly) return;
    
    updateRoundData(round => ({
      ...round,
      scrambleGame: {
        ...round.scrambleGame,
        teams: round.scrambleGame.teams.map(team => 
          team.id === teamId 
            ? { ...team, name: newName }
            : team
        )
      }
    }));
  };

  const updateTeamTotalScore = (teamId: string, totalScore: number) => {
    if (isReadOnly) return;
    
    updateRoundData(round => {
      const teamScores = totalScore > 0 ? [{ hole: 1, score: totalScore, par: 72 }] : [];
      
      return {
        ...round,
        scrambleGame: {
          ...round.scrambleGame,
          scores: {
            ...round.scrambleGame.scores,
            [teamId]: teamScores
          }
        }
      };
    });
  };

  const getAvailablePlayersForSlot = (teamId: string, playerIndex: number): typeof demoPlayers => {
    // Get all currently selected player IDs from all teams, excluding the current slot
    const selectedPlayerIds = new Set<string>();
    
    teams.forEach(team => {
      team.players.forEach((playerId, index) => {
        if (playerId && !(team.id === teamId && index === playerIndex)) {
          selectedPlayerIds.add(playerId);
        }
      });
    });

    // Return players not already selected
    return demoPlayers.filter(player => !selectedPlayerIds.has(player.id));
  };

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return '';
    return demoPlayers.find(p => p.id === playerId)?.name || 'Unknown';
  };

  const getTeamPlayerNames = (team: ScrambleTeam): string[] => {
    return team.players
      .filter((playerId): playerId is string => playerId !== null)
      .map(playerId => getPlayerName(playerId));
  };

  // Use utility functions for consistency
  const getTeamPlayerCount = utilGetTeamPlayerCount;
  // calculatePerPlayerWinnings is now imported directly from utils

  const getTotalPar = (holes: number): number => {
    return demoCourse.holes.slice(0, holes).reduce((sum, hole) => sum + hole.par, 0);
  };

  const getScoreVsPar = (totalScore: number, holes: number): string => {
    const par = getTotalPar(holes);
    const difference = totalScore - par;
    if (difference === 0) return 'E';
    return difference > 0 ? `+${difference}` : `${difference}`;
  };

  const getClassicScoreVsPar = (totalScore: number): string => {
    const par = 72;
    const difference = totalScore - par;
    if (difference === 0) return 'E (Even)';
    return difference > 0 ? `+${difference} (${difference} over)` : `${difference} (${Math.abs(difference)} under)`;
  };

  const getRankSuffix = (rank: number): string => {
    if (rank === 1) return 'st';
    if (rank === 2) return 'nd';
    if (rank === 3) return 'rd';
    return 'th';
  };

  return (
    <div className="space-y-8">
      {/* Prize Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-center text-blue-700 text-lg">
          <div>Scramble pot $360</div>
          <div>1st 🥇 $280</div>
          <div>2nd 🥈 $80</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{roundData.day} Results - The Classic Course</h2>
        {results.length > 0 ? (
          <div className="space-y-3">
            {results.map((result, index) => {
              const team = teams.find(t => t.id === result.teamId);
              const holesPlayed = result.scores.length;
              const rank = index + 1;
              const teamPlayerNames = team ? getTeamPlayerNames(team) : [];
              
              return (
                <div
                  key={result.teamId}
                  className={`p-4 rounded-lg border-2 ${
                    rank === 1
                      ? 'border-yellow-400 bg-yellow-50'
                      : rank === 2
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`text-2xl font-bold ${
                        rank === 1
                          ? 'text-yellow-600'
                          : rank === 2
                          ? 'text-gray-600'
                          : 'text-gray-600'
                      }`}>
                        {rank === 1 && '🥇'}
                        {rank === 2 && '🥈'}
                        {rank > 2 && `${rank}${getRankSuffix(rank)}`}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-lg">
                          {team?.name || `Team ${team?.id.split('-')[1] || '?'}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          {teamPlayerNames.length > 0 ? teamPlayerNames.join(' & ') : 'No players assigned'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {result.totalScore}
                      </div>
                      <div className="text-sm text-gray-600">
                        {result.totalScore > 0 ? getClassicScoreVsPar(result.totalScore) : 'No score entered'}
                      </div>
                      {result.totalScore > 0 && (() => {
                        // Check if this team should get a payout
                        const sortedResults = results.filter(r => r.totalScore > 0);
                        const teamScore = result.totalScore;
                        const firstPlaceScore = sortedResults[0]?.totalScore;
                        const firstPlaceTeams = sortedResults.filter(r => r.totalScore === firstPlaceScore);
                        
                        const isFirstPlace = teamScore === firstPlaceScore;
                        
                        // Only check for second place if there's exactly one first place team
                        let isSecondPlace = false;
                        if (firstPlaceTeams.length === 1) {
                          const secondPlaceScore = sortedResults.find(r => r.totalScore > firstPlaceScore)?.totalScore;
                          isSecondPlace = teamScore === secondPlaceScore;
                        }
                        
                        if (!isFirstPlace && !isSecondPlace) return null;
                        
                        const team = teams.find(t => t.id === result.teamId);
                        const playerCount = team ? getTeamPlayerCount(team) : 0;
                        
                        let tieInfo: { position: number; tiedTeams: number; } | undefined;
                        let tieText = '';
                        
                        if (isFirstPlace) {
                          tieInfo = { position: 1, tiedTeams: firstPlaceTeams.length };
                          if (firstPlaceTeams.length > 1) {
                            tieText = ` (tied with ${firstPlaceTeams.length - 1} other${firstPlaceTeams.length > 2 ? 's' : ''})`;
                          }
                        } else if (isSecondPlace) {
                          const secondPlaceScore = sortedResults.find(r => r.totalScore > firstPlaceScore)?.totalScore;
                          const secondPlaceTeams = sortedResults.filter(r => r.totalScore === secondPlaceScore);
                          tieInfo = { position: 2, tiedTeams: secondPlaceTeams.length };
                          if (secondPlaceTeams.length > 1) {
                            tieText = ` (tied with ${secondPlaceTeams.length - 1} other${secondPlaceTeams.length > 2 ? 's' : ''})`;
                          }
                        }
                        
                        const perPlayerWinnings = calculatePerPlayerWinnings(isFirstPlace ? 1 : 2, playerCount, tieInfo);
                        const potInfo = tieInfo 
                          ? (tieInfo.position === 1 
                              ? (tieInfo.tiedTeams === 1 
                                  ? '$280' 
                                  : `$360 ÷ ${tieInfo.tiedTeams} team${tieInfo.tiedTeams !== 1 ? 's' : ''}`)
                              : `$80 ÷ ${tieInfo.tiedTeams} team${tieInfo.tiedTeams !== 1 ? 's' : ''}`)
                          : (isFirstPlace ? '$280' : '$80');
                        
                        return (
                          <div className="text-lg font-bold text-green-600 mt-1">
                            {playerCount > 0 ? (
                              <>
                                ${Math.floor(perPlayerWinnings)} per player{tieText}
                                <div className="text-sm text-gray-600 font-normal">
                                  ({potInfo} ÷ {playerCount} player{playerCount !== 1 ? 's' : ''})
                                </div>
                              </>
                            ) : (
                              <>Wins {potInfo}{tieText}</>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Set up teams and enter scores to see the leaderboard.
          </div>
        )}
      </div>

      {/* Team Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Scramble Team Setup - The Classic Course</h2>
        <div className="space-y-6">
          {teams.map(team => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-6 shadow-sm">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => updateTeamName(team.id, e.target.value)}
                  placeholder="Enter team name..."
                  disabled={isReadOnly}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none font-semibold text-gray-900 ${
                    isReadOnly 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                      : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
                  }`}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {team.players.map((playerId, playerIndex) => {
                  const availablePlayers = getAvailablePlayersForSlot(team.id, playerIndex);
                  
                  return (
                    <div key={playerIndex} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Player {playerIndex + 1}
                      </label>
                      <select
                        value={playerId || ''}
                        onChange={(e) => updateTeamPlayer(team.id, playerIndex, e.target.value || null)}
                        disabled={isReadOnly}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none text-gray-900 ${
                          isReadOnly 
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                            : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
                        }`}
                      >
                        <option value="">Select Player...</option>
                        {availablePlayers.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name} ({player.group} Player)
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">
                      Players: {getTeamPlayerNames(team).join(', ') || 'No players selected'}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      The Classic Course • Par 72
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Round Score
                    </label>
                    <input
                      type="number"
                      value={scores[team.id]?.[0]?.score || ''}
                      onChange={(e) => updateTeamTotalScore(team.id, Number(e.target.value))}
                      placeholder="Enter total score..."
                      disabled={isReadOnly}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none text-gray-900 ${
                        isReadOnly 
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
                      }`}
                      min="50"
                      max="150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Score vs Par
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800 font-semibold">
                      {scores[team.id]?.[0]?.score ? getClassicScoreVsPar(scores[team.id][0].score) : 'Enter score'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
};

export default ScrambleTab;