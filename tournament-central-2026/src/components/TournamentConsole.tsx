"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { LorePhoto, LoreStrip } from "@/components/ClubLore";
import { TournamentStory } from "@/components/TournamentStory";
import type { AccessRole } from "@/lib/access";
import { confirmed2026Rules } from "@/lib/tournament/config";
import { calculateScramblePayouts, calculateSkins, payoutPerSkin, skinRoundPot } from "@/lib/tournament/rules";
import { classicCourse, startingRoster, tributeCourse } from "@/lib/tournament/seed";
import type { RoundKey, RoundPosting, Scores, ScrambleDay, SkinDay, Team, TournamentState } from "@/lib/tournament/state";
import type { HoleScore, Player } from "@/lib/tournament/types";

type Tab = "story" | "central" | "skins" | "scramble" | "setup" | "desk" | "archive";

const skinDays: SkinDay[] = ["thursday", "friday", "saturday"];
const scrambleDays: ScrambleDay[] = ["friday", "saturday"];
const scorekeeperDraftKey = "ecbp-2026-scorekeeper-draft-v4";
const legacyDraftKey = "ecbp-2026-preview-v3";
const choicesPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/16/41/571641f5-9ed5-5829-d974-37c940f11d63/mzaf_2253382345250106604.plus.aac.p.m4a";
const musicVolume = 0.09;

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "story", label: "The story" },
  { id: "central", label: "Standings" },
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

function emptyTournamentState(): TournamentState {
  return {
    players: startingRoster,
    skinScores: {},
    skinOfficialTotals: {},
    closestToPin: {},
    teamsByDay: { friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) },
    scrambleScores: {},
    scrambleOfficialTotals: {},
    postings: {},
  };
}

const cardKey = (day: string, id: string | number) => `${day}:${id}`;

export function TournamentConsole() {
  const [tab, setTab] = useState<Tab>("story");
  const [players, setPlayers] = useState(startingRoster);
  const [skinScores, setSkinScores] = useState<Scores>({});
  const [skinOfficialTotals, setSkinOfficialTotals] = useState<Record<string, string>>({});
  const [closestToPin, setClosestToPin] = useState<Record<string, string>>({});
  const [teamsByDay, setTeamsByDay] = useState<Record<ScrambleDay, Team[]>>(() => ({ friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) }));
  const [scrambleScores, setScrambleScores] = useState<Scores>({});
  const [scrambleOfficialTotals, setScrambleOfficialTotals] = useState<Record<string, string>>({});
  const [postings, setPostings] = useState<Partial<Record<RoundKey, RoundPosting>>>({});
  const [activePlayerId, setActivePlayerId] = useState(startingRoster[0].id);
  const [activeTeamId, setActiveTeamId] = useState("team-1");
  const [activeSkinDay, setActiveSkinDay] = useState<SkinDay>("thursday");
  const [activeScrambleDay, setActiveScrambleDay] = useState<ScrambleDay>("friday");
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<string[]>(["Ask the Desk about scores, payouts, the format, or an approved roast."]);
  const [hydrated, setHydrated] = useState(false);
  const [accessRole, setAccessRole] = useState<AccessRole | "loading" | null>("loading");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [syncState, setSyncState] = useState<"local" | "saving" | "synced" | "error">("local");
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicFadeRef = useRef<number | null>(null);
  const teams = teamsByDay[activeScrambleDay];
  const setTeams: React.Dispatch<React.SetStateAction<Team[]>> = (value) => setTeamsByDay((current) => ({ ...current, [activeScrambleDay]: typeof value === "function" ? value(current[activeScrambleDay]) : value }));

  useEffect(() => {
    fetch("/api/access", { cache: "no-store" }).then((response) => response.json()).then((data: { role: AccessRole | null }) => setAccessRole(data.role)).catch(() => setAccessRole(null));
  }, []);

  useEffect(() => {
    const music = new Audio(choicesPreviewUrl);
    music.loop = true;
    music.preload = "auto";
    music.volume = 0;
    const syncPlaybackState = () => setMusicPlaying(!music.paused);
    music.addEventListener("play", syncPlaybackState);
    music.addEventListener("pause", syncPlaybackState);
    musicRef.current = music;
    return () => {
      if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
      music.removeEventListener("play", syncPlaybackState);
      music.removeEventListener("pause", syncPlaybackState);
      music.pause();
      musicRef.current = null;
    };
  }, []);

  const fadeMusicTo = useCallback((target: number, pauseWhenSilent = false) => {
    const music = musicRef.current;
    if (!music) return;
    if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
    musicFadeRef.current = window.setInterval(() => {
      const delta = target - music.volume;
      if (Math.abs(delta) <= 0.012) {
        music.volume = target;
        if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
        musicFadeRef.current = null;
        if (pauseWhenSilent && target === 0) music.pause();
        return;
      }
      music.volume = Math.max(0, Math.min(1, music.volume + Math.sign(delta) * 0.012));
    }, 70);
  }, []);

  const startMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    void music.play().then(() => fadeMusicTo(musicVolume)).catch(() => setMusicPlaying(false));
  }, [fadeMusicTo]);

  const stopMusic = useCallback(() => fadeMusicTo(0, true), [fadeMusicTo]);

  const toggleMusic = useCallback(() => {
    if (musicRef.current?.paused) startMusic();
    else stopMusic();
  }, [startMusic, stopMusic]);

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
      if (!state && accessRole === "scorekeeper") {
        const saved = window.localStorage.getItem(scorekeeperDraftKey) ?? window.localStorage.getItem(legacyDraftKey);
        if (saved) try { state = JSON.parse(saved) as TournamentState; } catch { /* Use the official seed. */ }
      }
      if (cancelled) return;
      applyTournamentState(state ?? emptyTournamentState(), { setPlayers, setSkinScores, setClosestToPin, setTeamsByDay, setScrambleScores, setSkinOfficialTotals, setScrambleOfficialTotals, setPostings });
      setHydrated(true);
    };
    load();
    return () => { cancelled = true; };
  }, [accessRole]);

  useEffect(() => {
    if (!hydrated || accessRole !== "scorekeeper") return;
    const state = { players, skinScores, closestToPin, teamsByDay, scrambleScores, skinOfficialTotals, scrambleOfficialTotals, postings } satisfies TournamentState;
    window.localStorage.setItem(scorekeeperDraftKey, JSON.stringify(state));
    const timeout = window.setTimeout(async () => {
      setSyncState("saving");
      try {
        const response = await fetch("/api/tournament-state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
        if (!response.ok) throw new Error("Shared save failed");
        setSyncState("synced");
      } catch { setSyncState("error"); }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [hydrated, accessRole, players, skinScores, closestToPin, teamsByDay, scrambleScores, skinOfficialTotals, scrambleOfficialTotals, postings]);

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
  const activeSkinRoundKey: RoundKey = `skins-${activeSkinDay}`;
  const activeScrambleRoundKey: RoundKey = `scramble-${activeScrambleDay}`;
  const skinIsPosted = postings[activeSkinRoundKey]?.status === "posted";
  const scrambleIsPosted = postings[activeScrambleRoundKey]?.status === "posted";
  const skinCardsReady = players.every((player) => {
    const key = cardKey(activeSkinDay, player.id);
    const card = skinScores[key];
    return card?.length === 18 && Boolean(skinOfficialTotals[key]) && Number(skinOfficialTotals[key]) === sumScores(card);
  });
  const skinCtpReady = confirmed2026Rules.skinRound.closestToPinHoleNumbers.every((hole) => Boolean(closestToPin[cardKey(activeSkinDay, hole)]));
  const scrambleCardsReady = teams.every((team) => {
    const key = cardKey(activeScrambleDay, team.id);
    const card = scrambleScores[key];
    return card?.length === 18 && Boolean(scrambleOfficialTotals[key]) && Number(scrambleOfficialTotals[key]) === sumScores(card);
  });

  const publishRound = (key: RoundKey) => setPostings((current) => ({
    ...current,
    [key]: { status: "posted", postedAt: new Date().toISOString(), revision: (current[key]?.revision ?? 0) + 1 },
  }));
  const returnRoundToReview = (key: RoundKey) => setPostings((current) => ({
    ...current,
    [key]: { ...current[key], status: "review", revision: current[key]?.revision ?? 0 },
  }));

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
    let answer = "Try standings, skins, CTP, scramble, payout, or an approved roast.";
    if (lower.includes("skin")) answer = `${skinWins} outright skin${skinWins === 1 ? "" : "s"} on the selected board. The skins pot is $${skinPot.skinsTotal}, with $${perSkin} per winning skin.`;
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
    const music = musicRef.current;
    if (music) {
      music.volume = 0;
      void music.play().catch(() => setMusicPlaying(false));
    }
    const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: accessCode }) });
    const data = await response.json() as { role?: AccessRole; error?: string };
    if (!response.ok || !data.role) {
      music?.pause();
      if (music) music.currentTime = 0;
      setAccessError(data.error ?? "That passcode did not work.");
      return;
    }
    fadeMusicTo(musicVolume);
    setHydrated(false);
    setAccessRole(data.role);
    setAccessCode("");
  };

  const leaveClubhouse = async () => {
    stopMusic();
    await fetch("/api/access", { method: "DELETE" });
    setAccessRole(null);
    setTab("story");
  };

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 0);
  };

  if (accessRole === "loading") return <ClubhouseLoading />;
  if (!accessRole) return <AccessGate code={accessCode} setCode={setAccessCode} error={accessError} enter={enterClubhouse} />;
  const canEdit = accessRole === "scorekeeper";
  const visibleTabs = canEdit ? tabs : tabs.filter((item) => item.id !== "setup");

  if (tab === "story") return <TournamentStory musicPlaying={musicPlaying} onToggleMusic={toggleMusic} onOpenResults={() => switchTab("central")} onExit={leaveClubhouse} />;

  return (
    <main className="club-site min-h-screen text-stone-100">
      <header className="club-masthead">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="club-brand">
              <BrandLogo className="club-brand-logo" priority sizes="74px" />
              <div>
                <p className="club-kicker">Otsego Club · Gaylord, Michigan</p>
                <h1 className="club-title mt-1">East Coast Big Playas Invitational</h1>
              </div>
            </div>
            <div className="flex items-center gap-2"><button type="button" onClick={toggleMusic} className={`club-badge club-music ${musicPlaying ? "is-playing" : ""}`} aria-label={`${musicPlaying ? "Pause" : "Play"} Choices by E-40`}><span aria-hidden="true">♪</span> Choices</button><button type="button" onClick={() => window.location.reload()} className="club-badge">{canEdit ? syncState === "saving" ? "Saving…" : syncState === "error" ? "Save needs attention" : "Scorekeeper · Shared" : "Refresh standings"}</button><button type="button" onClick={leaveClubhouse} className="club-badge">Exit</button></div>
          </div>
          <nav className="club-nav mt-5 flex overflow-x-auto" aria-label="Tournament areas">
            {visibleTabs.map((item) => <button key={item.id} onClick={() => switchTab(item.id)} className={`club-tab whitespace-nowrap ${tab === item.id ? "club-tab-active" : ""}`}>{item.label}</button>)}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {tab === "central" && <Central players={players} skinPot={skinPot} skinWins={skinWins} perSkin={perSkin} skinResults={skinResults} closestToPin={activeClosestToPin} scrambleResults={scrambleResults} scramblePayouts={scramblePayouts} teams={teams} activeSkinDay={activeSkinDay} setActiveSkinDay={setActiveSkinDay} activeScrambleDay={activeScrambleDay} setActiveScrambleDay={setActiveScrambleDay} skinIsPosted={skinIsPosted} scrambleIsPosted={scrambleIsPosted} />}
        {tab === "skins" && (canEdit || skinIsPosted ? <SkinsBoard canEdit={canEdit} activeDay={activeSkinDay} setActiveDay={setActiveSkinDay} players={players} scores={skinScores} activePlayerId={activePlayerId} setActivePlayerId={setActivePlayerId} updateScore={updateSkinScore} officialTotals={skinOfficialTotals} setOfficialTotals={setSkinOfficialTotals} closestToPin={closestToPin} setClosestToPin={setClosestToPin} skinResults={skinResults} perSkin={perSkin} posting={postings[activeSkinRoundKey]} canPublish={skinCardsReady && skinCtpReady} publish={() => publishRound(activeSkinRoundKey)} returnToReview={() => returnRoundToReview(activeSkinRoundKey)} /> : <AwaitingBoard course="The Tribute" day={activeSkinDay} days={skinDays} onDayChange={setActiveSkinDay} />)}
        {tab === "scramble" && (canEdit || scrambleIsPosted ? <ScrambleBoard canEdit={canEdit} activeDay={activeScrambleDay} setActiveDay={setActiveScrambleDay} teams={teams} players={players} scores={scrambleScores} activeTeamId={activeTeamId} setActiveTeamId={setActiveTeamId} updateScore={updateScrambleScore} officialTotals={scrambleOfficialTotals} setOfficialTotals={setScrambleOfficialTotals} payouts={scramblePayouts} posting={postings[activeScrambleRoundKey]} canPublish={scrambleCardsReady} publish={() => publishRound(activeScrambleRoundKey)} returnToReview={() => returnRoundToReview(activeScrambleRoundKey)} /> : <AwaitingBoard course="The Classic" day={activeScrambleDay} days={scrambleDays} onDayChange={setActiveScrambleDay} />)}
        {tab === "setup" && canEdit && <Setup activeDay={activeScrambleDay} setActiveDay={setActiveScrambleDay} players={players} setPlayers={setPlayers} teams={teams} setTeams={setTeams} resetAllTeams={() => setTeamsByDay({ friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) })} />}
        {tab === "desk" && <Desk chat={chat} chatInput={chatInput} setChatInput={setChatInput} answerDesk={answerDesk} />}
        {tab === "archive" && <Archive />}
      </div>
    </main>
  );
}

function ClubhouseLoading() {
  return <main className="story-loading grid min-h-screen place-items-center px-5 text-center"><BrandLogo className="story-loading-logo" priority sizes="144px" /><div><p className="story-eyebrow">Otsego Club · 2026</p><p className="club-display mt-3 text-4xl">Opening the grounds…</p></div></main>;
}

function AccessGate({ code, setCode, error, enter }: { code: string; setCode: (value: string) => void; error: string; enter: () => void }) {
  return <main className="story-gate min-h-screen"><div className="story-gate-photo" aria-hidden="true" /><div className="story-gate-shade" /><section className="story-gate-card"><BrandLogo className="story-gate-logo" priority sizes="128px" /><p className="story-eyebrow">Otsego Club · Gaylord, Michigan</p><h1>Welcome to<br /><em>the inner circle.</em></h1><p className="story-gate-deck">The official 2026 proceedings of the East Coast Big Playas.</p><form onSubmit={(event) => { event.preventDefault(); enter(); }}><label htmlFor="clubhouse-code">Clubhouse passcode</label><div><input id="clubhouse-code" autoComplete="current-password" autoFocus type="password" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter passcode" /><button>Enter</button></div>{error && <p role="alert" className="story-gate-error">{error}</p>}</form></section><p className="story-gate-foot">Private tournament ledger · Est. under disputed circumstances</p></main>;
}

function Central({ players, skinPot, skinWins, perSkin, skinResults, closestToPin, scrambleResults, scramblePayouts, teams, activeSkinDay, setActiveSkinDay, activeScrambleDay, setActiveScrambleDay, skinIsPosted, scrambleIsPosted }: { players: Player[]; skinPot: ReturnType<typeof skinRoundPot>; skinWins: number; perSkin: number; skinResults: ReturnType<typeof calculateSkins>; closestToPin: Record<number, string>; scrambleResults: Array<{ teamId: string; total: number }>; scramblePayouts: ReturnType<typeof calculateScramblePayouts>; teams: ReturnType<typeof makeTeams>; activeSkinDay: SkinDay; setActiveSkinDay: (day: SkinDay) => void; activeScrambleDay: ScrambleDay; setActiveScrambleDay: (day: ScrambleDay) => void; skinIsPosted: boolean; scrambleIsPosted: boolean }) {
  const scrambleLeader = [...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total)[0];
  const skinStandings = players.map((player) => ({ player, wins: skinResults.filter((result) => result.winnerId === player.id).length })).filter((entry) => entry.wins > 0).sort((a, b) => b.wins - a.wins || a.player.name.localeCompare(b.player.name));
  return <div className="space-y-8">
    <section className="club-filter-bar flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3"><div><span className="club-ledger-label mr-3">Tribute board</span><DayPicker days={skinDays} activeDay={activeSkinDay} onChange={setActiveSkinDay} compact /></div><div><span className="club-ledger-label mr-3">Classic board</span><DayPicker days={scrambleDays} activeDay={activeScrambleDay} onChange={setActiveScrambleDay} compact /></div></section>
    <section className="club-hero grid gap-5 p-7 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
      <BrandLogo className="club-hero-logo" decorative sizes="170px" />
      <div><p className="club-kicker">Tournament standings</p><h2 className="club-display mt-4 text-4xl sm:text-6xl">The 2026<br />score ledger.</h2></div>
      <div className="grid grid-cols-2 gap-3 self-end"><Stat label="Players" value={String(players.length)} detail="" /><Stat label="Skins" value={skinIsPosted ? String(skinWins) : "—"} detail={skinIsPosted && skinWins ? `$${perSkin} per skin` : ""} /><Stat label="CTP winners" value={skinIsPosted ? `${Object.keys(closestToPin).length}/4` : "—"} detail={skinIsPosted ? "$20 each" : ""} /><Stat label="Classic leader" value={scrambleIsPosted && scrambleLeader ? teamName(teams, scrambleLeader.teamId) : "—"} detail={scrambleIsPosted && scrambleLeader ? `${scrambleLeader.total} total` : ""} /></div>
    </section>
    <LoreStrip />
    <section className="club-ledger p-6 text-[#12332d]"><p className="club-ledger-label">The day&apos;s purse</p><div className="mt-5 grid gap-6 sm:grid-cols-3"><div><p className="club-ledger-total">${skinPot.total}</p><p className="mt-1 text-sm text-[#557269]">${20} × {players.length} players</p></div><div><p className="club-ledger-total">${skinPot.closestToPinTotal}</p><p className="mt-1 text-sm text-[#557269]">four $20 closest-to-pin prizes</p></div><div><p className="club-ledger-total">${skinPot.skinsTotal}</p><p className="mt-1 text-sm text-[#557269]">split across outright skin winners</p></div></div></section>
    <section className="grid gap-4 lg:grid-cols-2"><div className="club-card p-5"><p className="club-kicker">{capitalize(activeSkinDay)} · The Tribute</p><h3 className="club-card-title mt-1">Skins standings & payouts</h3>{skinIsPosted ? <><div className="mt-4">{skinStandings.length ? skinStandings.map((entry, index) => <div key={entry.player.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-[#bca062]/30 py-2 text-sm"><span className="text-[#d6ba73]">{index + 1}</span><span className="font-semibold">{entry.player.name}</span><span>{entry.wins} skin{entry.wins === 1 ? "" : "s"}</span><span className="font-bold text-[#ead292]">${entry.wins * perSkin}</span></div>) : <p className="mt-3 text-sm text-stone-400">No outright skins.</p>}</div><div className="mt-5"><p className="club-kicker">Closest to pin · $20 each</p>{Object.entries(closestToPin).length ? Object.entries(closestToPin).map(([hole, playerId]) => <p key={hole} className="mt-2 text-sm">Hole {hole} · <span className="font-semibold text-[#ead292]">{players.find((player) => player.id === playerId)?.name ?? "Winner pending"}</span></p>) : <p className="mt-2 text-sm text-stone-400">No winners yet.</p>}</div></> : <BoardClosed />}</div><div className="club-card p-5"><p className="club-kicker">{capitalize(activeScrambleDay)} · The Classic</p><h3 className="club-card-title mt-1">Team standings & payouts</h3>{scrambleIsPosted ? <div className="mt-4">{[...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total).map((entry, index) => { const payout = scramblePayouts.find((item) => item.teamId === entry.teamId); return <div key={entry.teamId} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-[#bca062]/30 py-2 text-sm"><span className="text-[#d6ba73]">{index + 1}</span><span className="font-semibold">{teamName(teams, entry.teamId)}</span><span>{entry.total}</span><span className="font-bold text-[#ead292]">{payout ? `$${Math.floor(payout.teamPayout)}` : "—"}</span></div>})}</div> : <BoardClosed />}</div></section>
  </div>;
}

function SkinsBoard({ canEdit, activeDay, setActiveDay, players, scores, activePlayerId, setActivePlayerId, updateScore, officialTotals, setOfficialTotals, closestToPin, setClosestToPin, skinResults, perSkin, posting, canPublish, publish, returnToReview }: { canEdit: boolean; activeDay: SkinDay; setActiveDay: (day: SkinDay) => void; players: Player[]; scores: Scores; activePlayerId: string; setActivePlayerId: (id: string) => void; updateScore: (id: string, hole: number, value: string) => void; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; closestToPin: Record<string, string>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<string, string>>>; skinResults: ReturnType<typeof calculateSkins>; perSkin: number; posting?: RoundPosting; canPublish: boolean; publish: () => void; returnToReview: () => void }) {
  const player = players.find((entry) => entry.id === activePlayerId) ?? players[0];
  const playerKey = cardKey(activeDay, player.id);
  const total = sumScores(scores[playerKey]);
  const official = officialTotals[playerKey] ?? "";
  const enteredHoles = scores[playerKey]?.length ?? 0;
  return <div className="space-y-6"><SectionTitle eyebrow="The Tribute — morning round" title="Skins & closest to pin" text="" />
    <DayPicker days={skinDays} activeDay={activeDay} onChange={setActiveDay} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="scorecard-sheet p-5 text-[#12332d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="label">Scorecard player</label><select value={player.id} onChange={(event) => setActivePlayerId(event.target.value)} className="field mt-2">{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.tier} tier</option>)}</select></div><div className="text-right"><p className="club-ledger-label">Gross total</p><p className="club-ledger-total">{total || "—"}</p></div></div><ScoreGrid disabled={!canEdit} showHandicap course={tributeCourse.holes} scores={scores[playerKey]} onChange={(hole, value) => updateScore(player.id, hole, value)} />
      <div className="scorecard-check mt-5 grid gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]"><label><span className="label block">Official card total (review check)</span><input disabled={!canEdit} inputMode="numeric" value={official} onChange={(event) => setOfficialTotals((current) => ({ ...current, [playerKey]: event.target.value }))} className="field mt-2 block w-full disabled:opacity-70" placeholder="Enter marked-card total" /></label><div className={`self-end border px-4 py-3 text-sm font-semibold ${official && (enteredHoles !== 18 || Number(official) !== total) ? "border-rose-400 bg-rose-100 text-rose-800" : "border-emerald-500/40 bg-emerald-100 text-emerald-800"}`}>{enteredHoles !== 18 ? `${18 - enteredHoles} holes still missing` : official ? Number(official) === total ? "✓ Totals match" : `Review: entered ${total}, card says ${official}` : "Add official total to verify"}</div></div></section>
      <aside className="space-y-4">{canEdit && <PublicationPanel posting={posting} ready={canPublish} incompleteText="Every player card and official total must match, and all four CTP winners must be entered." publish={publish} returnToReview={returnToReview} />}<div className="club-card p-5"><p className="club-kicker">Committee preview</p><div className="mt-4 space-y-2">{skinResults.filter((result) => result.isComplete).map((result) => <div key={result.holeNumber} className="flex items-center justify-between border-b border-[#bca062]/30 pb-2 text-sm"><span>Hole {result.holeNumber}</span><span className={result.winnerId ? "font-bold text-[#ead292]" : "text-stone-400"}>{result.winnerId ? `${players.find((entry) => entry.id === result.winnerId)?.name} · $${perSkin}` : "Tie — dead hole"}</span></div>)}{!skinResults.some((result) => result.isComplete) && <p className="text-sm leading-6 text-stone-400">A hole is decided only after all {players.length} cards contain that score.</p>}</div></div>
        <div className="club-card p-5"><p className="club-kicker">Closest to pin</p><div className="mt-4 space-y-3">{confirmed2026Rules.skinRound.closestToPinHoleNumbers.map((hole) => { const ctpKey = cardKey(activeDay, hole); return <label key={hole} className="block text-sm font-semibold">Hole {hole}<select disabled={!canEdit} value={closestToPin[ctpKey] ?? ""} onChange={(event) => setClosestToPin((current) => ({ ...current, [ctpKey]: event.target.value }))} className="field mt-1 w-full disabled:opacity-70"><option value="">No winner entered</option>{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>})}</div></div><LorePhoto index={7} label="Pace-of-play enforcement" className="lore-photo-wide" /></aside>
    </div></div>;
}

function ScrambleBoard({ canEdit, activeDay, setActiveDay, teams, players, scores, activeTeamId, setActiveTeamId, updateScore, officialTotals, setOfficialTotals, payouts, posting, canPublish, publish, returnToReview }: { canEdit: boolean; activeDay: ScrambleDay; setActiveDay: (day: ScrambleDay) => void; teams: ReturnType<typeof makeTeams>; players: Player[]; scores: Scores; activeTeamId: string; setActiveTeamId: (id: string) => void; updateScore: (id: string, hole: number, value: string) => void; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; payouts: ReturnType<typeof calculateScramblePayouts>; posting?: RoundPosting; canPublish: boolean; publish: () => void; returnToReview: () => void }) {
  const team = teams.find((entry) => entry.id === activeTeamId) ?? teams[0]; const teamKey = cardKey(activeDay, team.id); const total = sumScores(scores[teamKey]); const official = officialTotals[teamKey] ?? ""; const enteredHoles = scores[teamKey]?.length ?? 0;
  return <div className="space-y-6"><SectionTitle eyebrow="The Classic — afternoon round" title="18-hole team scramble" text="" />
    <DayPicker days={scrambleDays} activeDay={activeDay} onChange={setActiveDay} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="scorecard-sheet p-5 text-[#12332d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="label">Team card</label><select value={team.id} onChange={(event) => setActiveTeamId(event.target.value)} className="field mt-2">{teams.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><p className="mt-2 text-sm text-[#628075]">{team.playerIds.map((id) => players.find((player) => player.id === id)?.name).join(" · ")}</p></div><div className="text-right"><p className="club-ledger-label">Team total</p><p className="club-ledger-total">{total || "—"}</p></div></div><ScoreGrid disabled={!canEdit} course={classicCourse.holes} scores={scores[teamKey]} onChange={(hole, value) => updateScore(team.id, hole, value)} />
      <div className="scorecard-check mt-5 grid gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]"><label><span className="label block">Official card total</span><input disabled={!canEdit} inputMode="numeric" value={official} onChange={(event) => setOfficialTotals((current) => ({ ...current, [teamKey]: event.target.value }))} className="field mt-2 block w-full disabled:opacity-70" placeholder="Enter marked-card total" /></label><div className={`self-end border px-4 py-3 text-sm font-semibold ${official && (enteredHoles !== 18 || Number(official) !== total) ? "border-rose-400 bg-rose-100 text-rose-800" : "border-emerald-500/40 bg-emerald-100 text-emerald-800"}`}>{enteredHoles !== 18 ? `${18 - enteredHoles} holes still missing` : official ? Number(official) === total ? "✓ Totals match" : `Review: entered ${total}, card says ${official}` : "Add official total to verify"}</div></div></section>
      <aside className="space-y-4">{canEdit && <PublicationPanel posting={posting} ready={canPublish} incompleteText="All six team cards and official totals must be complete and matching." publish={publish} returnToReview={returnToReview} />}<div className="club-card p-5"><p className="club-kicker">Committee preview</p><div className="mt-4 space-y-3">{teams.map((entry) => { const teamPayout = payouts.find((item) => item.teamId === entry.id); const teamTotal = sumScores(scores[cardKey(activeDay, entry.id)]); return <div key={entry.id} className="border-b border-[#bca062]/35 p-3"><div className="flex justify-between gap-2 font-semibold"><span>{entry.name}</span><span>{teamTotal || "—"}</span></div><p className="mt-1 text-xs text-stone-400">{teamPayout ? `${teamPayout.place}${teamPayout.place === 1 ? "st" : "nd"} · $${Math.floor(teamPayout.teamPayout)} team payout` : "Awaiting final ranking"}</p></div> })}</div></div><LorePhoto index={15} label="Putting laboratory · confidential" className="lore-photo-wide" /></aside>
    </div></div>;
}

function PublicationPanel({ posting, ready, incompleteText, publish, returnToReview }: { posting?: RoundPosting; ready: boolean; incompleteText: string; publish: () => void; returnToReview: () => void }) {
  const isPosted = posting?.status === "posted";
  return <section className={`publication-panel p-5 ${isPosted ? "is-posted" : ""}`}>
    <p className="club-kicker">Public board control</p>
    <h3 className="club-card-title mt-2">{isPosted ? "Results posted" : "Committee review"}</h3>
    <p className="mt-3 text-sm leading-6 text-stone-300">{isPosted ? `Revision ${posting.revision} is public${posting.postedAt ? ` · ${new Date(posting.postedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}.` : ready ? "Every required card is complete and reconciled. This round is ready to post." : incompleteText}</p>
    <div className="mt-4 grid gap-2">
      <button type="button" disabled={!ready} onClick={publish} className="publication-primary">{isPosted ? "Post corrected revision" : "Post official results"}</button>
      {isPosted && <button type="button" onClick={returnToReview} className="publication-secondary">Return board to review</button>}
    </div>
  </section>;
}

function AwaitingBoard<T extends string>({ course, day, days, onDayChange }: { course: string; day: T; days: readonly T[]; onDayChange: (day: T) => void }) {
  return <div className="space-y-6"><SectionTitle eyebrow={`${capitalize(day)} · ${course}`} title="No scores yet." text="" /><DayPicker days={days} activeDay={day} onChange={onDayChange} /><section className="club-hero board-awaiting p-8 text-center sm:p-12"><h3 className="club-display text-3xl sm:text-5xl">Still counting.</h3></section></div>;
}

function BoardClosed() {
  return <div className="board-closed mt-5"><span aria-hidden="true">19</span><div><strong>No scores yet.</strong></div></div>;
}

function Setup({ activeDay, setActiveDay, players, setPlayers, teams, setTeams, resetAllTeams }: { activeDay: ScrambleDay; setActiveDay: (day: ScrambleDay) => void; players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; teams: Team[]; setTeams: React.Dispatch<React.SetStateAction<Team[]>>; resetAllTeams: () => void }) {
  return <div className="space-y-6"><SectionTitle eyebrow="Commissioner workspace" title="Roster, bands & teams" text="Roster changes, stroke bands and team assignments save to the shared tournament board for every authorized scorekeeper." />
    <section className="club-ledger p-5 text-[#12332d] sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="club-ledger-label">Official field</p><h3 className="club-card-title !text-[#173f35]">Player stroke bands</h3></div><button onClick={() => { setPlayers(startingRoster); resetAllTeams(); }} className="border border-[#8d794f] px-4 py-2 text-sm font-semibold hover:bg-[#ded1b4]">Reset roster & both days</button></div><div className="mb-5 grid grid-cols-4 border border-[#a99670] bg-[#f8f2e5]">{(["A", "B", "C", "D"] as const).map((tier) => <div key={tier} className="border-r border-[#a99670] p-3 text-center last:border-r-0"><p className="font-serif text-xl font-bold">{tier}</p><p className="text-xs text-[#61766d]">{players.filter((player) => player.tier === tier).length} players · {confirmed2026Rules.skinRound.tierStrokes[tier]} strokes</p></div>)}</div><div className="grid gap-px border border-[#a99670] bg-[#a99670] sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => <div key={player.id} className="flex items-center justify-between bg-[#f8f2e5] px-4 py-3"><span className="font-semibold">{player.name}</span><select aria-label={`${player.name} stroke band`} value={player.tier} onChange={(event) => setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, tier: event.target.value as Player["tier"] } : entry))} className="field !min-h-0 !py-1 text-sm font-semibold"><option value="A">A · 0</option><option value="B">B · 6</option><option value="C">C · 12</option><option value="D">D · 18</option></select></div>)}</div></section>
    <section className="club-card p-5 sm:p-7"><p className="club-kicker">The Classic pairings</p><h3 className="club-card-title mt-1">{capitalize(activeDay)} · six teams of four</h3><p className="mt-2 text-sm text-stone-300">Friday and Saturday are separate. Rename teams or swap any player below; selecting someone already assigned automatically swaps the two positions.</p><div className="mt-4"><DayPicker days={scrambleDays} activeDay={activeDay} onChange={setActiveDay} /></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teams.map((team) => <div key={team.id} className="border border-[#bca062]/55 bg-black/15 p-4"><input aria-label={`${team.name} name`} value={team.name} onChange={(event) => setTeams((current) => current.map((entry) => entry.id === team.id ? { ...entry, name: event.target.value } : entry))} className="w-full border-b border-[#bca062]/45 bg-transparent pb-2 font-serif text-lg font-bold text-[#f1e6ce] outline-none" /> <div className="mt-3 space-y-2">{team.playerIds.map((id, slotIndex) => <select aria-label={`${team.name} player ${slotIndex + 1}`} key={`${team.id}-${slotIndex}`} value={id} onChange={(event) => setTeams((current) => swapTeamPlayer(current, team.id, slotIndex, event.target.value))} className="field w-full text-sm">{players.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.tier}</option>)}</select>)}</div></div>)}</div></section><div className="lore-inline-row"><LorePhoto index={1} label="Player identification department" /><LorePhoto index={4} label="Pairings committee in session" /></div>
  </div>;
}

function Desk({ chat, chatInput, setChatInput, answerDesk }: { chat: string[]; chatInput: string; setChatInput: (value: string) => void; answerDesk: () => void }) { return <div className="mx-auto max-w-4xl"><SectionTitle eyebrow="Closed-loop tournament assistant" title="Big Playas Desk" text="The Desk reads only the scoreboard and commissioner-approved context. No web browsing, no made-up personal history." /><div className="mt-6 grid gap-5 lg:grid-cols-[1fr_220px]"><section className="rounded-3xl bg-white p-5 text-[#12332d] sm:p-7"><div className="space-y-4">{chat.map((line, index) => <p key={`${line}-${index}`} className={`rounded-2xl p-4 text-sm leading-6 ${line.startsWith("Desk:") ? "bg-[#e5f1e9]" : "bg-[#f2eee5]"}`}>{line}</p>)}</div><form onSubmit={(event) => { event.preventDefault(); answerDesk(); }} className="mt-5 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} className="field flex-1" placeholder="Who is leading? What is the skins pot? Give me a roast." /><button className="rounded-xl bg-[#0d3b31] px-5 py-2 font-bold text-white hover:bg-[#175746]">Ask</button></form></section><LorePhoto index={18} label="Desk attendant · on duty" className="lore-photo-tall" /></div></div>; }

function Archive() { return <div className="mx-auto max-w-4xl"><SectionTitle eyebrow="The club record book" title="2025 Tournament Archive" text="Last year remains preserved as a separate read-only site, exactly where it belongs: available for the stories, safely away from this year’s official ledger." /><section className="club-hero mt-7 grid gap-7 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="club-kicker">Previous championship</p><h3 className="club-display mt-3 text-3xl sm:text-4xl">Take a look back<br />at the 2025 board.</h3><p className="mt-4 max-w-xl leading-7 text-[#e8ddc2]">The archived site cannot alter 2026 scores. Its checked-in tournament snapshot is preserved while any missing historical details can be restored later from the original screenshots.</p></div><a href="https://tournament-archive-2025.vercel.app" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center border border-[#d6ba73] bg-[#e5d0a0] px-6 py-3 font-serif font-bold text-[#173f35] hover:bg-[#f0deb2]">Open the 2025 Archive ↗</a></section><div className="lore-inline-row mt-6"><LorePhoto index={17} label="Assistant club historian" /><LorePhoto index={19} label="Recovery room records" /></div></div>; }

function DayPicker<T extends string>({ days, activeDay, onChange, compact = false }: { days: readonly T[]; activeDay: T; onChange: (day: T) => void; compact?: boolean }) { return <div className={`day-picker ${compact ? "inline-flex" : "flex w-fit"}`} role="group" aria-label="Select tournament day">{days.map((day) => <button key={day} type="button" aria-pressed={activeDay === day} onClick={() => onChange(day)} className={`day-picker-button ${activeDay === day ? "day-picker-active" : ""}`}>{capitalize(day)}</button>)}</div>; }
function ScoreGrid({ course, scores, onChange, disabled = false, showHandicap = false }: { course: typeof tributeCourse.holes; scores: HoleScore[] | undefined; onChange: (hole: number, value: string) => void; disabled?: boolean; showHandicap?: boolean }) { return <div className="score-grid mt-7 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9">{course.map((hole) => { const value = scores?.find((item) => item.holeNumber === hole.number)?.strokes ?? ""; return <label key={hole.number} className="score-cell text-center"><span className="block text-[11px] font-bold uppercase tracking-wider text-[#57776a]">Hole {hole.number}</span><span className="mt-1 block text-[10px] text-[#789087]">Par {hole.par}{showHandicap ? ` · HCP ${hole.strokeIndex}` : ""}</span><input disabled={disabled} aria-label={`Hole ${hole.number} score`} value={value} inputMode="numeric" onChange={(event) => onChange(hole.number, event.target.value)} className="mt-1 w-full bg-transparent text-center font-serif text-2xl font-bold outline-none disabled:cursor-default" placeholder="—" /></label> })}</div>; }
function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <section><p className="club-kicker">{eyebrow}</p><h2 className="club-display mt-2 text-3xl sm:text-4xl">{title}</h2>{text && <p className="mt-3 max-w-2xl leading-7 text-stone-300">{text}</p>}</section>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="club-stat p-4"><p>{label}</p><p className="club-stat-value mt-2 truncate">{value}</p>{detail && <p className="mt-1 text-xs text-[#c5b48f]">{detail}</p>}</div>; }
function sumScores(scores: HoleScore[] | undefined) { return scores?.reduce((sum, score) => sum + score.strokes, 0) ?? 0; }
function updateHoleScore(scores: HoleScore[] | undefined, holeNumber: number, rawValue: string) { const value = Number(rawValue); const rest = (scores ?? []).filter((score) => score.holeNumber !== holeNumber); return Number.isInteger(value) && value > 0 && value < 20 ? [...rest, { holeNumber, strokes: value }].sort((a, b) => a.holeNumber - b.holeNumber) : rest; }
function teamName(teams: ReturnType<typeof makeTeams>, teamId: string) { return teams.find((team) => team.id === teamId)?.name ?? "Unknown team"; }
function swapTeamPlayer(teams: ReturnType<typeof makeTeams>, teamId: string, slotIndex: number, nextPlayerId: string) { const sourceTeam = teams.find((team) => team.id === teamId); const previousPlayerId = sourceTeam?.playerIds[slotIndex]; if (!previousPlayerId || previousPlayerId === nextPlayerId) return teams; const occupiedTeam = teams.find((team) => team.playerIds.includes(nextPlayerId)); const occupiedIndex = occupiedTeam?.playerIds.indexOf(nextPlayerId) ?? -1; return teams.map((team) => ({ ...team, playerIds: team.playerIds.map((playerId, index) => team.id === teamId && index === slotIndex ? nextPlayerId : team.id === occupiedTeam?.id && index === occupiedIndex ? previousPlayerId : playerId) })); }
function skinLeader(players: Player[], results: ReturnType<typeof calculateSkins>) { const wins = new Map<string, number>(); results.forEach((result) => result.winnerId && wins.set(result.winnerId, (wins.get(result.winnerId) ?? 0) + 1)); const winner = [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; return players.find((player) => player.id === winner); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function applyTournamentState(state: TournamentState, setters: { setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; setSkinScores: React.Dispatch<React.SetStateAction<Scores>>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<string, string>>>; setTeamsByDay: React.Dispatch<React.SetStateAction<Record<ScrambleDay, Team[]>>>; setScrambleScores: React.Dispatch<React.SetStateAction<Scores>>; setSkinOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; setScrambleOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; setPostings: React.Dispatch<React.SetStateAction<Partial<Record<RoundKey, RoundPosting>>>> }) { const players = state.players?.length ? state.players : startingRoster; const legacyTeams = (state as TournamentState & { teams?: Team[] }).teams; setters.setPlayers(players); setters.setSkinScores(state.skinScores ?? {}); setters.setClosestToPin(state.closestToPin ?? {}); setters.setTeamsByDay(state.teamsByDay ?? { friday: legacyTeams?.length ? legacyTeams : makeTeams(players), saturday: legacyTeams?.length ? legacyTeams : makeTeams(players) }); setters.setScrambleScores(state.scrambleScores ?? {}); setters.setSkinOfficialTotals(state.skinOfficialTotals ?? {}); setters.setScrambleOfficialTotals(state.scrambleOfficialTotals ?? {}); setters.setPostings(state.postings ?? {}); }
