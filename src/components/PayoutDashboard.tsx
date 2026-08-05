"use client";

import { useMemo, useState } from "react";
import { confirmed2026Rules } from "@/lib/tournament/config";
import { calculatePlayerPayoutBreakdowns } from "@/lib/tournament/payouts";
import { calculateScramblePayouts, calculateSkinPayouts, calculateSkins, skinRoundPot } from "@/lib/tournament/rules";
import { tributeCourse } from "@/lib/tournament/seed";
import type { RoundKey, RoundPosting, Scores, ScrambleDay, SkinDay, Team } from "@/lib/tournament/state";
import type { HoleScore, Player } from "@/lib/tournament/types";

type PayoutScope = "total" | SkinDay;

const skinDays: SkinDay[] = ["thursday", "friday", "saturday"];
const scrambleDays: ScrambleDay[] = ["friday", "saturday"];
const cardKey = (day: string, id: string | number) => `${day}:${id}`;

export function PayoutDashboard({ players, skinScores, closestToPin, teamsByDay, scrambleScores, postings, canEdit }: {
  players: Player[];
  skinScores: Scores;
  closestToPin: Record<string, string>;
  teamsByDay: Record<ScrambleDay, Team[]>;
  scrambleScores: Scores;
  postings: Partial<Record<RoundKey, RoundPosting>>;
  canEdit: boolean;
}) {
  const [scope, setScope] = useState<PayoutScope>("total");
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? "");
  const includedSkinDays = useMemo(() => scope === "total" ? skinDays : [scope], [scope]);
  const includedScrambleDays = useMemo(() => scope === "total" ? scrambleDays : scope === "thursday" ? [] : [scope], [scope]);

  const skinRounds = useMemo(() => includedSkinDays.map((day) => {
    const scores = Object.fromEntries(players.map((player) => [player.id, skinScores[cardKey(day, player.id)] ?? []]));
    const results = calculateSkins(players, tributeCourse, scores, confirmed2026Rules.skinRound);
    return {
      day,
      results,
      payoutByHole: calculateSkinPayouts(players.length, results, confirmed2026Rules.skinRound),
      closestToPinWinnerIds: confirmed2026Rules.skinRound.closestToPinHoleNumbers.flatMap((hole) => closestToPin[cardKey(day, hole)] ? [closestToPin[cardKey(day, hole)]] : []),
    };
  }), [closestToPin, includedSkinDays, players, skinScores]);

  const scrambleRounds = useMemo(() => includedScrambleDays.map((day) => {
    const teams = teamsByDay[day];
    const results = teams.map((team) => {
      const card = scrambleScores[cardKey(day, team.id)];
      return { teamId: team.id, total: card?.length === 18 ? sumScores(card) : 0 };
    });
    return { day, teams, payouts: calculateScramblePayouts(results, players.length, confirmed2026Rules.scrambleRound) };
  }), [includedScrambleDays, players.length, scrambleScores, teamsByDay]);

  const payoutRows = useMemo(() => calculatePlayerPayoutBreakdowns(players, skinRounds, scrambleRounds, confirmed2026Rules.skinRound.closestToPinPrize), [players, scrambleRounds, skinRounds]);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const leader = payoutRows[0];
  const prizePool = includedSkinDays.length * skinRoundPot(players.length, confirmed2026Rules.skinRound).total + includedScrambleDays.length * players.length * confirmed2026Rules.scrambleRound.playerEntryFee;
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
          return <button key={row.playerId} type="button" onClick={() => setSelectedPlayerId(row.playerId)} className={`payout-row ${selectedPlayer?.id === row.playerId ? "is-selected" : ""}`}>
            <span><b>{index + 1}</b><strong>{player?.name ?? "Unknown"}</strong><small>{player?.tier} tier</small></span><span>{formatMoney(row.skins)}</span><span>{formatMoney(row.closestToPin)}</span><span>{formatMoney(row.scramble)}</span><span>{formatMoney(row.total)}</span>
          </button>;
        })}</div></div>
      </div>
      <aside className="club-card self-start p-5"><p className="club-kicker">Current leader</p><p className="club-display mt-3 text-3xl">{leader && leader.total > 0 ? players.find((player) => player.id === leader.playerId)?.name : "Still counting"}</p><p className="mt-2 text-2xl font-bold text-[#ead292]">{leader ? formatMoney(leader.total) : "$0"}</p>{canEdit ? <p className="mt-3 text-xs leading-5 text-stone-400">Draft calculations update as complete cards are entered. Results become official when each round is posted.</p> : null}</aside>
    </section>

    {selectedPlayer ? <PlayerLedger player={selectedPlayer} scope={scope} skinRounds={skinRounds} scrambleRounds={scrambleRounds} skinScores={skinScores} scrambleScores={scrambleScores} teamsByDay={teamsByDay} postings={postings} /> : null}
  </div>;
}

function PlayerLedger({ player, scope, skinRounds, scrambleRounds, skinScores, scrambleScores, teamsByDay, postings }: {
  player: Player;
  scope: PayoutScope;
  skinRounds: Array<{ day: SkinDay; results: ReturnType<typeof calculateSkins>; payoutByHole: Record<number, number>; closestToPinWinnerIds: string[] }>;
  scrambleRounds: Array<{ day: ScrambleDay; teams: Team[]; payouts: ReturnType<typeof calculateScramblePayouts> }>;
  skinScores: Scores;
  scrambleScores: Scores;
  teamsByDay: Record<ScrambleDay, Team[]>;
  postings: Partial<Record<RoundKey, RoundPosting>>;
}) {
  return <section className="player-ledger">
    <header><div><p className="club-kicker">Individual tournament file</p><h3>{player.name}</h3></div><span>{player.tier} tier</span></header>
    <div className="player-ledger-rounds">
      {skinRounds.map((round) => {
        const card = skinScores[cardKey(round.day, player.id)];
        const wins = round.results.filter((result) => result.winnerId === player.id).length;
        const ctpWins = round.closestToPinWinnerIds.filter((winnerId) => winnerId === player.id).length;
        const skinPayout = round.results.filter((result) => result.winnerId === player.id).reduce((sum, result) => sum + (round.payoutByHole[result.holeNumber] ?? 0), 0);
        return <PlayerRoundCard key={`skins-${round.day}`} title={`${capitalize(round.day)} · Skins`} status={postings[`skins-${round.day}`]?.status} total={sumScores(card)} detail={`${wins} skin${wins === 1 ? "" : "s"} · ${ctpWins} CTP · ${formatMoney(skinPayout + ctpWins * confirmed2026Rules.skinRound.closestToPinPrize)}`} scores={card} />;
      })}
      {scrambleRounds.map((round) => {
        const team = teamsByDay[round.day].find((entry) => entry.playerIds.includes(player.id));
        const card = team ? scrambleScores[cardKey(round.day, team.id)] : undefined;
        const payout = team ? round.payouts.find((entry) => entry.teamId === team.id) : undefined;
        const share = payout && team ? payout.teamPayout / Math.max(team.playerIds.length, 1) : 0;
        return <PlayerRoundCard key={`scramble-${round.day}`} title={`${capitalize(round.day)} · Scramble`} status={postings[`scramble-${round.day}`]?.status} total={sumScores(card)} detail={`${team?.name ?? "No team"} · ${payout ? `${ordinal(payout.place)} place · ${formatMoney(share)} share` : "$0 share"}`} scores={card} />;
      })}
    </div>
    <p className="player-ledger-note">{scope === "total" ? "Five-round tournament record" : `${capitalize(scope)} record`} · select another player above to inspect their cards.</p>
  </section>;
}

function PlayerRoundCard({ title, status, total, detail, scores }: { title: string; status?: RoundPosting["status"]; total: number; detail: string; scores?: HoleScore[] }) {
  return <article className="player-round-card"><div><p>{title}</p><span>{status === "posted" ? "Posted" : "Draft"}</span></div><strong>{total || "—"}</strong><small>{detail}</small><div className="player-card-holes">{Array.from({ length: 18 }, (_, index) => <span key={index}>{scores?.find((score) => score.holeNumber === index + 1)?.strokes ?? "—"}</span>)}</div></article>;
}

function PayoutStat({ label, value }: { label: string; value: string }) { return <div className="club-stat p-3"><p>{label}</p><strong className="mt-2 block text-lg text-[#f1dfb3]">{value}</strong></div>; }
function sumScores(scores: HoleScore[] | undefined) { return scores?.reduce((sum, score) => sum + score.strokes, 0) ?? 0; }
function formatMoney(value: number) { return `$${Number.isInteger(value) ? value : value.toFixed(2)}`; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function ordinal(place: 1 | 2) { return place === 1 ? "1st" : "2nd"; }
