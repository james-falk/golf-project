import type { RoundKey, TournamentState } from "./state";

function filterRoundRecord<T>(record: Record<string, T> | undefined, allowedDays: string[]) {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([key]) => allowedDays.some((day) => key.startsWith(`${day}:`))),
  ) as Record<string, T>;
}

export function sanitizeTournamentStateForViewer(state: TournamentState): TournamentState {
  const postedSkinDays = (["thursday", "friday", "saturday"] as const).filter(
    (day) => state.postings?.[`skins-${day}` as RoundKey]?.status === "posted",
  );
  const postedScrambleDays = (["friday", "saturday"] as const).filter(
    (day) => state.postings?.[`scramble-${day}` as RoundKey]?.status === "posted",
  );

  return {
    ...state,
    skinScores: filterRoundRecord(state.skinScores, postedSkinDays),
    skinOfficialTotals: filterRoundRecord(state.skinOfficialTotals, postedSkinDays),
    closestToPin: filterRoundRecord(state.closestToPin, postedSkinDays),
    scrambleScores: filterRoundRecord(state.scrambleScores, postedScrambleDays),
    scrambleOfficialTotals: filterRoundRecord(state.scrambleOfficialTotals, postedScrambleDays),
  };
}
