import { confirmed2026Rules } from "./config";
import { classicCourse } from "./seed";
import type { Team } from "./state";
import type { TournamentState } from "./state";
import type { Player } from "./types";

type PlayerDay = "thursday" | "friday" | "saturday";
type ScrambleDay = "friday" | "saturday";

export type HermesScoringCommand =
  | { type: "player-card"; day: PlayerDay; player: string; scores: number[] }
  | { type: "player-hole"; day: PlayerDay; player: string; hole: number; strokes: number }
  | { type: "ctp"; day: PlayerDay; hole: number; player: string }
  | { type: "scramble-total"; day: ScrambleDay; team: string; toPar: number }
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

/** "Roger, Logan, Mitchell, Aiden" — however it was typed. */
function splitPlayerList(query: string) {
  return query.split(/,|\/|\band\b|&|\+/i).map((part) => part.trim()).filter(Boolean);
}

const describeTeam = (team: Team, roster: Player[]) =>
  team.playerIds.map((id) => roster.find((player) => player.id === id)?.name ?? id).join(", ");

/**
 * A team is not arranged in advance and has no name: it is the group that played
 * together, and it comes into existence the first time its result is reported.
 * Naming the same players again finds that team rather than making a second one,
 * so a correction updates the result instead of duplicating it.
 */
function resolveOrCreateTeam(teams: Team[], roster: Player[], query: string) {
  const needle = normalize(query);
  if (!needle) throw new Error("Name the players on the team");

  const names = splitPlayerList(query);
  if (names.length < 3 || names.length > 4) {
    throw new Error(`Name the 3 or 4 players on the team, separated by commas. Received ${names.length} in "${query}"`);
  }

  const resolved = names.map((name) => resolveNamed(roster, name, "Player"));
  const ids = new Set(resolved.map((player) => player.id));
  if (ids.size !== resolved.length) {
    throw new Error(`That list names the same player twice: ${resolved.map((player) => player.name).join(", ")}`);
  }

  const existing = teams.find((team) => team.playerIds.length === ids.size && team.playerIds.every((id) => ids.has(id)));
  if (existing) return { team: existing, created: false, overlaps: [] as string[] };

  // Not a blocker — only the paying teams get reported, so most players never
  // appear. But the same player on two teams in one day would split his share
  // twice, so it is worth saying out loud.
  const overlaps = teams
    .filter((team) => team.playerIds.some((id) => ids.has(id)))
    .flatMap((team) => team.playerIds.filter((id) => ids.has(id)))
    .map((id) => roster.find((player) => player.id === id)?.name ?? id);

  const used = new Set(teams.map((team) => team.id));
  let next = 1;
  while (used.has(`team-${next}`)) next += 1;
  return { team: { id: `team-${next}`, playerIds: resolved.map((player) => player.id) }, created: true, overlaps };
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

const classicPar = () => classicCourse.holes.reduce((sum, hole) => sum + hole.par, 0);

/** "-5", "even", "+3" — how a scramble result is actually spoken. */
export function formatToPar(toPar: number) {
  return toPar === 0 ? "even" : toPar > 0 ? `+${toPar}` : String(toPar);
}

/**
 * A scramble team reports how far under or over par it finished. The range is
 * wide enough for any real round and tight enough to catch a total typed in by
 * mistake: 67 strokes would arrive here as +67 rather than -5.
 */
function validateToPar(toPar: number) {
  if (!Number.isInteger(toPar)) throw new Error("A scramble result must be a whole number of strokes under or over par, like -5");
  if (toPar < -30 || toPar > 30) {
    throw new Error(`A scramble result must be between -30 and +30 against par. Received ${toPar} — send how far under par the team finished, not the total strokes`);
  }
}

/**
 * Closest to pin is only played on the par 3s. Filing one against any other hole
 * silently lands somewhere the payout never reads, so it is refused with the
 * holes that do count — the numbers are holes, not "the first CTP, the second".
 */
function validateClosestToPinHole(hole: number) {
  const holes = confirmed2026Rules.skinRound.closestToPinHoleNumbers;
  if (!holes.includes(hole)) {
    throw new Error(`Hole ${hole} does not have a closest to pin. The closest-to-pin holes are ${holes.join(", ")}`);
  }
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
    validateClosestToPinHole(command.hole);
    const player = resolveNamed(state.players, command.player, "Player");
    state.closestToPin[`${command.day}:${command.hole}`] = player.id;
    return { state, summary: `${command.day} CTP hole ${command.hole}: ${player.name}` };
  }

  if (command.type === "scramble-total") {
    validateRoundOpen(state, command.day, "scramble");
    validateToPar(command.toPar);
    const { team, created, overlaps } = resolveOrCreateTeam(state.teamsByDay[command.day], state.players, command.team);
    if (created) state.teamsByDay[command.day] = [...state.teamsByDay[command.day], team];
    // Stored as strokes so ranking and payouts stay in one unit; the board
    // renders it back against par.
    const strokes = classicPar() + command.toPar;
    state.scrambleOfficialTotals[`${command.day}:${team.id}`] = String(strokes);
    const warning = overlaps.length ? ` — note ${[...new Set(overlaps)].join(", ")} already on another ${command.day} team` : "";
    return { state, total: strokes, summary: `${command.day} scramble: ${describeTeam(team, state.players)} ${formatToPar(command.toPar)} (${strokes})${warning}` };
  }

  if (command.round === "scramble" && command.day === "thursday") throw new Error("There is no Thursday scramble round");
  const key = `${command.round}-${command.day}` as keyof TournamentState["postings"];
  const previous = state.postings[key];
  state.postings[key] = command.status === "posted"
    ? { status: "posted", postedAt: new Date().toISOString(), revision: (previous?.revision ?? 0) + 1 }
    : { status: "review", revision: previous?.revision ?? 0 };
  return { state, summary: `${command.day} ${command.round}: ${command.status}` };
}

