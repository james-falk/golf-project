import { ScrambleTeam, RoundData, ScrambleScore } from '@/types/golf';

/**
 * Calculate the number of players on a scramble team
 */
export const getTeamPlayerCount = (team: ScrambleTeam): number => {
  return team.players.filter(playerId => playerId !== null).length;
};

/**
 * Calculate per-player winnings for a team based on rank and team size
 */
export const calculatePerPlayerWinnings = (rank: number, playerCount: number): number => {
  if (playerCount === 0) return 0;
  
  if (rank === 1) {
    return 360 / playerCount; // First place: $360 divided by team size
  } else if (rank === 2) {
    return 80 / playerCount; // Second place: $80 divided by team size
  }
  return 0;
};

/**
 * Calculate scramble winnings for a specific player in a specific round
 */
export const calculatePlayerScrambleWinnings = (playerId: string, round: RoundData): number => {
  const scrambleGame = round.scrambleGame;
  
  // Find which team this player is on
  const playerTeam = scrambleGame.teams.find(team => 
    team.players.includes(playerId)
  );
  
  if (!playerTeam) return 0;
  
  // Find the team's result/ranking
  const teamResult = scrambleGame.results.find(result => result.teamId === playerTeam.id);
  if (!teamResult || teamResult.totalScore === 0) return 0;
  
  // Find the rank by sorting results and finding position
  const sortedResults = scrambleGame.results
    .filter(result => result.totalScore > 0)
    .sort((a, b) => a.totalScore - b.totalScore);
  
  const rank = sortedResults.findIndex(result => result.teamId === playerTeam.id) + 1;
  
  // Calculate per-player winnings
  const playerCount = getTeamPlayerCount(playerTeam);
  return calculatePerPlayerWinnings(rank, playerCount);
};

/**
 * Get all teams that have completed scores (for ranking purposes)
 */
export const getCompletedTeams = (round: RoundData): Array<{ team: ScrambleTeam; result: ScrambleScore; rank: number }> => {
  const completedResults = round.scrambleGame.results
    .filter(result => result.totalScore > 0)
    .sort((a, b) => a.totalScore - b.totalScore);
  
  return completedResults.map((result, index) => {
    const team = round.scrambleGame.teams.find(t => t.id === result.teamId);
    return {
      team: team!,
      result,
      rank: index + 1
    };
  });
};