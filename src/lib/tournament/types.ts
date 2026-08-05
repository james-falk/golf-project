export type PlayerTier = "A" | "B" | "C" | "D";
export type RoundKind = "skins" | "scramble";

export type Player = {
  id: string;
  name: string;
  tier: PlayerTier;
  nickname?: string;
};

export type CourseHole = {
  number: number;
  par: number;
  strokeIndex: number;
};

export type Course = {
  id: string;
  name: string;
  holes: CourseHole[];
};

export type SkinRoundRules = {
  playerEntryFee: number;
  closestToPinHoleNumbers: number[];
  closestToPinPrize: number;
  tierStrokes: Record<PlayerTier, number>;
};

export type ScrambleRoundRules = {
  playerEntryFee: number;
  teamCount: number;
  teamSize: number;
  secondPlacePrize: number;
};

export type TournamentRules = {
  skinRound: SkinRoundRules;
  scrambleRound: ScrambleRoundRules;
};

export type HoleScore = { holeNumber: number; strokes: number };

export type SkinResult = {
  holeNumber: number;
  winnerId?: string;
  bestNetScore?: number;
  isTie: boolean;
  isComplete: boolean;
};

export type TeamResult = {
  teamId: string;
  total: number;
};
