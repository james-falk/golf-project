"use client";

import { useEffect, useMemo, useState } from "react";
import { confirmed2026Rules } from "@/lib/tournament/config";
import { calculateScramblePayouts, calculateSkins, payoutPerSkin, skinRoundPot } from "@/lib/tournament/rules";
import { startingRoster, tributeCourse } from "@/lib/tournament/seed";
import type { HoleScore, Player } from "@/lib/tournament/types";

type Tab = "central" | "skins" | "scramble" | "setup" | "desk";
type Scores = Record<string, HoleScore[]>;

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "central", label: "Tournament Central" },
  { id: "skins", label: "Tribute skins" },
  { id: "scramble", label: "Classic scramble" },
  { id: "setup", label: "Commissioner setup" },
  { id: "desk", label: "Big Playas Desk" },
];

function makeTeams(players: Player[]) {
  return Array.from({ length: 5 }, (_, teamIndex) => ({
    id: `team-${teamIndex + 1}`,
    name: `Team ${teamIndex + 1}`,
    playerIds: players.filter((_, playerIndex) => playerIndex % 5 === teamIndex).map((player) => player.id),
  }));
}

export default function TournamentConsole() {
  const [tab, setTab] = useState<Tab>("central");
  const [players, setPlayers] = useState(startingRoster);
  const [skinScores, setSkinScores] = useState<Scores>({});
  const [skinOfficialTotals, setSkinOfficialTotals] = useState<Record<string, string>>({});
  const [closestToPin, setClosestToPin] = useState<Record<number, string>>({});
  const [teams, setTeams] = useState(() => makeTeams(startingRoster));
  const [scrambleScores, setScrambleScores] = useState<Scores>({});
  const [scrambleOfficialTotals, setScrambleOfficialTotals] = useState<Record<string, string>>({});
  const [activePlayerId, setActivePlayerId] = useState(startingRoster[0].id);
  const [activeTeamId, setActiveTeamId] = useState("team-1");
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<string[]>(["Ask the Desk about live scores, payouts, the format, or an approved roast. It only uses this tournament board."]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("ecbp-2026-preview");
    if (saved) {
      try {
        const state = JSON.parse(saved) as { players: Player[]; skinScores: Scores; closestToPin: Record<number, string>; teams: typeof teams; scrambleScores: Scores; skinOfficialTotals: Record<string, string>; scrambleOfficialTotals: Record<string, string> };
        setPlayers(state.players ?? startingRoster);
        setSkinScores(state.skinScores ?? {});
        setClosestToPin(state.closestToPin ?? {});
        setTeams(state.teams ?? makeTeams(state.players ?? startingRoster));
        setScrambleScores(state.scrambleScores ?? {});
        setSkinOfficialTotals(state.skinOfficialTotals ?? {});
        setScrambleOfficialTotals(state.scrambleOfficialTotals ?? {});
      } catch { /* Keep the clean seed if a stale preview value exists. */ }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("ecbp-2026-preview", JSON.stringify({ players, skinScores, closestToPin, teams, scrambleScores, skinOfficialTotals, scrambleOfficialTotals }));
  }, [hydrated, players, skinScores, closestToPin, teams, scrambleScores, skinOfficialTotals, scrambleOfficialTotals]);

  const skinResults = useMemo(() => calculateSkins(players, tributeCourse, skinScores, confirmed2026Rules.skinRound), [players, skinScores]);
  const skinPot = skinRoundPot(players.length, confirmed2026Rules.skinRound);
  const perSkin = payoutPerSkin(players.length, skinResults, confirmed2026Rules.skinRound);
  const scrambleResults = teams.map((team) => ({ teamId: team.id, total: sumScores(scrambleScores[team.id]) }));
  const scramblePayouts = calculateScramblePayouts(scrambleResults, players.length, confirmed2026Rules.scrambleRound);
  const skinWins = skinResults.filter((result) => result.winnerId).length;

  const updateSkinScore = (playerId: string, holeNumber: number, value: string) => setSkinScores((current) => ({
    ...current,
    [playerId]: updateHoleScore(current[playerId], holeNumber, value),
  }));
  const updateScrambleScore = (teamId: string, holeNumber: number, value: string) => setScrambleScores((current) => ({
    ...current,
    [teamId]: updateHoleScore(current[teamId], holeNumber, value),
  }));

  const answerDesk = () => {
    const question = chatInput.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    let answer = "The Desk only has the live tournament board and commissioner-approved context. Try standings, skins, CTP, scramble, or payout.";
    if (lower.includes("skin")) answer = `${skinWins} outright skin${skinWins === 1 ? "" : "s"} so far. The skins pot is $${skinPot.skinsTotal}, currently $${perSkin} per winning skin.`;
    else if (lower.includes("ctp") || lower.includes("closest")) answer = `${Object.keys(closestToPin).length} of ${confirmed2026Rules.skinRound.closestToPinHoleNumbers.length} CTP winners are recorded. Each is worth $${confirmed2026Rules.skinRound.closestToPinPrize}.`;
    else if (lower.includes("scramble") || lower.includes("team")) {
      const leader = [...scrambleResults].filter((result) => result.total > 0).sort((a, b) => a.total - b.total)[0];
      answer = leader ? `${teamName(teams, leader.teamId)} leads The Classic at ${leader.total}. The Desk declines to call it a runaway until the card is complete.` : "No Classic scramble scores are in yet.";
    } else if (lower.includes("payout") || lower.includes("money") || lower.includes("pot")) answer = `With ${players.length} active players, each Tribute round is $${skinPot.total}: $${skinPot.closestToPinTotal} CTP and $${skinPot.skinsTotal} skins. Each Classic scramble pot is $${players.length * 20}.`;
    else if (lower.includes("leader") || lower.includes("standing")) answer = skinWins ? `${skinLeader(players, skinResults)?.name ?? "Nobody"} currently has the most skins. Check the Tribute board for every hole.` : "No skins have been decided yet. The golf gods remain neutral.";
    else if (lower.includes("roast")) answer = "The roast cabinet is waiting for commissioner-approved context. The Desk will not invent personal lore.";
    setChat((current) => [...current, `You: ${question}`, `Desk: ${answer}`]);
    setChatInput("");
  };

  return (
    <main className="min-h-screen bg-[#071b18] text-stone-100">
      <header className="border-b border-white/10 bg-[#092520]">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200">ECBP / 2026</p>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">East Coast Big Playas — Tournament Central</h1>
            </div>
            <div className="rounded-full border border-amber-300/30 bg-amber-100/10 px-3 py-1.5 text-xs font-semibold text-amber-100">Preview workspace · local only</div>
          </div>
          <nav className="mt-5 flex gap-1 overflow-x-auto pb-1" aria-label="Tournament areas">
            {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item.id ? "bg-emerald-200 text-[#08221d]" : "text-emerald-50/70 hover:bg-white/10 hover:text-white"}`}>{item.label}</button>)}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {tab === "central" && <Central players={players} skinPot={skinPot} skinWins={skinWins} perSkin={perSkin} closestToPin={closestToPin} scrambleResults={scrambleResults} teams={teams} />}
        {tab === "skins" && <SkinsBoard players={players} scores={skinScores} activePlayerId={activePlayerId} setActivePlayerId={setActivePlayerId} updateScore={updateSkinScore} officialTotals={skinOfficialTotals} setOfficialTotals={setSkinOfficialTotals} closestToPin={closestToPin} setClosestToPin={setClosestToPin} skinResults={skinResults} perSkin={perSkin} />}
        {tab === "scramble" && <ScrambleBoard teams={teams} players={players} scores={scrambleScores} activeTeamId={activeTeamId} setActiveTeamId={setActiveTeamId} updateScore={updateScrambleScore} officialTotals={scrambleOfficialTotals} setOfficialTotals={setScrambleOfficialTotals} payouts={scramblePayouts} />}
        {tab === "setup" && <Setup players={players} setPlayers={setPlayers} teams={teams} setTeams={setTeams} />}
        {tab === "desk" && <Desk chat={chat} chatInput={chatInput} setChatInput={setChatInput} answerDesk={answerDesk} />}
      </div>
    </main>
  );
}

function Central({ players, skinPot, skinWins, perSkin, closestToPin, scrambleResults, teams }: { players: Player[]; skinPot: ReturnType<typeof skinRoundPot>; skinWins: number; perSkin: number; closestToPin: Record<number, string>; scrambleResults: Array<{ teamId: string; total: number }>; teams: ReturnType<typeof makeTeams> }) {
  const scrambleLeader = [...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total)[0];
  return <div className="space-y-8">
    <section className="grid gap-5 rounded-3xl bg-[radial-gradient(ellipse_at_top_left,_#226b57,_#0b2d27_55%,_#071b18)] p-7 shadow-2xl sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
      <div><p className="font-mono text-xs uppercase tracking-[0.26em] text-emerald-200">The official live board</p><h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Scores in.<br />Stories out.</h2><p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/75">Tribute skins in the morning. The Classic scramble in the afternoon. Every board here is wired to the same locked rules engine.</p></div>
      <div className="grid grid-cols-2 gap-3 self-end"><Stat label="Active players" value={String(players.length)} detail="all-in skins field" /><Stat label="Skins decided" value={String(skinWins)} detail={skinWins ? `$${perSkin} per skin` : "waiting for a unique low net"} /><Stat label="CTP entered" value={`${Object.keys(closestToPin).length}/4`} detail="$20 each" /><Stat label="Classic leader" value={scrambleLeader ? teamName(teams, scrambleLeader.teamId) : "—"} detail={scrambleLeader ? `${scrambleLeader.total} total` : "no team card yet"} /></div>
    </section>
    <section className="grid gap-4 md:grid-cols-3"><Card title="Thursday" detail="The Tribute" body="18-hole skins + closest to pin" /><Card title="Friday" detail="Tribute → Classic" body="Skins + CTP, then 18-hole scramble" /><Card title="Saturday" detail="Tribute → Classic" body="Skins + CTP, then final scramble" /></section>
    <section className="rounded-3xl bg-[#f4f1e8] p-6 text-[#12332d]"><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#518070]">Today’s money map</p><div className="mt-5 grid gap-6 sm:grid-cols-3"><div><p className="text-3xl font-black">${skinPot.total}</p><p className="mt-1 text-sm text-[#557269]">${20} × {players.length} players</p></div><div><p className="text-3xl font-black">${skinPot.closestToPinTotal}</p><p className="mt-1 text-sm text-[#557269]">four $20 closest-to-pin prizes</p></div><div><p className="text-3xl font-black">${skinPot.skinsTotal}</p><p className="mt-1 text-sm text-[#557269]">split across outright skin winners</p></div></div></section>
  </div>;
}

function SkinsBoard({ players, scores, activePlayerId, setActivePlayerId, updateScore, officialTotals, setOfficialTotals, closestToPin, setClosestToPin, skinResults, perSkin }: { players: Player[]; scores: Scores; activePlayerId: string; setActivePlayerId: (id: string) => void; updateScore: (id: string, hole: number, value: string) => void; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; closestToPin: Record<number, string>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<number, string>>>; skinResults: ReturnType<typeof calculateSkins>; perSkin: number }) {
  const player = players.find((entry) => entry.id === activePlayerId) ?? players[0];
  const total = sumScores(scores[player.id]);
  const official = officialTotals[player.id] ?? "";
  return <div className="space-y-6"><SectionTitle eyebrow="The Tribute — morning round" title="Skins & closest to pin" text="Enter a single player card at a time. Net scoring uses the locked A/B/C/D stroke bands and Tribute stroke indexes." />
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><section className="rounded-3xl bg-white p-5 text-[#12332d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="label">Scorecard player</label><select value={player.id} onChange={(event) => setActivePlayerId(event.target.value)} className="field mt-2">{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.tier} tier</option>)}</select></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wider text-[#638176]">Gross total</p><p className="text-3xl font-black">{total || "—"}</p></div></div><ScoreGrid course={tributeCourse.holes} scores={scores[player.id]} onChange={(hole, value) => updateScore(player.id, hole, value)} />
      <div className="mt-5 grid gap-3 border-t border-[#d9e3dc] pt-5 sm:grid-cols-[1fr_auto]"><label><span className="label">Official card total (review check)</span><input inputMode="numeric" value={official} onChange={(event) => setOfficialTotals((current) => ({ ...current, [player.id]: event.target.value }))} className="field mt-2" placeholder="Enter marked-card total" /></label><div className={`self-end rounded-xl px-4 py-3 text-sm font-semibold ${official && Number(official) !== total ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{official ? Number(official) === total ? "✓ Totals match" : `Review: entered ${total}, card says ${official}` : "Add official total to verify"}</div></div></section>
      <aside className="space-y-4"><div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-200">Live skins</p><div className="mt-4 space-y-2">{skinResults.filter((result) => result.bestNetScore !== undefined).map((result) => <div key={result.holeNumber} className="flex items-center justify-between border-b border-white/10 pb-2 text-sm"><span>Hole {result.holeNumber}</span><span className={result.winnerId ? "font-bold text-emerald-200" : "text-stone-400"}>{result.winnerId ? `${players.find((entry) => entry.id === result.winnerId)?.name} · $${perSkin}` : "Tie — dead hole"}</span></div>)}{!skinResults.some((result) => result.bestNetScore !== undefined) && <p className="text-sm leading-6 text-stone-400">Results appear after cards are entered.</p>}</div></div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-200">Commissioner CTP entry</p><div className="mt-4 space-y-3">{confirmed2026Rules.skinRound.closestToPinHoleNumbers.map((hole) => <label key={hole} className="block text-sm font-semibold">Hole {hole}<select value={closestToPin[hole] ?? ""} onChange={(event) => setClosestToPin((current) => ({ ...current, [hole]: event.target.value }))} className="field mt-1 w-full"><option value="">No winner entered</option>{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>)}</div></div></aside>
    </div></div>;
}

function ScrambleBoard({ teams, players, scores, activeTeamId, setActiveTeamId, updateScore, officialTotals, setOfficialTotals, payouts }: { teams: ReturnType<typeof makeTeams>; players: Player[]; scores: Scores; activeTeamId: string; setActiveTeamId: (id: string) => void; updateScore: (id: string, hole: number, value: string) => void; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; payouts: ReturnType<typeof calculateScramblePayouts> }) {
  const team = teams.find((entry) => entry.id === activeTeamId) ?? teams[0]; const total = sumScores(scores[team.id]); const official = officialTotals[team.id] ?? "";
  return <div className="space-y-6"><SectionTitle eyebrow="The Classic — afternoon round" title="18-hole team scramble" text="Gross team score. First and second payout follows the legacy tie rules; the final card total catches missed holes." />
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><section className="rounded-3xl bg-white p-5 text-[#12332d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="label">Team card</label><select value={team.id} onChange={(event) => setActiveTeamId(event.target.value)} className="field mt-2">{teams.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><p className="mt-2 text-sm text-[#628075]">{team.playerIds.map((id) => players.find((player) => player.id === id)?.name).join(" · ")}</p></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wider text-[#638176]">Team total</p><p className="text-3xl font-black">{total || "—"}</p></div></div><ScoreGrid course={tributeCourse.holes} scores={scores[team.id]} onChange={(hole, value) => updateScore(team.id, hole, value)} />
      <div className="mt-5 grid gap-3 border-t border-[#d9e3dc] pt-5 sm:grid-cols-[1fr_auto]"><label><span className="label">Official card total</span><input inputMode="numeric" value={official} onChange={(event) => setOfficialTotals((current) => ({ ...current, [team.id]: event.target.value }))} className="field mt-2" placeholder="Enter marked-card total" /></label><div className={`self-end rounded-xl px-4 py-3 text-sm font-semibold ${official && Number(official) !== total ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{official ? Number(official) === total ? "✓ Totals match" : `Review: entered ${total}, card says ${official}` : "Add official total to verify"}</div></div></section>
      <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-200">Classic leaderboard</p><div className="mt-4 space-y-3">{teams.map((entry) => { const teamPayout = payouts.find((item) => item.teamId === entry.id); const teamTotal = sumScores(scores[entry.id]); return <div key={entry.id} className="rounded-2xl bg-black/15 p-3"><div className="flex justify-between gap-2 font-semibold"><span>{entry.name}</span><span>{teamTotal || "—"}</span></div><p className="mt-1 text-xs text-stone-400">{teamPayout ? `${teamPayout.place}${teamPayout.place === 1 ? "st" : "nd"} · $${Math.floor(teamPayout.teamPayout)} team payout` : "Awaiting final ranking"}</p></div> })}</div></aside>
    </div></div>;
}

function Setup({ players, setPlayers, teams, setTeams }: { players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; teams: ReturnType<typeof makeTeams>; setTeams: React.Dispatch<React.SetStateAction<ReturnType<typeof makeTeams>>> }) {
  return <div className="space-y-6"><SectionTitle eyebrow="Commissioner workspace" title="Roster, bands & teams" text="This preview saves in the browser while the shared database and scorekeeper permissions are being connected." />
    <section className="rounded-3xl bg-white p-5 text-[#12332d] sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black">Player stroke bands</h3><button onClick={() => { setPlayers(startingRoster); setTeams(makeTeams(startingRoster)); }} className="rounded-full border border-[#9eb8ac] px-4 py-2 text-sm font-semibold hover:bg-[#edf4ef]">Reset preview roster</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => <div key={player.id} className="flex items-center justify-between rounded-2xl bg-[#edf4ef] px-4 py-3"><span className="font-semibold">{player.name}</span><select value={player.tier} onChange={(event) => setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, tier: event.target.value as Player["tier"] } : entry))} className="rounded-lg border border-[#b8d0c3] bg-white px-2 py-1 text-sm font-semibold"><option value="A">A · 0</option><option value="B">B · 6</option><option value="C">C · 12</option><option value="D">D · 18</option></select></div>)}</div></section>
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><h3 className="text-xl font-black">Classic teams</h3><p className="mt-1 text-sm text-stone-400">Team assignment editor becomes drag-and-drop with shared persistence in the next pass.</p><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{teams.map((team) => <div key={team.id} className="rounded-2xl bg-black/15 p-4"><input value={team.name} onChange={(event) => setTeams((current) => current.map((entry) => entry.id === team.id ? { ...entry, name: event.target.value } : entry))} className="w-full bg-transparent font-bold outline-none" /><ul className="mt-3 space-y-1 text-sm text-stone-300">{team.playerIds.map((id) => <li key={id}>• {players.find((player) => player.id === id)?.name}</li>)}</ul></div>)}</div></section>
  </div>;
}

function Desk({ chat, chatInput, setChatInput, answerDesk }: { chat: string[]; chatInput: string; setChatInput: (value: string) => void; answerDesk: () => void }) { return <div className="mx-auto max-w-3xl"><SectionTitle eyebrow="Closed-loop tournament assistant" title="Big Playas Desk" text="The Desk reads only the scoreboard and commissioner-approved context. No web browsing, no made-up personal history." /><section className="mt-6 rounded-3xl bg-white p-5 text-[#12332d] sm:p-7"><div className="space-y-4">{chat.map((line, index) => <p key={`${line}-${index}`} className={`rounded-2xl p-4 text-sm leading-6 ${line.startsWith("Desk:") ? "bg-[#e5f1e9]" : "bg-[#f2eee5]"}`}>{line}</p>)}</div><form onSubmit={(event) => { event.preventDefault(); answerDesk(); }} className="mt-5 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} className="field flex-1" placeholder="Who is leading? What is the skins pot? Give me a roast." /><button className="rounded-xl bg-[#0d3b31] px-5 py-2 font-bold text-white hover:bg-[#175746]">Ask</button></form></section></div>; }

function ScoreGrid({ course, scores, onChange }: { course: typeof tributeCourse.holes; scores: HoleScore[] | undefined; onChange: (hole: number, value: string) => void }) { return <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-9">{course.map((hole) => { const value = scores?.find((item) => item.holeNumber === hole.number)?.strokes ?? ""; return <label key={hole.number} className="rounded-xl border border-[#d6e2da] bg-[#f6faf7] p-3 text-center"><span className="block text-xs font-bold text-[#57776a]">{hole.number} · P{hole.par}</span><input value={value} inputMode="numeric" onChange={(event) => onChange(hole.number, event.target.value)} className="mt-2 w-full bg-transparent text-center text-xl font-black outline-none" placeholder="—" /></label> })}</div>; }
function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <section><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{eyebrow}</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2><p className="mt-3 max-w-2xl leading-7 text-stone-300">{text}</p></section>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-200">{label}</p><p className="mt-2 truncate text-xl font-bold">{value}</p><p className="mt-1 text-xs text-stone-400">{detail}</p></div>; }
function Card({ title, detail, body }: { title: string; detail: string; body: string }) { return <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-5"><p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-200">{detail}</p><h3 className="mt-2 text-2xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-stone-300">{body}</p></article>; }
function sumScores(scores: HoleScore[] | undefined) { return scores?.reduce((sum, score) => sum + score.strokes, 0) ?? 0; }
function updateHoleScore(scores: HoleScore[] | undefined, holeNumber: number, rawValue: string) { const value = Number(rawValue); const rest = (scores ?? []).filter((score) => score.holeNumber !== holeNumber); return Number.isInteger(value) && value > 0 && value < 20 ? [...rest, { holeNumber, strokes: value }].sort((a, b) => a.holeNumber - b.holeNumber) : rest; }
function teamName(teams: ReturnType<typeof makeTeams>, teamId: string) { return teams.find((team) => team.id === teamId)?.name ?? "Unknown team"; }
function skinLeader(players: Player[], results: ReturnType<typeof calculateSkins>) { const wins = new Map<string, number>(); results.forEach((result) => result.winnerId && wins.set(result.winnerId, (wins.get(result.winnerId) ?? 0) + 1)); const winner = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; return players.find((player) => player.id === winner); }
