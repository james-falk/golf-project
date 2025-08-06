import { Player, Course, SkinsGame, ClosestToPinGame, ScrambleGame, ScrambleTeam, RoundData, TournamentData } from '@/types/golf';

// Real Players
export const demoPlayers: Player[] = [
  { id: '1', name: 'Ethan', group: 'A', handicap: 0 },
  { id: '2', name: 'John Porth', group: 'A', handicap: 0 },
  { id: '3', name: 'Roger', group: 'A', handicap: 0 },
  { id: '4', name: 'Jeff Felts', group: 'A', handicap: 0 },
  { id: '5', name: 'Robert', group: 'A', handicap: 0 },
  { id: '6', name: 'Steve', group: 'B', handicap: 0 },
  { id: '7', name: 'James', group: 'B', handicap: 0 },
  { id: '8', name: 'Maxwell', group: 'B', handicap: 0 },
  { id: '9', name: 'Kent', group: 'B', handicap: 0 },
  { id: '10', name: 'Thomas', group: 'B', handicap: 0 },
  { id: '11', name: 'Spencer', group: 'B', handicap: 0 },
  { id: '12', name: 'Ken', group: 'C', handicap: 0 },
  { id: '13', name: 'Bryce', group: 'C', handicap: 0 },
  { id: '14', name: 'Lucas', group: 'C', handicap: 0 },
  { id: '15', name: 'Tate', group: 'C', handicap: 0 },
  { id: '16', name: 'Mitchell', group: 'C', handicap: 0 },
  { id: '17', name: 'Greg', group: 'D', handicap: 0 },
  { id: '18', name: 'Pete', group: 'D', handicap: 0 },
];

// The Tribute Course Data - Otsego Club, Gaylord, MI
export const demoCourse: Course = {
  name: 'The Tribute - Otsego Club',
  holes: [
    { number: 1, par: 4, handicap: 13 },
    { number: 2, par: 4, handicap: 9 },
    { number: 3, par: 4, handicap: 17 },
    { number: 4, par: 5, handicap: 7 },
    { number: 5, par: 4, handicap: 5 },
    { number: 6, par: 3, handicap: 11 },
    { number: 7, par: 5, handicap: 3 },
    { number: 8, par: 4, handicap: 1 },
    { number: 9, par: 3, handicap: 15 },
    { number: 10, par: 4, handicap: 12 },
    { number: 11, par: 5, handicap: 8 },
    { number: 12, par: 4, handicap: 6 },
    { number: 13, par: 3, handicap: 14 },
    { number: 14, par: 4, handicap: 4 },
    { number: 15, par: 4, handicap: 16 },
    { number: 16, par: 5, handicap: 2 },
    { number: 17, par: 3, handicap: 18 },
    { number: 18, par: 4, handicap: 10 },
  ],
};

// Demo Skins Game - ready for real scores
export const demoSkinsGame: SkinsGame = {
  players: demoPlayers,
  scores: {}, // Empty - ready for real score entry
  skinResults: [],
  potPerHole: 0, // Dynamic - $280 total divided by number of skins won
  totalPot: 280, // $360 total minus $80 for closest-to-pin = $280 for skins
};

// Demo Closest to Pin Game - The Tribute Par 3s
export const demoClosestToPinGame: ClosestToPinGame = {
  players: demoPlayers,
  holes: [
    { hole: 6, par: 3, isActive: true, prize: 20 },   // 199 yards, HCP 11
    { hole: 9, par: 3, isActive: true, prize: 20 },   // 232 yards, HCP 15  
    { hole: 13, par: 3, isActive: true, prize: 20 },  // 200 yards, HCP 14
    { hole: 17, par: 3, isActive: true, prize: 20 },  // 147 yards, HCP 18
  ],
  totalPrizePool: 80, // $20 per par-3 × 4 par-3 holes = $80
};

// Demo Scramble Teams - 5 teams with exactly 4 player slots each (20 total slots for 18 players)
export const demoScrambleTeams: ScrambleTeam[] = [
  {
    id: 'team-1',
    name: '',
    players: [null, null, null, null],
  },
  {
    id: 'team-2',
    name: '',
    players: [null, null, null, null],
  },
  {
    id: 'team-3',
    name: '',
    players: [null, null, null, null],
  },
  {
    id: 'team-4',
    name: '',
    players: [null, null, null, null],
  },
  {
    id: 'team-5',
    name: '',
    players: [null, null, null, null],
  },
];

// Demo Scramble Game - ready for real scores
export const demoScrambleGame: ScrambleGame = {
  teams: demoScrambleTeams,
  scores: {}, // Empty - ready for real team score entry
  results: [],
};

// Tournament Data - Three Rounds at The Tribute
export const createEmptyRound = (id: string, name: string, day: string): RoundData => ({
  id,
  name,
  day,
  skinsGame: {
    players: demoPlayers,
    scores: {},
    skinResults: [],
    potPerHole: 20,
    totalPot: 360,
  },
  closestToPinGame: {
    players: demoPlayers,
    holes: [
      { hole: 6, par: 3, isActive: true, prize: 62.50 },
      { hole: 9, par: 3, isActive: true, prize: 62.50 },
      { hole: 13, par: 3, isActive: true, prize: 62.50 },
      { hole: 17, par: 3, isActive: true, prize: 62.50 },
    ],
    totalPrizePool: 250,
  },
  scrambleGame: {
    teams: demoScrambleTeams,
    scores: {},
    results: [],
  },
});

export const initialTournamentData: TournamentData = {
  rounds: [
    createEmptyRound('thursday', 'Thursday - Payout', 'Thursday'),
    createEmptyRound('friday', 'Friday - Payout', 'Friday'),
    createEmptyRound('saturday', 'Saturday - Payout', 'Saturday'),
  ],
  totalWinnings: {},
};