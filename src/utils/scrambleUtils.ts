import { ScrambleTeam, RoundData, ScrambleScore } from '@/types/golf';

/**
 * Calculate the number of players on a scramble team
 */
export const getTeamPlayerCount = (team: ScrambleTeam): number => {
  return team.players.filter(playerId => playerId !== null).length;
};

/**
 * Calculate per-player winnings for a team based on rank and team size
 * This function handles tie-splitting logic
 */
export const calculatePerPlayerWinnings = (rank: number, playerCount: number, tieInfo?: { position: number; tiedTeams: number; }): number => {
  if (playerCount === 0) return 0;
  
  // If no tie info provided, use legacy logic for backward compatibility
  if (!tieInfo) {
    if (rank === 1) {
      return 280 / playerCount; // First place: $280 divided by team size
    } else if (rank === 2) {
      return 80 / playerCount; // Second place: $80 divided by team size
    }
    return 0;
  }

  const { position, tiedTeams } = tieInfo;
  
  if (position === 1) {
    if (tiedTeams === 1) {
      // Outright winner - gets $280 first place pot
      return 280 / playerCount;
    } else {
      // Multiple teams tied for first place - split the entire pot ($360)
      const totalPot = 360;
      const potPerTeam = totalPot / tiedTeams;
      return potPerTeam / playerCount;
    }
  } else if (position === 2) {
    // Tied for second place - first place gets $280, split remaining $80
    const secondPlacePot = 80;
    const potPerTeam = secondPlacePot / tiedTeams;
    return potPerTeam / playerCount;
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
  
  // Get sorted results for tie detection
  const sortedResults = scrambleGame.results
    .filter(result => result.totalScore > 0)
    .sort((a, b) => a.totalScore - b.totalScore);
  
  // Find this team's score
  const teamScore = teamResult.totalScore;
  
  // Detect ties and calculate position
  const firstPlaceScore = sortedResults[0]?.totalScore;
  const firstPlaceTeams = sortedResults.filter(r => r.totalScore === firstPlaceScore);
  
  let tieInfo: { position: number; tiedTeams: number; } | undefined;
  
  if (teamScore === firstPlaceScore) {
    // Team is tied for first place - they split the entire $360 pot
    tieInfo = { position: 1, tiedTeams: firstPlaceTeams.length };
  } else {
    // Only pay second place if there's exactly one first place team
    if (firstPlaceTeams.length === 1) {
      const secondPlaceScore = sortedResults.find(r => r.totalScore > firstPlaceScore)?.totalScore;
      if (teamScore === secondPlaceScore) {
        const secondPlaceTeams = sortedResults.filter(r => r.totalScore === secondPlaceScore);
        tieInfo = { position: 2, tiedTeams: secondPlaceTeams.length };
      }
    }
    // If multiple teams tied for first, no second place payout
  }
  
  // Calculate per-player winnings
  const playerCount = getTeamPlayerCount(playerTeam);
  const rank = sortedResults.findIndex(result => result.teamId === playerTeam.id) + 1;
  
  return Math.floor(calculatePerPlayerWinnings(rank, playerCount, tieInfo));
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