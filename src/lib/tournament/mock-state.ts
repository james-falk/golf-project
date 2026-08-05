import { confirmed2026Rules } from "./config";
import { classicCourse, makeTeams, startingRoster, tributeCourse } from "./seed";
import type { Scores, ScrambleDay, SkinDay, Team, TournamentState } from "./state";
import type { Course, HoleScore, Player } from "./types";

const skinDays: SkinDay[] = ["thursday", "friday", "saturday"];
const scrambleDays: ScrambleDay[] = ["friday", "saturday"];
const cardKey = (day: string, id: string | number) => `${day}:${id}`;

function total(scores: HoleScore[]) {
  return scores.reduce((sum, score) => sum + score.strokes, 0);
}

function playerCard(player: Player, playerIndex: number, dayIndex: number): HoleScore[] {
  const tierPenalty = { A: 0, B: 1, C: 2, D: 3 }[player.tier];
  return tributeCourse.holes.map((hole) => {
    const variation = ((playerIndex * 7 + hole.number * 3 + dayIndex * 2) % 5) - 2;
    return { holeNumber: hole.number, strokes: Math.max(2, hole.par + tierPenalty + variation) };
  });
}

function scorecardForTotal(course: Course, target: number, offset: number): HoleScore[] {
  const scores = course.holes.map((hole) => ({ holeNumber: hole.number, strokes: hole.par }));
  let difference = target - scores.reduce((sum, score) => sum + score.strokes, 0);
  let cursor = 0;
  while (difference !== 0) {
    const index = (cursor + offset) % scores.length;
    if (difference > 0) {
      scores[index].strokes += 1;
      difference -= 1;
    } else if (scores[index].strokes > 2) {
      scores[index].strokes -= 1;
      difference += 1;
    }
    cursor += 1;
  }
  return scores;
}

function saturdayTeams(fridayTeams: Team[]) {
  const rotated = [...startingRoster.slice(1), startingRoster[0]];
  return fridayTeams.map((team, teamIndex) => ({
    ...team,
    playerIds: rotated.filter((_, playerIndex) => playerIndex % fridayTeams.length === teamIndex).map((player) => player.id),
  }));
}

export function makeMockTournamentState(): TournamentState {
  const skinScores: Scores = {};
  const skinOfficialTotals: Record<string, string> = {};
  skinDays.forEach((day, dayIndex) => startingRoster.forEach((player, playerIndex) => {
    const key = cardKey(day, player.id);
    const scores = playerCard(player, playerIndex, dayIndex);
    skinScores[key] = scores;
    skinOfficialTotals[key] = String(total(scores));
  }));

  const fridayTeams = makeTeams(startingRoster);
  const teamsByDay = { friday: fridayTeams, saturday: saturdayTeams(fridayTeams) };
  const scrambleScores: Scores = {};
  const scrambleOfficialTotals: Record<string, string> = {};
  const targetTotals: Record<ScrambleDay, number[]> = {
    friday: [64, 66, 67, 69, 70, 72],
    saturday: [65, 65, 67, 68, 70, 71],
  };
  scrambleDays.forEach((day, dayIndex) => teamsByDay[day].forEach((team, teamIndex) => {
    const key = cardKey(day, team.id);
    const scores = scorecardForTotal(classicCourse, targetTotals[day][teamIndex], dayIndex * 3 + teamIndex);
    scrambleScores[key] = scores;
    scrambleOfficialTotals[key] = String(total(scores));
  }));

  const closestToPin: Record<string, string> = {};
  skinDays.forEach((day, dayIndex) => confirmed2026Rules.skinRound.closestToPinHoleNumbers.forEach((hole, holeIndex) => {
    closestToPin[cardKey(day, hole)] = startingRoster[(dayIndex * 4 + holeIndex * 5) % startingRoster.length].id;
  }));

  const postedAt = "2026-08-02T12:00:00.000Z";
  return {
    players: startingRoster,
    skinScores,
    skinOfficialTotals,
    closestToPin,
    teamsByDay,
    scrambleScores,
    scrambleOfficialTotals,
    postings: {
      "skins-thursday": { status: "posted", postedAt, revision: 1 },
      "skins-friday": { status: "posted", postedAt, revision: 1 },
      "scramble-friday": { status: "posted", postedAt, revision: 1 },
      "skins-saturday": { status: "posted", postedAt, revision: 1 },
      "scramble-saturday": { status: "posted", postedAt, revision: 1 },
    },
  };
}
