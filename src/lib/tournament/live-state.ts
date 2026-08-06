import { makeTeams, startingRoster } from "./seed";
import type { RoundKey, Team, TournamentState } from "./state";
import type { Player } from "./types";

/** The stored ledger is authoritative from the moment the commissioner starts the tournament. */
export function isTournamentLocked(state: Pick<TournamentState, "lockedAt"> | null | undefined) {
  return Boolean(state?.lockedAt);
}

/** Teams are only carried into the live tournament when they still describe the confirmed field exactly once. */
export function teamsCoverRoster(teams: Team[] | undefined, players: Player[]) {
  if (!teams?.length) return false;
  const assigned = teams.flatMap((team) => team.playerIds);
  if (assigned.length !== players.length || new Set(assigned).size !== players.length) return false;
  const rosterIds = new Set(players.map((player) => player.id));
  return assigned.every((playerId) => rosterIds.has(playerId));
}

/**
 * The state the tournament actually starts from: the confirmed roster, the teams
 * as the commissioner arranged them, and no scores at all. Anything that does not
 * describe the current field is rebuilt rather than carried forward.
 */
export function makeCleanTournamentState(current: Partial<TournamentState> | null, lockedAt?: string): TournamentState {
  const players = startingRoster;
  const carryTeams = (day: "friday" | "saturday") => {
    const teams = current?.teamsByDay?.[day];
    return teamsCoverRoster(teams, players) ? (teams as Team[]) : makeTeams(players);
  };

  return {
    players,
    skinScores: {},
    skinOfficialTotals: {},
    closestToPin: {},
    teamsByDay: { friday: carryTeams("friday"), saturday: carryTeams("saturday") },
    scrambleScores: {},
    scrambleOfficialTotals: {},
    postings: {},
    ...(lockedAt ? { lockedAt } : {}),
  };
}

const skinDays = ["thursday", "friday", "saturday"] as const;
const scrambleDays = ["friday", "saturday"] as const;

/** Card keys are `${day}:${id}`; a posted round refuses further writes until it is returned to review. */
export function postedRoundForCardKey(state: TournamentState, cardKey: string, round: "skins" | "scramble") {
  const day = cardKey.split(":")[0];
  const key = `${round}-${day}` as RoundKey;
  return state.postings?.[key]?.status === "posted" ? key : null;
}

/** Every round key whose scores changed between two states. */
export function changedRoundKeys(before: Partial<TournamentState>, after: Partial<TournamentState>): RoundKey[] {
  const changed = new Set<RoundKey>();

  const compare = (
    beforeScores: Record<string, unknown> | undefined,
    afterScores: Record<string, unknown> | undefined,
    round: "skins" | "scramble",
    days: readonly string[],
  ) => {
    const keys = new Set([...Object.keys(beforeScores ?? {}), ...Object.keys(afterScores ?? {})]);
    keys.forEach((cardKey) => {
      const day = cardKey.split(":")[0];
      if (!days.includes(day)) return;
      if (JSON.stringify(beforeScores?.[cardKey]) !== JSON.stringify(afterScores?.[cardKey])) {
        changed.add(`${round}-${day}` as RoundKey);
      }
    });
  };

  compare(before.skinScores, after.skinScores, "skins", skinDays);
  compare(before.skinOfficialTotals, after.skinOfficialTotals, "skins", skinDays);
  compare(before.closestToPin, after.closestToPin, "skins", skinDays);
  compare(before.scrambleScores, after.scrambleScores, "scramble", scrambleDays);
  compare(before.scrambleOfficialTotals, after.scrambleOfficialTotals, "scramble", scrambleDays);
  return [...changed];
}

const cleanTeamName = (value: unknown, fallback: string) =>
  (typeof value === "string" ? value.trim().slice(0, 40) : "") || fallback;

/**
 * A locked tournament keeps the teams the server already has, except for their
 * names. Who is on a team decides the scramble payout and stays frozen; what a
 * team calls itself is decoration and can be changed any time.
 */
export function lockedTeams(
  current: TournamentState["teamsByDay"] | undefined,
  incoming: TournamentState["teamsByDay"] | undefined,
): TournamentState["teamsByDay"] {
  const days = ["friday", "saturday"] as const;
  const merged = {} as TournamentState["teamsByDay"];
  days.forEach((day) => {
    const serverTeams = current?.[day] ?? incoming?.[day] ?? [];
    merged[day] = serverTeams.map((team) => {
      const renamed = incoming?.[day]?.find((entry) => entry.id === team.id);
      return { ...team, name: cleanTeamName(renamed?.name, team.name) };
    });
  });
  return merged;
}

/**
 * Merges a site save onto the stored ledger. Once the tournament is locked the
 * roster and the team line-ups come from the server no matter what the browser
 * sent, and scores for an already-posted round are refused.
 */
export function mergeSiteSave(current: Partial<TournamentState>, incoming: TournamentState) {
  const locked = isTournamentLocked(current as TournamentState);
  const merged: TournamentState = {
    players: locked ? (current.players ?? incoming.players) : incoming.players,
    teamsByDay: locked ? lockedTeams(current.teamsByDay, incoming.teamsByDay) : incoming.teamsByDay,
    skinScores: { ...(current.skinScores ?? {}), ...(incoming.skinScores ?? {}) },
    skinOfficialTotals: { ...(current.skinOfficialTotals ?? {}), ...(incoming.skinOfficialTotals ?? {}) },
    closestToPin: { ...(current.closestToPin ?? {}), ...(incoming.closestToPin ?? {}) },
    scrambleScores: { ...(current.scrambleScores ?? {}), ...(incoming.scrambleScores ?? {}) },
    scrambleOfficialTotals: { ...(current.scrambleOfficialTotals ?? {}), ...(incoming.scrambleOfficialTotals ?? {}) },
    postings: { ...(current.postings ?? {}), ...(incoming.postings ?? {}) },
    ...(current.lockedAt ? { lockedAt: current.lockedAt } : {}),
  };

  if (!locked) return { merged, rejected: [] as RoundKey[] };

  // A round the browser is re-posting in this same save is being corrected deliberately, so it is allowed.
  const reopened = new Set(
    (Object.keys(incoming.postings ?? {}) as RoundKey[]).filter((key) => incoming.postings?.[key]?.status !== current.postings?.[key]?.status),
  );
  const rejected = changedRoundKeys(current, merged).filter(
    (key) => current.postings?.[key]?.status === "posted" && !reopened.has(key),
  );
  if (!rejected.length) return { merged, rejected };

  // Roll the refused rounds back to exactly what the server already had.
  const isRejected = (cardKey: string, round: "skins" | "scramble") =>
    rejected.includes(`${round}-${cardKey.split(":")[0]}` as RoundKey);

  const withServerRounds = <T>(currentRecord: Record<string, T> | undefined, mergedRecord: Record<string, T>, round: "skins" | "scramble") => ({
    ...Object.fromEntries(Object.entries(mergedRecord).filter(([cardKey]) => !isRejected(cardKey, round))),
    ...Object.fromEntries(Object.entries(currentRecord ?? {}).filter(([cardKey]) => isRejected(cardKey, round))),
  }) as Record<string, T>;

  return {
    merged: {
      ...merged,
      skinScores: withServerRounds(current.skinScores, merged.skinScores, "skins"),
      skinOfficialTotals: withServerRounds(current.skinOfficialTotals, merged.skinOfficialTotals, "skins"),
      closestToPin: withServerRounds(current.closestToPin, merged.closestToPin, "skins"),
      scrambleScores: withServerRounds(current.scrambleScores, merged.scrambleScores, "scramble"),
      scrambleOfficialTotals: withServerRounds(current.scrambleOfficialTotals, merged.scrambleOfficialTotals, "scramble"),
    },
    rejected,
  };
}
