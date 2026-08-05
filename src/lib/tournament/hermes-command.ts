import type { TournamentState } from "./state";

type PlayerDay = "thursday" | "friday" | "saturday";
type ScrambleDay = "friday" | "saturday";

export type HermesScoringCommand =
  | { type: "player-card"; day: PlayerDay; player: string; scores: number[] }
  | { type: "player-hole"; day: PlayerDay; player: string; hole: number; strokes: number }
  | { type: "ctp"; day: PlayerDay; hole: number; player: string }
  | { type: "scramble-card"; day: ScrambleDay; team: string; scores: number[] }
  | { type: "scramble-hole"; day: ScrambleDay; team: string; hole: number; strokes: number }
  | { type: "round-status"; day: PlayerDay; round: "skins" | "scramble"; status: "review" | "posted" };

export type HermesCommandResult = {
  state: TournamentState;
  summary: string;
  total?: number;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function resolveNamed<T extends { name: string }>(entries: T[], query: string, kind: string) {
  const needle = normalize(query);
  if (!needle) throw new Error(`${kind} is required`);
  const exact = entries.find((entry) => normalize(entry.name) === needle);
  if (exact) return exact;
  const matches = entries.filter((entry) => normalize(entry.name).includes(needle));
  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new Error(`Unknown ${kind.toLowerCase()}: ${query}`);
  throw new Error(`Ambiguous ${kind.toLowerCase()} “${query}”: ${matches.map((entry) => entry.name).join(", ")}`);
}

function validateHole(hole: number) {
  if (!Number.isInteger(hole) || hole < 1 || hole > 18) throw new Error("Hole must be an integer from 1 through 18");
}

function validateStrokes(strokes: number) {
  if (!Number.isInteger(strokes) || strokes < 1 || strokes > 20) throw new Error("Strokes must be an integer from 1 through 20");
}

function validateCard(scores: number[]) {
  if (!Array.isArray(scores) || scores.length !== 18) throw new Error("A full card must contain exactly 18 scores");
  scores.forEach(validateStrokes);
}

/** A posted round is on the public board, so it must be reopened before anything in it changes. */
function validateRoundOpen(state: TournamentState, day: string, round: "skins" | "scramble") {
  const key = `${round}-${day}` as keyof TournamentState["postings"];
  if (state.postings?.[key]?.status === "posted") {
    throw new Error(`${day} ${round} is posted and must be returned to review before its scores can change`);
  }
}

function replaceHole(card: TournamentState["skinScores"][string] | undefined, hole: number, strokes: number) {
  return [...(card ?? []).filter((score) => score.holeNumber !== hole), { holeNumber: hole, strokes }].sort((a, b) => a.holeNumber - b.holeNumber);
}

const total = (scores: number[]) => scores.reduce((sum, score) => sum + score, 0);
const cardScores = (scores: TournamentState["skinScores"][string]) => scores.map((score) => score.strokes);

export function applyHermesScoringCommand(current: TournamentState, command: HermesScoringCommand): HermesCommandResult {
  const state = structuredClone(current);

  if (command.type === "player-card") {
    validateRoundOpen(state, command.day, "skins");
    validateCard(command.scores);
    const player = resolveNamed(state.players, command.player, "Player");
    state.skinScores[`${command.day}:${player.id}`] = command.scores.map((strokes, index) => ({ holeNumber: index + 1, strokes }));
    const cardTotal = total(command.scores);
    return { state, total: cardTotal, summary: `${command.day} skins: saved ${player.name}'s 18-hole card (${cardTotal})` };
  }

  if (command.type === "player-hole") {
    validateRoundOpen(state, command.day, "skins");
    validateHole(command.hole);
    validateStrokes(command.strokes);
    const player = resolveNamed(state.players, command.player, "Player");
    const key = `${command.day}:${player.id}`;
    state.skinScores[key] = replaceHole(state.skinScores[key], command.hole, command.strokes);
    const cardTotal = total(cardScores(state.skinScores[key]));
    return { state, total: cardTotal, summary: `${command.day} skins: set ${player.name} hole ${command.hole} to ${command.strokes} (${state.skinScores[key].length}/18 holes, total ${cardTotal})` };
  }

  if (command.type === "ctp") {
    validateRoundOpen(state, command.day, "skins");
    validateHole(command.hole);
    const player = resolveNamed(state.players, command.player, "Player");
    state.closestToPin[`${command.day}:${command.hole}`] = player.id;
    return { state, summary: `${command.day} CTP hole ${command.hole}: ${player.name}` };
  }

  if (command.type === "scramble-card") {
    validateRoundOpen(state, command.day, "scramble");
    validateCard(command.scores);
    const team = resolveNamed(state.teamsByDay[command.day], command.team, "Team");
    state.scrambleScores[`${command.day}:${team.id}`] = command.scores.map((strokes, index) => ({ holeNumber: index + 1, strokes }));
    const cardTotal = total(command.scores);
    return { state, total: cardTotal, summary: `${command.day} scramble: saved ${team.name}'s 18-hole card (${cardTotal})` };
  }

  if (command.type === "scramble-hole") {
    validateRoundOpen(state, command.day, "scramble");
    validateHole(command.hole);
    validateStrokes(command.strokes);
    const team = resolveNamed(state.teamsByDay[command.day], command.team, "Team");
    const key = `${command.day}:${team.id}`;
    state.scrambleScores[key] = replaceHole(state.scrambleScores[key], command.hole, command.strokes);
    const cardTotal = total(cardScores(state.scrambleScores[key]));
    return { state, total: cardTotal, summary: `${command.day} scramble: set ${team.name} hole ${command.hole} to ${command.strokes} (${state.scrambleScores[key].length}/18 holes, total ${cardTotal})` };
  }

  if (command.round === "scramble" && command.day === "thursday") throw new Error("There is no Thursday scramble round");
  const key = `${command.round}-${command.day}` as keyof TournamentState["postings"];
  const previous = state.postings[key];
  state.postings[key] = command.status === "posted"
    ? { status: "posted", postedAt: new Date().toISOString(), revision: (previous?.revision ?? 0) + 1 }
    : { status: "review", revision: previous?.revision ?? 0 };
  return { state, summary: `${command.day} ${command.round}: ${command.status}` };
}

