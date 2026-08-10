"use client";

import { useMemo, useState } from "react";
import { confirmed2026Rules } from "@/lib/tournament/config";
import { fieldForRound } from "@/lib/tournament/live-state";
import { calculatePlayerPayoutBreakdowns } from "@/lib/tournament/payouts";
import { calculateScramblePayouts, calculateSkinPayouts, calculateSkins, skinRoundPot } from "@/lib/tournament/rules";
import { tributeCourse } from "@/lib/tournament/seed";
import type { RoundKey, RoundPosting, Scores, ScrambleDay, SkinDay, Team } from "@/lib/tournament/state";
import type { Player } from "@/lib/tournament/types";

type PayoutScope = "total" | SkinDay;

const skinDays: SkinDay[] = ["thursday", "friday", "saturday"];
const scrambleDays: ScrambleDay[] = ["friday", "saturday"];
const cardKey = (day: string, id: string | number) => `${day}:${id}`;

export function PayoutDashboard({ players, skinScores, closestToPin, teamsByDay, scrambleTotals, postings, entriesFor, absences, canEdit }: {
  players: Player[];
  skinScores: Scores;
  closestToPin: Record<string, string>;
  teamsByDay: Record<ScrambleDay, Team[]>;
  scrambleTotals: Record<string, string>;
  postings: Partial<Record<RoundKey, RoundPosting>>;
  entriesFor: (round: RoundKey) => number;
  absences: Partial<Record<RoundKey, string[]>>;
  canEdit: boolean;
}) {
  const [scope, setScope] = useState<PayoutScope>("total");
  const includedSkinDays = useMemo(() => scope === "total" ? skinDays : [scope], [scope]);
  const includedScrambleDays = useMemo(() => scope === "total" ? scrambleDays : scope === "thursday" ? [] : [scope], [scope]);

  const skinRounds = useMemo(() => includedSkinDays.map((day) => {
    // A player who sat the round out is not in its field, or no hole ever resolves.
    const field = fieldForRound({ absences }, `skins-${day}` as RoundKey, players);
    const scores = Object.fromEntries(field.map((player) => [player.id, skinScores[cardKey(day, player.id)] ?? []]));
    const results = calculateSkins(field, tributeCourse, scores, confirmed2026Rules.skinRound);
    return {
      day,
      results,
      payoutByHole: calculateSkinPayouts(entriesFor(`skins-${day}` as RoundKey), results, confirmed2026Rules.skinRound),
      closestToPinWinnerIds: confirmed2026Rules.skinRound.closestToPinHoleNumbers.flatMap((hole) => closestToPin[cardKey(day, hole)] ? [closestToPin[cardKey(day, hole)]] : []),
    };
  }), [absences, closestToPin, entriesFor, includedSkinDays, players, skinScores]);

  const scrambleRounds = useMemo(() => includedScrambleDays.map((day) => {
    const teams = teamsByDay[day];
    const results = teams.map((team) => ({ teamId: team.id, total: Number(scrambleTotals[cardKey(day, team.id)]) || 0 }));
    return { day, teams, payouts: calculateScramblePayouts(results, entriesFor(`scramble-${day}` as RoundKey), confirmed2026Rules.scrambleRound) };
  }), [entriesFor, includedScrambleDays, scrambleTotals, teamsByDay]);

  const payoutRows = useMemo(() => calculatePlayerPayoutBreakdowns(players, skinRounds, scrambleRounds, confirmed2026Rules.skinRound.closestToPinPrize), [players, scrambleRounds, skinRounds]);
  const leader = payoutRows[0];
  const prizePool = includedSkinDays.reduce((sum, day) => sum + skinRoundPot(entriesFor(`skins-${day}` as RoundKey), confirmed2026Rules.skinRound).total, 0)
    + includedScrambleDays.reduce((sum, day) => sum + entriesFor(`scramble-${day}` as RoundKey) * confirmed2026Rules.scrambleRound.playerEntryFee, 0);
  const awarded = payoutRows.reduce((total, row) => total + row.total, 0);
  const postedCount = includedSkinDays.filter((day) => postings[`skins-${day}`]?.status === "posted").length + includedScrambleDays.filter((day) => postings[`scramble-${day}`]?.status === "posted").length;
  const roundCount = includedSkinDays.length + includedScrambleDays.length;

  return <div className="space-y-6">
    <section className="club-hero p-6 sm:p-8">
      <p className="club-kicker">Tournament accounting department</p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><h2 className="club-display text-4xl sm:text-6xl">Total payouts.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">Every skin, closest-to-pin prize, and player share of a scramble team payout—backed by the scorecards below.</p></div>
        <div className="grid grid-cols-3 gap-2"><PayoutStat label="Prize pool" value={formatMoney(prizePool)} /><PayoutStat label="Accounted" value={formatMoney(awarded)} /><PayoutStat label="Posted" value={`${postedCount}/${roundCount}`} /></div>
      </div>
    </section>

    <nav className="scoring-subnav" aria-label="Payout period">
      {(["total", "thursday", "friday", "saturday"] as const).map((item) => <button key={item} type="button" aria-pressed={scope === item} onClick={() => setScope(item)}>{item === "total" ? "Tournament total" : capitalize(item)}</button>)}
    </nav>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="club-ledger payout-ledger min-w-0 text-[#12332d]">
        <div className="border-b border-[#a99670] px-4 py-4 sm:px-6"><p className="club-ledger-label">{scope === "total" ? "All five rounds" : `${capitalize(scope)} payouts`}</p><h3 className="club-card-title !text-[#173f35]">Player payout leaderboard</h3></div>
        <div className="payout-table-scroll"><div className="payout-table-head"><span>Player</span><span>Skins</span><span>CTP</span><span>Scramble</span><span>Total</span></div>
        <div>{payoutRows.map((row, index) => {
          const player = players.find((entry) => entry.id === row.playerId);
          return <div key={row.playerId} className="payout-row">
            <span><b>{index + 1}</b><strong>{player?.name ?? "Unknown"}</strong><small>{player?.tier} tier</small></span><span>{formatMoney(row.skins)}</span><span>{formatMoney(row.closestToPin)}</span><span>{formatMoney(row.scramble)}</span><span>{formatMoney(row.total)}</span>
          </div>;
        })}</div></div>
      </div>
      <aside className="club-card self-start p-5"><p className="club-kicker">Current leader</p><p className="club-display mt-3 text-3xl">{leader && leader.total > 0 ? players.find((player) => player.id === leader.playerId)?.name : "Still counting"}</p><p className="mt-2 text-2xl font-bold text-[#ead292]">{leader ? formatMoney(leader.total) : "$0"}</p>{canEdit ? <p className="mt-3 text-xs leading-5 text-stone-400">Draft calculations update as complete cards are entered. Results become official when each round is posted.</p> : null}</aside>
    </section>

  </div>;
}



function PayoutStat({ label, value }: { label: string; value: string }) { return <div className="club-stat p-3"><p>{label}</p><strong className="mt-2 block text-lg text-[#f1dfb3]">{value}</strong></div>; }
function formatMoney(value: number) { return `$${Number.isInteger(value) ? value : value.toFixed(2)}`; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
