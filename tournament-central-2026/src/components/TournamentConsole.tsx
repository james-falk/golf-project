"use client";

import { useEffect, useMemo, useState } from "react";
import { LorePhoto, LoreStrip } from "@/components/ClubLore";
import type { AccessRole } from "@/lib/access";
import { confirmed2026Rules } from "@/lib/tournament/config";
import { calculateScramblePayouts, calculateSkins, payoutPerSkin, skinRoundPot } from "@/lib/tournament/rules";
import { classicCourse, startingRoster, tributeCourse } from "@/lib/tournament/seed";
import type { Scores, Team, TournamentState } from "@/lib/tournament/state";
import type { HoleScore, Player } from "@/lib/tournament/types";

type Tab = "central" | "skins" | "scramble" | "setup" | "desk" | "archive";
type SkinDay = "thursday" | "friday" | "saturday";
type ScrambleDay = "friday" | "saturday";

const skinDays: SkinDay[] = ["thursday", "friday", "saturday"];
const scrambleDays: ScrambleDay[] = ["friday", "saturday"];

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "central", label: "Tournament Central" },
  { id: "skins", label: "Tribute skins" },
  { id: "scramble", label: "Classic scramble" },
  { id: "setup", label: "Commissioner setup" },
  { id: "desk", label: "Big Playas Desk" },
  { id: "archive", label: "2025 Archive" },
];

function makeTeams(players: Player[]) {
  const teamCount = confirmed2026Rules.scrambleRound.teamCount;
  return Array.from({ length: teamCount }, (_, teamIndex) => ({
    id: `team-${teamIndex + 1}`,
    name: `Team ${teamIndex + 1}`,
    playerIds: players.filter((_, playerIndex) => playerIndex % teamCount === teamIndex).map((player) => player.id),
  }));
}

const cardKey = (day: string, id: string | number) => `${day}:${id}`;

export default function TournamentConsole() {
  const [tab, setTab] = useState<Tab>("central");
  const [players, setPlayers] = useState(startingRoster);
  const [skinScores, setSkinScores] = useState<Scores>({});
  const [skinOfficialTotals, setSkinOfficialTotals] = useState<Record<string, string>>({});
  const [closestToPin, setClosestToPin] = useState<Record<string, string>>({});
  const [teamsByDay, setTeamsByDay] = useState<Record<ScrambleDay, Team[]>>(() => ({ friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) }));
  const [scrambleScores, setScrambleScores] = useState<Scores>({});
  const [scrambleOfficialTotals, setScrambleOfficialTotals] = useState<Record<string, string>>({});
  const [activePlayerId, setActivePlayerId] = useState(startingRoster[0].id);
  const [activeTeamId, setActiveTeamId] = useState("team-1");
  const [activeSkinDay, setActiveSkinDay] = useState<SkinDay>("thursday");
  const [activeScrambleDay, setActiveScrambleDay] = useState<ScrambleDay>("friday");
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<string[]>(["Ask the Desk about live scores, payouts, the format, or an approved roast. It only uses this tournament board."]);
  const [hydrated, setHydrated] = useState(false);
  const [accessRole, setAccessRole] = useState<AccessRole | "loading" | null>("loading");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [syncState, setSyncState] = useState<"local" | "saving" | "synced" | "error">("local");
  const teams = teamsByDay[activeScrambleDay];
  const setTeams: React.Dispatch<React.SetStateAction<Team[]>> = (value) => setTeamsByDay((current) => ({ ...current, [activeScrambleDay]: typeof value === "function" ? value(current[activeScrambleDay]) : value }));

  useEffect(() => {
    fetch("/api/access", { cache: "no-store" }).then((response) => response.json()).then((data: { role: AccessRole | null }) => setAccessRole(data.role)).catch(() => setAccessRole(null));
  }, []);

  useEffect(() => {
    if (!accessRole || accessRole === "loading") return;
    let cancelled = false;
    const load = async () => {
      let state: TournamentState | null = null;
      try {
        const response = await fetch("/api/tournament-state", { cache: "no-store" });
        const data = await response.json() as { state: TournamentState | null; shared: boolean };
        if (response.ok) {
          state = data.state;
          setSyncState(data.shared ? "synced" : "local");
        }
      } catch { setSyncState("local"); }
      if (!state) {
        const saved = window.localStorage.getItem("ecbp-2026-preview-v3");
        if (saved) try { state = JSON.parse(saved) as TournamentState; } catch { /* Use the official seed. */ }
      }
      if (cancelled) return;
      if (state) applyTournamentState(state, { setPlayers, setSkinScores, setClosestToPin, setTeamsByDay, setScrambleScores, setSkinOfficialTotals, setScrambleOfficialTotals });
      setHydrated(true);
    };
    load();
    return () => { cancelled = true; };
  }, [accessRole]);

  useEffect(() => {
    if (!hydrated) return;
    const state = { players, skinScores, closestToPin, teamsByDay, scrambleScores, skinOfficialTotals, scrambleOfficialTotals } satisfies TournamentState;
    window.localStorage.setItem("ecbp-2026-preview-v3", JSON.stringify(state));
    if (accessRole !== "scorekeeper") return;
    const timeout = window.setTimeout(async () => {
      setSyncState("saving");
      try {
        const response = await fetch("/api/tournament-state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
        if (!response.ok) throw new Error("Shared save failed");
        setSyncState("synced");
      } catch { setSyncState("error"); }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [hydrated, accessRole, players, skinScores, closestToPin, teamsByDay, scrambleScores, skinOfficialTotals, scrambleOfficialTotals]);

  useEffect(() => {
    if (!hydrated || accessRole !== "viewer") return;
    const refresh = async () => {
      try {
        const response = await fetch("/api/tournament-state", { cache: "no-store" });
        const data = await response.json() as { state: TournamentState | null };
        if (response.ok && data.state) applyTournamentState(data.state, { setPlayers, setSkinScores, setClosestToPin, setTeamsByDay, setScrambleScores, setSkinOfficialTotals, setScrambleOfficialTotals });
      } catch { /* Keep the last good public board visible. */ }
    };
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [hydrated, accessRole]);

  const activeSkinScores = useMemo(() => Object.fromEntries(players.map((player) => [player.id, skinScores[cardKey(activeSkinDay, player.id)] ?? []])), [players, skinScores, activeSkinDay]);
  const skinResults = useMemo(() => calculateSkins(players, tributeCourse, activeSkinScores, confirmed2026Rules.skinRound), [players, activeSkinScores]);
  const skinPot = skinRoundPot(players.length, confirmed2026Rules.skinRound);
  const perSkin = payoutPerSkin(players.length, skinResults, confirmed2026Rules.skinRound);
  const scrambleResults = teams.map((team) => {
    const card = scrambleScores[cardKey(activeScrambleDay, team.id)];
    return { teamId: team.id, total: card?.length === 18 ? sumScores(card) : 0 };
  });
  const scramblePayouts = calculateScramblePayouts(scrambleResults, players.length, confirmed2026Rules.scrambleRound);
  const skinWins = skinResults.filter((result) => result.isComplete && result.winnerId).length;
  const activeClosestToPin = Object.fromEntries(confirmed2026Rules.skinRound.closestToPinHoleNumbers.flatMap((hole) => closestToPin[cardKey(activeSkinDay, hole)] ? [[hole, closestToPin[cardKey(activeSkinDay, hole)]]] : []));

  const updateSkinScore = (playerId: string, holeNumber: number, value: string) => setSkinScores((current) => ({
    ...current,
    [cardKey(activeSkinDay, playerId)]: updateHoleScore(current[cardKey(activeSkinDay, playerId)], holeNumber, value),
  }));
  const updateScrambleScore = (teamId: string, holeNumber: number, value: string) => setScrambleScores((current) => ({
    ...current,
    [cardKey(activeScrambleDay, teamId)]: updateHoleScore(current[cardKey(activeScrambleDay, teamId)], holeNumber, value),
  }));

  const answerDesk = () => {
    const question = chatInput.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    let answer = "The Desk only has the live tournament board and commissioner-approved context. Try standings, skins, CTP, scramble, or payout.";
    if (lower.includes("skin")) answer = `${skinWins} outright skin${skinWins === 1 ? "" : "s"} so far. The skins pot is $${skinPot.skinsTotal}, currently $${perSkin} per winning skin.`;
    else if (lower.includes("ctp") || lower.includes("closest")) answer = `${Object.keys(activeClosestToPin).length} of ${confirmed2026Rules.skinRound.closestToPinHoleNumbers.length} CTP winners are recorded for ${capitalize(activeSkinDay)}. Each is worth $${confirmed2026Rules.skinRound.closestToPinPrize}.`;
    else if (lower.includes("scramble") || lower.includes("team")) {
      const leader = [...scrambleResults].filter((result) => result.total > 0).sort((a, b) => a.total - b.total)[0];
      answer = leader ? `${teamName(teams, leader.teamId)} leads The Classic at ${leader.total}. The Desk declines to call it a runaway until the card is complete.` : "No Classic scramble scores are in yet.";
    } else if (lower.includes("payout") || lower.includes("money") || lower.includes("pot")) answer = `With ${players.length} active players, each Tribute round is $${skinPot.total}: $${skinPot.closestToPinTotal} CTP and $${skinPot.skinsTotal} skins. Each Classic scramble pot is $${players.length * 20}.`;
    else if (lower.includes("leader") || lower.includes("standing")) answer = skinWins ? `${skinLeader(players, skinResults)?.name ?? "Nobody"} currently has the most skins. Check the Tribute board for every hole.` : "No skins have been decided yet. The golf gods remain neutral.";
    else if (lower.includes("roast")) answer = "The roast cabinet is waiting for commissioner-approved context. The Desk will not invent personal lore.";
    setChat((current) => [...current, `You: ${question}`, `Desk: ${answer}`]);
    setChatInput("");
  };

  const enterClubhouse = async () => {
    setAccessError("");
    const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: accessCode }) });
    const data = await response.json() as { role?: AccessRole; error?: string };
    if (!response.ok || !data.role) { setAccessError(data.error ?? "That passcode did not work."); return; }
    setHydrated(false);
    setAccessRole(data.role);
    setAccessCode("");
  };

  const leaveClubhouse = async () => {
    await fetch("/api/access", { method: "DELETE" });
    setAccessRole(null);
    setTab("central");
  };

  if (accessRole === "loading") return <ClubhouseLoading />;
  if (!accessRole) return <AccessGate code={accessCode} setCode={setAccessCode} error={accessError} enter={enterClubhouse} />;
  const canEdit = accessRole === "scorekeeper";
  const visibleTabs = canEdit ? tabs : tabs.filter((item) => item.id !== "setup");

  return (
    <main className="club-site min-h-screen text-stone-100">
      <header className="club-masthead">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="club-kicker">Otsego Club · Gaylord, Michigan</p>
              <h1 className="club-title mt-1">East Coast Big Playas Invitational</h1>
            </div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => window.location.reload()} className="club-badge">{canEdit ? syncState === "saving" ? "Saving…" : syncState === "error" ? "Save needs attention" : "Scorekeeper · Shared" : "Viewer · Refresh board"}</button><button type="button" onClick={leaveClubhouse} className="club-badge">Exit</button></div>
          </div>
          <nav className="club-nav mt-5 flex overflow-x-auto" aria-label="Tournament areas">
            {visibleTabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`club-tab whitespace-nowrap ${tab === item.id ? "club-tab-active" : ""}`}>{item.label}</button>)}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {tab === "central" && <Central players={players} skinPot={skinPot} skinWins={skinWins} perSkin={perSkin} skinResults={skinResults} closestToPin={activeClosestToPin} scrambleResults={scrambleResults} scramblePayouts={scramblePayouts} teams={teams} activeSkinDay={activeSkinDay} setActiveSkinDay={setActiveSkinDay} activeScrambleDay={activeScrambleDay} setActiveScrambleDay={setActiveScrambleDay} />}
        {tab === "skins" && <SkinsBoard canEdit={canEdit} activeDay={activeSkinDay} setActiveDay={setActiveSkinDay} players={players} scores={skinScores} activePlayerId={activePlayerId} setActivePlayerId={setActivePlayerId} updateScore={updateSkinScore} officialTotals={skinOfficialTotals} setOfficialTotals={setSkinOfficialTotals} closestToPin={closestToPin} setClosestToPin={setClosestToPin} skinResults={skinResults} perSkin={perSkin} />}
        {tab === "scramble" && <ScrambleBoard canEdit={canEdit} activeDay={activeScrambleDay} setActiveDay={setActiveScrambleDay} teams={teams} players={players} scores={scrambleScores} activeTeamId={activeTeamId} setActiveTeamId={setActiveTeamId} updateScore={updateScrambleScore} officialTotals={scrambleOfficialTotals} setOfficialTotals={setScrambleOfficialTotals} payouts={scramblePayouts} />}
        {tab === "setup" && canEdit && <Setup activeDay={activeScrambleDay} setActiveDay={setActiveScrambleDay} players={players} setPlayers={setPlayers} teams={teams} setTeams={setTeams} resetAllTeams={() => setTeamsByDay({ friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) })} />}
        {tab === "desk" && <Desk chat={chat} chatInput={chatInput} setChatInput={setChatInput} answerDesk={answerDesk} />}
        {tab === "archive" && <Archive />}
      </div>
    </main>
  );
}

function ClubhouseLoading() {
  return <main className="club-site grid min-h-screen place-items-center px-5 text-center"><div><p className="club-kicker">East Coast Big Playas Invitational</p><p className="club-display mt-3 text-4xl">Opening the clubhouse…</p></div></main>;
}

function AccessGate({ code, setCode, error, enter }: { code: string; setCode: (value: string) => void; error: string; enter: () => void }) {
  return <main className="club-site clubhouse-gate grid min-h-screen place-items-center px-5 py-12"><section className="club-hero grid w-full max-w-4xl overflow-hidden lg:grid-cols-[1fr_280px]"><div className="p-7 text-center sm:p-10 lg:text-left"><p className="club-kicker">Otsego Club · Tournament Ledger · 2026</p><h1 className="club-display mt-4 text-4xl sm:text-5xl">Welcome to<br />the clubhouse.</h1><p className="mt-5 max-w-md leading-7 text-[#e8ddc2]">Enter the viewer passcode for the live board or the scorekeeper passcode to record cards.</p><form onSubmit={(event) => { event.preventDefault(); enter(); }} className="mt-7 max-w-sm"><label className="club-kicker block text-left" htmlFor="clubhouse-code">Clubhouse passcode</label><input id="clubhouse-code" autoComplete="current-password" autoFocus type="password" value={code} onChange={(event) => setCode(event.target.value)} className="field mt-2 w-full" placeholder="Enter passcode" /><button className="mt-3 w-full border border-[#d6ba73] bg-[#e5d0a0] px-5 py-3 font-serif font-bold text-[#173f35] hover:bg-[#f0deb2]">Enter Tournament Central</button>{error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}</form></div><div className="gate-portrait"><LorePhoto index={0} label="Membership committee · tap for credentials" /></div></section></main>;
}

function Central({ players, skinPot, skinWins, perSkin, skinResults, closestToPin, scrambleResults, scramblePayouts, teams, activeSkinDay, setActiveSkinDay, activeScrambleDay, setActiveScrambleDay }: { players: Player[]; skinPot: ReturnType<typeof skinRoundPot>; skinWins: number; perSkin: number; skinResults: ReturnType<typeof calculateSkins>; closestToPin: Record<number, string>; scrambleResults: Array<{ teamId: string; total: number }>; scramblePayouts: ReturnType<typeof calculateScramblePayouts>; teams: ReturnType<typeof makeTeams>; activeSkinDay: SkinDay; setActiveSkinDay: (day: SkinDay) => void; activeScrambleDay: ScrambleDay; setActiveScrambleDay: (day: ScrambleDay) => void }) {
  const scrambleLeader = [...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total)[0];
  const skinStandings = players.map((player) => ({ player, wins: skinResults.filter((result) => result.winnerId === player.id).length })).filter((entry) => entry.wins > 0).sort((a, b) => b.wins - a.wins || a.player.name.localeCompare(b.player.name));
  return <div className="space-y-8">
    <section className="club-filter-bar flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3"><div><span className="club-ledger-label mr-3">Tribute board</span><DayPicker days={skinDays} activeDay={activeSkinDay} onChange={setActiveSkinDay} compact /></div><div><span className="club-ledger-label mr-3">Classic board</span><DayPicker days={scrambleDays} activeDay={activeScrambleDay} onChange={setActiveScrambleDay} compact /></div></section>
    <section className="club-hero grid gap-5 p-7 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
      <div><p className="club-kicker">The Commissioner&apos;s official board</p><h2 className="club-display mt-4 text-4xl sm:text-6xl">The 2026<br />score ledger.</h2><p className="mt-5 max-w-xl text-base leading-7 text-[#e8ddc2]">The Tribute in the morning. The Classic in the afternoon. Every stroke, skin and dollar is accounted for here.</p></div>
      <div className="grid grid-cols-2 gap-3 self-end"><Stat label="Active players" value={String(players.length)} detail="all-in skins field" /><Stat label="Skins decided" value={String(skinWins)} detail={skinWins ? `$${perSkin} per skin` : "waiting for a unique low net"} /><Stat label="CTP entered" value={`${Object.keys(closestToPin).length}/4`} detail="$20 each" /><Stat label="Classic leader" value={scrambleLeader ? teamName(teams, scrambleLeader.teamId) : "—"} detail={scrambleLeader ? `${scrambleLeader.total} total` : "no team card yet"} /></div>
    </section>
    <LoreStrip />
    <section className="grid gap-4 md:grid-cols-3"><Card title="Thursday" detail="The Tribute" body="18-hole skins + closest to pin" /><Card title="Friday" detail="Tribute → Classic" body="Skins + CTP, then 18-hole scramble" /><Card title="Saturday" detail="Tribute → Classic" body="Skins + CTP, then final scramble" /></section>
    <section className="club-ledger p-6 text-[#12332d]"><p className="club-ledger-label">The day&apos;s purse</p><div className="mt-5 grid gap-6 sm:grid-cols-3"><div><p className="club-ledger-total">${skinPot.total}</p><p className="mt-1 text-sm text-[#557269]">${20} × {players.length} players</p></div><div><p className="club-ledger-total">${skinPot.closestToPinTotal}</p><p className="mt-1 text-sm text-[#557269]">four $20 closest-to-pin prizes</p></div><div><p className="club-ledger-total">${skinPot.skinsTotal}</p><p className="mt-1 text-sm text-[#557269]">split across outright skin winners</p></div></div></section>
    <section className="grid gap-4 lg:grid-cols-2"><div className="club-card p-5"><p className="club-kicker">{capitalize(activeSkinDay)} · The Tribute</p><h3 className="club-card-title mt-1">Skins standings & payouts</h3><div className="mt-4">{skinStandings.length ? skinStandings.map((entry, index) => <div key={entry.player.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-[#bca062]/30 py-2 text-sm"><span className="text-[#d6ba73]">{index + 1}</span><span className="font-semibold">{entry.player.name}</span><span>{entry.wins} skin{entry.wins === 1 ? "" : "s"}</span><span className="font-bold text-[#ead292]">${entry.wins * perSkin}</span></div>) : <p className="mt-3 text-sm text-stone-400">No complete holes have produced an outright winner yet.</p>}</div><div className="mt-5"><p className="club-kicker">Closest to pin · $20 each</p>{Object.entries(closestToPin).length ? Object.entries(closestToPin).map(([hole, playerId]) => <p key={hole} className="mt-2 text-sm">Hole {hole} · <span className="font-semibold text-[#ead292]">{players.find((player) => player.id === playerId)?.name ?? "Winner pending"}</span></p>) : <p className="mt-2 text-sm text-stone-400">No winners entered.</p>}</div></div><div className="club-card p-5"><p className="club-kicker">{capitalize(activeScrambleDay)} · The Classic</p><h3 className="club-card-title mt-1">Team standings & payouts</h3><div className="mt-4">{[...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total).map((entry, index) => { const payout = scramblePayouts.find((item) => item.teamId === entry.teamId); return <div key={entry.teamId} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-[#bca062]/30 py-2 text-sm"><span className="text-[#d6ba73]">{index + 1}</span><span className="font-semibold">{teamName(teams, entry.teamId)}</span><span>{entry.total}</span><span className="font-bold text-[#ead292]">{payout ? `$${Math.floor(payout.teamPayout)}` : "—"}</span></div>})}{!scrambleResults.some((entry) => entry.total > 0) && <p className="mt-3 text-sm text-stone-400">Completed team cards will rank here automatically.</p>}</div></div></section>
  </div>;
}

function SkinsBoard({ canEdit, activeDay, setActiveDay, players, scores, activePlayerId, setActivePlayerId, updateScore, officialTotals, setOfficialTotals, closestToPin, setClosestToPin, skinResults, perSkin }: { canEdit: boolean; activeDay: SkinDay; setActiveDay: (day: SkinDay) => void; players: Player[]; scores: Scores; activePlayerId: string; setActivePlayerId: (id: string) => void; updateScore: (id: string, hole: number, value: string) => void; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; closestToPin: Record<string, string>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<string, string>>>; skinResults: ReturnType<typeof calculateSkins>; perSkin: number }) {
  const player = players.find((entry) => entry.id === activePlayerId) ?? players[0];
  const playerKey = cardKey(activeDay, player.id);
  const total = sumScores(scores[playerKey]);
  const official = officialTotals[playerKey] ?? "";
  const enteredHoles = scores[playerKey]?.length ?? 0;
  return <div className="space-y-6"><SectionTitle eyebrow="The Tribute — morning round" title="Skins & closest to pin" text="Enter a single player card at a time. Net scoring uses the locked A/B/C/D stroke bands and Tribute stroke indexes." />
    <DayPicker days={skinDays} activeDay={activeDay} onChange={setActiveDay} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="scorecard-sheet p-5 text-[#12332d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="label">Scorecard player</label><select value={player.id} onChange={(event) => setActivePlayerId(event.target.value)} className="field mt-2">{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.tier} tier</option>)}</select></div><div className="text-right"><p className="club-ledger-label">Gross total</p><p className="club-ledger-total">{total || "—"}</p></div></div><ScoreGrid disabled={!canEdit} showHandicap course={tributeCourse.holes} scores={scores[playerKey]} onChange={(hole, value) => updateScore(player.id, hole, value)} />
      <div className="scorecard-check mt-5 grid gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]"><label><span className="label block">Official card total (review check)</span><input disabled={!canEdit} inputMode="numeric" value={official} onChange={(event) => setOfficialTotals((current) => ({ ...current, [playerKey]: event.target.value }))} className="field mt-2 block w-full disabled:opacity-70" placeholder="Enter marked-card total" /></label><div className={`self-end border px-4 py-3 text-sm font-semibold ${official && (enteredHoles !== 18 || Number(official) !== total) ? "border-rose-400 bg-rose-100 text-rose-800" : "border-emerald-500/40 bg-emerald-100 text-emerald-800"}`}>{enteredHoles !== 18 ? `${18 - enteredHoles} holes still missing` : official ? Number(official) === total ? "✓ Totals match" : `Review: entered ${total}, card says ${official}` : "Add official total to verify"}</div></div></section>
      <aside className="space-y-4"><div className="club-card p-5"><p className="club-kicker">Live skins</p><div className="mt-4 space-y-2">{skinResults.filter((result) => result.isComplete).map((result) => <div key={result.holeNumber} className="flex items-center justify-between border-b border-[#bca062]/30 pb-2 text-sm"><span>Hole {result.holeNumber}</span><span className={result.winnerId ? "font-bold text-[#ead292]" : "text-stone-400"}>{result.winnerId ? `${players.find((entry) => entry.id === result.winnerId)?.name} · $${perSkin}` : "Tie — dead hole"}</span></div>)}{!skinResults.some((result) => result.isComplete) && <p className="text-sm leading-6 text-stone-400">A hole is decided only after all {players.length} cards contain that score.</p>}</div></div>
        <div className="club-card p-5"><p className="club-kicker">Closest to pin</p><div className="mt-4 space-y-3">{confirmed2026Rules.skinRound.closestToPinHoleNumbers.map((hole) => { const ctpKey = cardKey(activeDay, hole); return <label key={hole} className="block text-sm font-semibold">Hole {hole}<select disabled={!canEdit} value={closestToPin[ctpKey] ?? ""} onChange={(event) => setClosestToPin((current) => ({ ...current, [ctpKey]: event.target.value }))} className="field mt-1 w-full disabled:opacity-70"><option value="">No winner entered</option>{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>})}</div></div><LorePhoto index={7} label="Pace-of-play enforcement" className="lore-photo-wide" /></aside>
    </div></div>;
}

function ScrambleBoard({ canEdit, activeDay, setActiveDay, teams, players, scores, activeTeamId, setActiveTeamId, updateScore, officialTotals, setOfficialTotals, payouts }: { canEdit: boolean; activeDay: ScrambleDay; setActiveDay: (day: ScrambleDay) => void; teams: ReturnType<typeof makeTeams>; players: Player[]; scores: Scores; activeTeamId: string; setActiveTeamId: (id: string) => void; updateScore: (id: string, hole: number, value: string) => void; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; payouts: ReturnType<typeof calculateScramblePayouts> }) {
  const team = teams.find((entry) => entry.id === activeTeamId) ?? teams[0]; const teamKey = cardKey(activeDay, team.id); const total = sumScores(scores[teamKey]); const official = officialTotals[teamKey] ?? ""; const enteredHoles = scores[teamKey]?.length ?? 0;
  return <div className="space-y-6"><SectionTitle eyebrow="The Classic — afternoon round" title="18-hole team scramble" text="Gross team score. First and second payout follows the legacy tie rules; the final card total catches missed holes." />
    <DayPicker days={scrambleDays} activeDay={activeDay} onChange={setActiveDay} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="scorecard-sheet p-5 text-[#12332d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="label">Team card</label><select value={team.id} onChange={(event) => setActiveTeamId(event.target.value)} className="field mt-2">{teams.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><p className="mt-2 text-sm text-[#628075]">{team.playerIds.map((id) => players.find((player) => player.id === id)?.name).join(" · ")}</p></div><div className="text-right"><p className="club-ledger-label">Team total</p><p className="club-ledger-total">{total || "—"}</p></div></div><ScoreGrid disabled={!canEdit} course={classicCourse.holes} scores={scores[teamKey]} onChange={(hole, value) => updateScore(team.id, hole, value)} />
      <div className="scorecard-check mt-5 grid gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]"><label><span className="label block">Official card total</span><input disabled={!canEdit} inputMode="numeric" value={official} onChange={(event) => setOfficialTotals((current) => ({ ...current, [teamKey]: event.target.value }))} className="field mt-2 block w-full disabled:opacity-70" placeholder="Enter marked-card total" /></label><div className={`self-end border px-4 py-3 text-sm font-semibold ${official && (enteredHoles !== 18 || Number(official) !== total) ? "border-rose-400 bg-rose-100 text-rose-800" : "border-emerald-500/40 bg-emerald-100 text-emerald-800"}`}>{enteredHoles !== 18 ? `${18 - enteredHoles} holes still missing` : official ? Number(official) === total ? "✓ Totals match" : `Review: entered ${total}, card says ${official}` : "Add official total to verify"}</div></div></section>
      <aside className="space-y-4"><div className="club-card p-5"><p className="club-kicker">Classic leaderboard</p><div className="mt-4 space-y-3">{teams.map((entry) => { const teamPayout = payouts.find((item) => item.teamId === entry.id); const teamTotal = sumScores(scores[cardKey(activeDay, entry.id)]); return <div key={entry.id} className="border-b border-[#bca062]/35 p-3"><div className="flex justify-between gap-2 font-semibold"><span>{entry.name}</span><span>{teamTotal || "—"}</span></div><p className="mt-1 text-xs text-stone-400">{teamPayout ? `${teamPayout.place}${teamPayout.place === 1 ? "st" : "nd"} · $${Math.floor(teamPayout.teamPayout)} team payout` : "Awaiting final ranking"}</p></div> })}</div></div><LorePhoto index={15} label="Putting laboratory · confidential" className="lore-photo-wide" /></aside>
    </div></div>;
}

function Setup({ activeDay, setActiveDay, players, setPlayers, teams, setTeams, resetAllTeams }: { activeDay: ScrambleDay; setActiveDay: (day: ScrambleDay) => void; players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; teams: Team[]; setTeams: React.Dispatch<React.SetStateAction<Team[]>>; resetAllTeams: () => void }) {
  return <div className="space-y-6"><SectionTitle eyebrow="Commissioner workspace" title="Roster, bands & teams" text="Roster changes, stroke bands and team assignments save to the shared tournament board for every authorized scorekeeper." />
    <section className="club-ledger p-5 text-[#12332d] sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="club-ledger-label">Official field</p><h3 className="club-card-title !text-[#173f35]">Player stroke bands</h3></div><button onClick={() => { setPlayers(startingRoster); resetAllTeams(); }} className="border border-[#8d794f] px-4 py-2 text-sm font-semibold hover:bg-[#ded1b4]">Reset roster & both days</button></div><div className="mb-5 grid grid-cols-4 border border-[#a99670] bg-[#f8f2e5]">{(["A", "B", "C", "D"] as const).map((tier) => <div key={tier} className="border-r border-[#a99670] p-3 text-center last:border-r-0"><p className="font-serif text-xl font-bold">{tier}</p><p className="text-xs text-[#61766d]">{players.filter((player) => player.tier === tier).length} players · {confirmed2026Rules.skinRound.tierStrokes[tier]} strokes</p></div>)}</div><div className="grid gap-px border border-[#a99670] bg-[#a99670] sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => <div key={player.id} className="flex items-center justify-between bg-[#f8f2e5] px-4 py-3"><span className="font-semibold">{player.name}</span><select aria-label={`${player.name} stroke band`} value={player.tier} onChange={(event) => setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, tier: event.target.value as Player["tier"] } : entry))} className="field !min-h-0 !py-1 text-sm font-semibold"><option value="A">A · 0</option><option value="B">B · 6</option><option value="C">C · 12</option><option value="D">D · 18</option></select></div>)}</div></section>
    <section className="club-card p-5 sm:p-7"><p className="club-kicker">The Classic pairings</p><h3 className="club-card-title mt-1">{capitalize(activeDay)} · six teams of four</h3><p className="mt-2 text-sm text-stone-300">Friday and Saturday are separate. Rename teams or swap any player below; selecting someone already assigned automatically swaps the two positions.</p><div className="mt-4"><DayPicker days={scrambleDays} activeDay={activeDay} onChange={setActiveDay} /></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teams.map((team) => <div key={team.id} className="border border-[#bca062]/55 bg-black/15 p-4"><input aria-label={`${team.name} name`} value={team.name} onChange={(event) => setTeams((current) => current.map((entry) => entry.id === team.id ? { ...entry, name: event.target.value } : entry))} className="w-full border-b border-[#bca062]/45 bg-transparent pb-2 font-serif text-lg font-bold text-[#f1e6ce] outline-none" /> <div className="mt-3 space-y-2">{team.playerIds.map((id, slotIndex) => <select aria-label={`${team.name} player ${slotIndex + 1}`} key={`${team.id}-${slotIndex}`} value={id} onChange={(event) => setTeams((current) => swapTeamPlayer(current, team.id, slotIndex, event.target.value))} className="field w-full text-sm">{players.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.tier}</option>)}</select>)}</div></div>)}</div></section><div className="lore-inline-row"><LorePhoto index={1} label="Player identification department" /><LorePhoto index={4} label="Pairings committee in session" /></div>
  </div>;
}

function Desk({ chat, chatInput, setChatInput, answerDesk }: { chat: string[]; chatInput: string; setChatInput: (value: string) => void; answerDesk: () => void }) { return <div className="mx-auto max-w-4xl"><SectionTitle eyebrow="Closed-loop tournament assistant" title="Big Playas Desk" text="The Desk reads only the scoreboard and commissioner-approved context. No web browsing, no made-up personal history." /><div className="mt-6 grid gap-5 lg:grid-cols-[1fr_220px]"><section className="rounded-3xl bg-white p-5 text-[#12332d] sm:p-7"><div className="space-y-4">{chat.map((line, index) => <p key={`${line}-${index}`} className={`rounded-2xl p-4 text-sm leading-6 ${line.startsWith("Desk:") ? "bg-[#e5f1e9]" : "bg-[#f2eee5]"}`}>{line}</p>)}</div><form onSubmit={(event) => { event.preventDefault(); answerDesk(); }} className="mt-5 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} className="field flex-1" placeholder="Who is leading? What is the skins pot? Give me a roast." /><button className="rounded-xl bg-[#0d3b31] px-5 py-2 font-bold text-white hover:bg-[#175746]">Ask</button></form></section><LorePhoto index={18} label="Desk attendant · on duty" className="lore-photo-tall" /></div></div>; }

function Archive() { return <div className="mx-auto max-w-4xl"><SectionTitle eyebrow="The club record book" title="2025 Tournament Archive" text="Last year remains preserved as a separate read-only site, exactly where it belongs: available for the stories, safely away from this year’s live ledger." /><section className="club-hero mt-7 grid gap-7 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="club-kicker">Previous championship</p><h3 className="club-display mt-3 text-3xl sm:text-4xl">Take a look back<br />at the 2025 board.</h3><p className="mt-4 max-w-xl leading-7 text-[#e8ddc2]">The archived site cannot alter 2026 scores. Its checked-in tournament snapshot is preserved while any missing historical details can be restored later from the original screenshots.</p></div><a href="https://tournament-archive-2025.vercel.app" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center border border-[#d6ba73] bg-[#e5d0a0] px-6 py-3 font-serif font-bold text-[#173f35] hover:bg-[#f0deb2]">Open the 2025 Archive ↗</a></section><div className="lore-inline-row mt-6"><LorePhoto index={17} label="Assistant club historian" /><LorePhoto index={19} label="Recovery room records" /></div></div>; }

function DayPicker<T extends string>({ days, activeDay, onChange, compact = false }: { days: readonly T[]; activeDay: T; onChange: (day: T) => void; compact?: boolean }) { return <div className={`day-picker ${compact ? "inline-flex" : "flex w-fit"}`} role="group" aria-label="Select tournament day">{days.map((day) => <button key={day} type="button" aria-pressed={activeDay === day} onClick={() => onChange(day)} className={`day-picker-button ${activeDay === day ? "day-picker-active" : ""}`}>{capitalize(day)}</button>)}</div>; }
function ScoreGrid({ course, scores, onChange, disabled = false, showHandicap = false }: { course: typeof tributeCourse.holes; scores: HoleScore[] | undefined; onChange: (hole: number, value: string) => void; disabled?: boolean; showHandicap?: boolean }) { return <div className="score-grid mt-7 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9">{course.map((hole) => { const value = scores?.find((item) => item.holeNumber === hole.number)?.strokes ?? ""; return <label key={hole.number} className="score-cell text-center"><span className="block text-[11px] font-bold uppercase tracking-wider text-[#57776a]">Hole {hole.number}</span><span className="mt-1 block text-[10px] text-[#789087]">Par {hole.par}{showHandicap ? ` · HCP ${hole.strokeIndex}` : ""}</span><input disabled={disabled} aria-label={`Hole ${hole.number} score`} value={value} inputMode="numeric" onChange={(event) => onChange(hole.number, event.target.value)} className="mt-1 w-full bg-transparent text-center font-serif text-2xl font-bold outline-none disabled:cursor-default" placeholder="—" /></label> })}</div>; }
function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <section><p className="club-kicker">{eyebrow}</p><h2 className="club-display mt-2 text-3xl sm:text-4xl">{title}</h2><p className="mt-3 max-w-2xl leading-7 text-stone-300">{text}</p></section>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="club-stat p-4"><p>{label}</p><p className="club-stat-value mt-2 truncate">{value}</p><p className="mt-1 text-xs text-[#c5b48f]">{detail}</p></div>; }
function Card({ title, detail, body }: { title: string; detail: string; body: string }) { return <article className="club-card p-5"><p className="club-kicker">{detail}</p><h3 className="club-card-title mt-2">{title}</h3><p className="mt-3 text-sm leading-6 text-[#d6c9ab]">{body}</p></article>; }
function sumScores(scores: HoleScore[] | undefined) { return scores?.reduce((sum, score) => sum + score.strokes, 0) ?? 0; }
function updateHoleScore(scores: HoleScore[] | undefined, holeNumber: number, rawValue: string) { const value = Number(rawValue); const rest = (scores ?? []).filter((score) => score.holeNumber !== holeNumber); return Number.isInteger(value) && value > 0 && value < 20 ? [...rest, { holeNumber, strokes: value }].sort((a, b) => a.holeNumber - b.holeNumber) : rest; }
function teamName(teams: ReturnType<typeof makeTeams>, teamId: string) { return teams.find((team) => team.id === teamId)?.name ?? "Unknown team"; }
function swapTeamPlayer(teams: ReturnType<typeof makeTeams>, teamId: string, slotIndex: number, nextPlayerId: string) { const sourceTeam = teams.find((team) => team.id === teamId); const previousPlayerId = sourceTeam?.playerIds[slotIndex]; if (!previousPlayerId || previousPlayerId === nextPlayerId) return teams; const occupiedTeam = teams.find((team) => team.playerIds.includes(nextPlayerId)); const occupiedIndex = occupiedTeam?.playerIds.indexOf(nextPlayerId) ?? -1; return teams.map((team) => ({ ...team, playerIds: team.playerIds.map((playerId, index) => team.id === teamId && index === slotIndex ? nextPlayerId : team.id === occupiedTeam?.id && index === occupiedIndex ? previousPlayerId : playerId) })); }
function skinLeader(players: Player[], results: ReturnType<typeof calculateSkins>) { const wins = new Map<string, number>(); results.forEach((result) => result.winnerId && wins.set(result.winnerId, (wins.get(result.winnerId) ?? 0) + 1)); const winner = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; return players.find((player) => player.id === winner); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function applyTournamentState(state: TournamentState, setters: { setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; setSkinScores: React.Dispatch<React.SetStateAction<Scores>>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<string, string>>>; setTeamsByDay: React.Dispatch<React.SetStateAction<Record<ScrambleDay, Team[]>>>; setScrambleScores: React.Dispatch<React.SetStateAction<Scores>>; setSkinOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; setScrambleOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>> }) { const players = state.players?.length ? state.players : startingRoster; const legacyTeams = (state as TournamentState & { teams?: Team[] }).teams; setters.setPlayers(players); setters.setSkinScores(state.skinScores ?? {}); setters.setClosestToPin(state.closestToPin ?? {}); setters.setTeamsByDay(state.teamsByDay ?? { friday: legacyTeams?.length ? legacyTeams : makeTeams(players), saturday: legacyTeams?.length ? legacyTeams : makeTeams(players) }); setters.setScrambleScores(state.scrambleScores ?? {}); setters.setSkinOfficialTotals(state.skinOfficialTotals ?? {}); setters.setScrambleOfficialTotals(state.scrambleOfficialTotals ?? {}); }
