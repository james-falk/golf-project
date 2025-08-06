// Golf Trip Games Types

export interface Player {
  id: string;
  name: string;
  group: 'A' | 'B' | 'C' | 'D';
  handicap: number;
}

export interface HoleScore {
  hole: number;
  score: number;
  par: number;
}

export interface SkinScore extends HoleScore {
  netScore: number;
  winner?: string; // player id
  pot: number;
}

export interface SkinsGame {
  players: Player[];
  scores: { [playerId: string]: HoleScore[] };
  skinResults: SkinScore[];
  potPerHole: number;
  totalPot: number;
}

export interface RoundData {
  id: string;
  name: string;
  day: string;
  skinsGame: SkinsGame;
  closestToPinGame: ClosestToPinGame;
  scrambleGame: ScrambleGame;
}

export interface TournamentData {
  rounds: RoundData[];
  totalWinnings: { [playerId: string]: number };
}

export interface ClosestToPinHole {
  hole: number;
  par: number;
  isActive: boolean;
  winner?: string; // player id
  distance?: string;
  prize: number;
}

export interface ClosestToPinGame {
  players: Player[];
  holes: ClosestToPinHole[];
  totalPrizePool: number;
}

export interface ScrambleTeam {
  id: string;
  name: string;
  players: (string | null)[]; // player IDs, null for empty slots (up to 4 players)
}

export interface ScrambleScore {
  teamId: string;
  scores: HoleScore[];
  totalScore: number;
}

export interface ScrambleGame {
  teams: ScrambleTeam[];
  scores: { [teamId: string]: HoleScore[] };
  results: ScrambleScore[];
}

export interface CourseHole {
  number: number;
  par: number;
  handicap?: number; // Hole handicap rating (1-18, where 1 = hardest)
}

export interface Course {
  name?: string;
  holes: CourseHole[];
}

export type GameTab = 'skins' | 'closest-pin' | 'scramble' | 'leaderboard';
export type RoundTab = 'thursday' | 'friday' | 'saturday';