"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ClubHome } from "@/components/ClubHome";
import { ClubPet } from "@/components/ClubPet";
import { PayoutDashboard } from "@/components/PayoutDashboard";
import type { AccessRole } from "@/lib/access";
import { confirmed2026Rules } from "@/lib/tournament/config";
import { allRoundKeys, fieldForRound, makeCleanTournamentState, paidEntriesForRound } from "@/lib/tournament/live-state";
import { makeMockTournamentState } from "@/lib/tournament/mock-state";
import { calculateScramblePayouts, calculateSkinPayouts, calculateSkins, skinRoundPot, strokesReceivedOnHole } from "@/lib/tournament/rules";
import { classicCourse, makeTeams, startingRoster, tributeCourse } from "@/lib/tournament/seed";
import type { RoundKey, RoundPosting, Scores, ScrambleDay, SkinDay, Team, TournamentState } from "@/lib/tournament/state";
import type { HoleScore, Player } from "@/lib/tournament/types";

type Tab = "home" | "central" | "skins" | "scramble" | "setup" | "archive";
type ScoreDay = SkinDay | "payouts";
type RoundType = "skins" | "scramble";

const skinDays: SkinDay[] = ["thursday", "friday", "saturday"];
const scrambleDays: ScrambleDay[] = ["friday", "saturday"];
const scorekeeperDraftKey = "ecbp-2026-scorekeeper-draft-v5";
const choicesPreviewUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/16/41/571641f5-9ed5-5829-d974-37c940f11d63/mzaf_2253382345250106604.plus.aac.p.m4a";
const musicVolume = 0.09;
const tabs: Array<{ id: Tab; label: string; mobileLabel: string }> = [
  { id: "home", label: "Clubhouse", mobileLabel: "Home" },
  { id: "central", label: "Scoring", mobileLabel: "Scores" },
  { id: "setup", label: "Commissioner setup", mobileLabel: "Setup" },
  { id: "archive", label: "Archive", mobileLabel: "Archive" },
];

/** An unstarted board: the confirmed field and its teams, and no scores at all. */
function emptyTournamentState(): TournamentState {
  return makeCleanTournamentState(null);
}

const cardKey = (day: string, id: string | number) => `${day}:${id}`;

export function TournamentConsole() {
  const [tab, setTab] = useState<Tab>("home");
  const [players, setPlayers] = useState(startingRoster);
  const [skinScores, setSkinScores] = useState<Scores>({});
  const [skinOfficialTotals, setSkinOfficialTotals] = useState<Record<string, string>>({});
  const [closestToPin, setClosestToPin] = useState<Record<string, string>>({});
  const [teamsByDay, setTeamsByDay] = useState<Record<ScrambleDay, Team[]>>(() => ({ friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) }));
  const [scrambleScores, setScrambleScores] = useState<Scores>({});
  const [scrambleOfficialTotals, setScrambleOfficialTotals] = useState<Record<string, string>>({});
  const [postings, setPostings] = useState<Partial<Record<RoundKey, RoundPosting>>>({});
  const [paidEntries, setPaidEntries] = useState<Partial<Record<RoundKey, number>>>({});
  const [absences, setAbsences] = useState<Partial<Record<RoundKey, string[]>>>({});
  const [activeSkinDay, setActiveSkinDay] = useState<SkinDay>("thursday");
  const [activeScrambleDay, setActiveScrambleDay] = useState<ScrambleDay>("friday");
  const [activeScoreDay, setActiveScoreDay] = useState<ScoreDay>("thursday");
  const [activeRoundType, setActiveRoundType] = useState<RoundType>("skins");
  const [hydrated, setHydrated] = useState(false);
  const [accessRole, setAccessRole] = useState<AccessRole | "loading" | null>("loading");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [syncState, setSyncState] = useState<"local" | "saving" | "synced" | "error">("local");
  const [sharedStorage, setSharedStorage] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicFadeRef = useRef<number | null>(null);
  const teams = teamsByDay[activeScrambleDay];

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
    if (musicEnabled) {
      setMusicEnabled(false);
      stopMusic();
    } else {
      setMusicEnabled(true);
      startMusic();
    }
  }, [musicEnabled, startMusic, stopMusic]);

  useEffect(() => {
    if (!accessRole || accessRole === "loading" || !musicEnabled) return;
    startMusic();
    const unlockMusic = () => startMusic();
    window.addEventListener("pointerdown", unlockMusic, { capture: true, once: true });
    window.addEventListener("keydown", unlockMusic, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockMusic, { capture: true });
      window.removeEventListener("keydown", unlockMusic, { capture: true });
    };
  }, [accessRole, musicEnabled, startMusic]);

  useEffect(() => {
    if (!accessRole || accessRole === "loading") return;
    let cancelled = false;
    const load = async () => {
      let state: TournamentState | null = null;
      let shared = false;
      try {
        const response = await fetch("/api/tournament-state", { cache: "no-store" });
        const data = await response.json() as { state: TournamentState | null; shared: boolean; locked: boolean };
        if (response.ok) {
          state = data.state;
          shared = data.shared;
          setSharedStorage(data.shared);
          setLocked(data.locked);
          setSyncState(data.shared ? "synced" : "local");
        }
      } catch { setSyncState("local"); }
      // A local draft may only stand in when there is no shared ledger at all. Once
      // Postgres is answering it is the source of truth, so a stale draft from an
      // earlier test can never be replayed over a started tournament.
      if (!state && !shared && accessRole === "scorekeeper") {
        const saved = window.localStorage.getItem(scorekeeperDraftKey);
        if (saved) try { state = JSON.parse(saved) as TournamentState; } catch { /* Use the official seed. */ }
      }
      if (cancelled) return;
      applyTournamentState(state ?? emptyTournamentState(), { setPlayers, setSkinScores, setClosestToPin, setTeamsByDay, setScrambleScores, setSkinOfficialTotals, setScrambleOfficialTotals, setPostings, setPaidEntries, setAbsences });
      setHydrated(true);
    };
    load();
    return () => { cancelled = true; };
  }, [accessRole]);

  useEffect(() => {
    if (!hydrated || accessRole !== "scorekeeper") return;
    const state = { players, skinScores, closestToPin, teamsByDay, scrambleScores, skinOfficialTotals, scrambleOfficialTotals, postings, paidEntries, absences } satisfies TournamentState;
    window.localStorage.setItem(scorekeeperDraftKey, JSON.stringify(state));
    if (!sharedStorage) return;
    const timeout = window.setTimeout(async () => {
      setSyncState("saving");
      try {
        const response = await fetch("/api/tournament-state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
        if (!response.ok) throw new Error("Shared save failed");
        setSyncState("synced");
      } catch { setSyncState("error"); }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [hydrated, accessRole, sharedStorage, players, skinScores, closestToPin, teamsByDay, scrambleScores, skinOfficialTotals, scrambleOfficialTotals, postings, paidEntries, absences]);

  const skinField = useMemo(() => fieldForRound({ absences }, `skins-${activeSkinDay}` as RoundKey, players), [absences, activeSkinDay, players]);
  const activeSkinScores = useMemo(() => Object.fromEntries(skinField.map((player) => [player.id, skinScores[cardKey(activeSkinDay, player.id)] ?? []])), [skinField, skinScores, activeSkinDay]);
  const skinResults = useMemo(() => calculateSkins(skinField, tributeCourse, activeSkinScores, confirmed2026Rules.skinRound), [skinField, activeSkinScores]);
  const entriesFor = useCallback((round: RoundKey) => paidEntriesForRound({ paidEntries }, round, players.length), [paidEntries, players.length]);
  const skinEntries = entriesFor(`skins-${activeSkinDay}` as RoundKey);
  const skinPot = skinRoundPot(skinEntries, confirmed2026Rules.skinRound);
  const skinPayouts = calculateSkinPayouts(skinEntries, skinResults, confirmed2026Rules.skinRound);
  const scrambleResults = teams.map((team) => ({ teamId: team.id, total: teamTotal(scrambleOfficialTotals, activeScrambleDay, team.id) }));
  const scramblePayouts = calculateScramblePayouts(scrambleResults, entriesFor(`scramble-${activeScrambleDay}` as RoundKey), confirmed2026Rules.scrambleRound);
  const activeClosestToPin = Object.fromEntries(confirmed2026Rules.skinRound.closestToPinHoleNumbers.flatMap((hole) => closestToPin[cardKey(activeSkinDay, hole)] ? [[hole, closestToPin[cardKey(activeSkinDay, hole)]]] : []));
  const activeSkinRoundKey: RoundKey = `skins-${activeSkinDay}`;
  const activeScrambleRoundKey: RoundKey = `scramble-${activeScrambleDay}`;
  const skinIsPosted = postings[activeSkinRoundKey]?.status === "posted";
  const scrambleIsPosted = postings[activeScrambleRoundKey]?.status === "posted";
  const skinCardsReady = skinField.every((player) => {
    const key = cardKey(activeSkinDay, player.id);
    const card = skinScores[key];
    return card?.length === 18;
  });
  const skinCtpReady = confirmed2026Rules.skinRound.closestToPinHoleNumbers.every((hole) => Boolean(closestToPin[cardKey(activeSkinDay, hole)]));
  const scrambleCardsReady = teams.filter((team) => teamTotal(scrambleOfficialTotals, activeScrambleDay, team.id) > 0).length >= 2;

  // Renaming a team is cosmetic, so it stays available after the field is locked.

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
    setTab("home");
  };

  /**
   * Fills the board with throwaway scores for testing, or starts the tournament
   * for real. Starting clears every score and locks the roster and the teams; from
   * then on the site can only enter scores.
   */
  const runLifecycleAction = async (action: "seed-preview" | "start-tournament") => {
    if (action === "start-tournament" && !window.confirm(
      "Start the tournament?\n\nThis erases every score currently on the board, locks in the 23-player roster and both days of teams, and cannot be undone from the site.",
    )) return;

    setLifecycleBusy(true);
    try {
      if (!sharedStorage) {
        // No shared ledger to start; preview data is still useful for local testing.
        if (action === "seed-preview") applyTournamentState(makeMockTournamentState(), { setPlayers, setSkinScores, setClosestToPin, setTeamsByDay, setScrambleScores, setSkinOfficialTotals, setScrambleOfficialTotals, setPostings, setPaidEntries, setAbsences });
        return;
      }
      const response = await fetch("/api/tournament-state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { state?: TournamentState; locked?: boolean; error?: string };
      if (!response.ok || !data.state) {
        setSyncState("error");
        if (data.error) window.alert(data.error);
        return;
      }
      window.localStorage.removeItem(scorekeeperDraftKey);
      setHydrated(false);
      applyTournamentState(data.state, { setPlayers, setSkinScores, setClosestToPin, setTeamsByDay, setScrambleScores, setSkinOfficialTotals, setScrambleOfficialTotals, setPostings, setPaidEntries, setAbsences });
      setLocked(Boolean(data.locked));
      setSyncState("synced");
      setHydrated(true);
    } catch {
      setSyncState("error");
    } finally {
      setLifecycleBusy(false);
    }
  };

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 0);
  };

  const selectScoreDay = (day: ScoreDay) => {
    setActiveScoreDay(day);
    if (day === "payouts") return;
    setActiveSkinDay(day);
    if (day === "thursday") setActiveRoundType("skins");
    else setActiveScrambleDay(day);
  };

  const selectRoundType = (roundType: RoundType) => {
    if (activeScoreDay === "payouts" || activeScoreDay === "thursday") return;
    setActiveRoundType(roundType);
    setActiveSkinDay(activeScoreDay);
    setActiveScrambleDay(activeScoreDay);
  };

  if (accessRole === "loading") return <ClubhouseLoading />;
  if (!accessRole) return <AccessGate code={accessCode} setCode={setAccessCode} error={accessError} enter={enterClubhouse} />;
  const canEdit = accessRole === "scorekeeper";
  const visibleTabs = canEdit ? tabs : tabs.filter((item) => item.id !== "setup");
  const statusLabel = canEdit ? !sharedStorage ? "Scorekeeper · Local draft" : syncState === "saving" ? "Saving…" : syncState === "error" ? "Save needs attention" : "Scorekeeper · Shared" : "Refresh standings";

  return (
    <main className={`club-site min-h-screen text-stone-100 ${tab === "central" || tab === "skins" || tab === "scramble" ? "has-scoring-room" : ""}`}>
      <header className="club-masthead">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="club-header-row">
            <div className="club-brand">
              <BrandLogo className="club-brand-logo" priority sizes="74px" />
              <div>
                <p className="club-kicker">Otsego Club · Gaylord, Michigan</p>
                <h1 className="club-title mt-1">East Coast Big Playas <span className="club-title-suffix">Invitational</span></h1>
              </div>
            </div>
            <div className="club-header-actions"><button type="button" onClick={toggleMusic} className={`club-badge club-music ${musicEnabled ? "is-enabled" : ""} ${musicPlaying ? "is-playing" : ""}`} aria-label={`${musicEnabled ? "Pause" : "Play"} Choices by E-40`} aria-pressed={musicEnabled}><span aria-hidden="true">♪</span><span className="club-action-label">Choices</span></button><button type="button" onClick={() => window.location.reload()} className="club-badge" aria-label={statusLabel}><span className="club-action-icon" aria-hidden="true">↻</span><span className="club-action-label">{statusLabel}</span></button><button type="button" onClick={leaveClubhouse} className="club-badge" aria-label="Exit clubhouse"><span className="club-action-icon" aria-hidden="true">×</span><span className="club-action-label">Exit</span></button></div>
          </div>
          <nav className="club-nav" aria-label="Tournament areas">
            {visibleTabs.map((item) => <button key={item.id} onClick={() => switchTab(item.id)} className={`club-tab ${tab === item.id ? "club-tab-active" : ""}`}><span className="club-tab-label">{item.label}</span><span className="club-tab-mobile-label">{item.mobileLabel}</span></button>)}
          </nav>
        </div>
      </header>
      {tab === "home" ? <ClubHome onOpenScoring={() => switchTab("central")} /> : <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {tab === "central" && <Central
          players={players}
          activeScoreDay={activeScoreDay}
          setActiveScoreDay={selectScoreDay}
          activeRoundType={activeRoundType}
          setActiveRoundType={selectRoundType}
          skinPot={skinPot}
          entriesFor={entriesFor}
          skinFieldSize={skinField.length}
          absences={absences}
          skinPayouts={skinPayouts}
          skinResults={skinResults}
          closestToPin={activeClosestToPin}
          scrambleResults={scrambleResults}
          scramblePayouts={scramblePayouts}
          teams={teams}
          skinIsPosted={skinIsPosted}
          scrambleIsPosted={scrambleIsPosted}
          canEdit={canEdit}
          skinScores={skinScores}
          allClosestToPin={closestToPin}
          teamsByDay={teamsByDay}
          scrambleTotals={scrambleOfficialTotals}
          postings={postings}
          openSkins={() => switchTab("skins")}
          openScramble={() => switchTab("scramble")}
        />}
        {tab === "skins" && (canEdit || skinIsPosted ? <SkinsBoard canEdit={canEdit} activeDay={activeSkinDay} backToDay={() => switchTab("central")} players={skinField} scores={skinScores} updateScore={updateSkinScore} closestToPin={closestToPin} setClosestToPin={setClosestToPin} posting={postings[activeSkinRoundKey]} canPublish={skinCardsReady && skinCtpReady} publish={() => publishRound(activeSkinRoundKey)} returnToReview={() => returnRoundToReview(activeSkinRoundKey)} /> : <AwaitingBoard course="Skins" day={activeSkinDay} days={skinDays} onDayChange={setActiveSkinDay} />)}
        {tab === "scramble" && (canEdit || scrambleIsPosted ? <ScrambleBoard canEdit={canEdit} activeDay={activeScrambleDay} backToDay={() => switchTab("central")} teams={teams} players={players} officialTotals={scrambleOfficialTotals} setOfficialTotals={setScrambleOfficialTotals} payouts={scramblePayouts} posting={postings[activeScrambleRoundKey]} canPublish={scrambleCardsReady} publish={() => publishRound(activeScrambleRoundKey)} returnToReview={() => returnRoundToReview(activeScrambleRoundKey)} /> : <AwaitingBoard course="Scramble" day={activeScrambleDay} days={scrambleDays} onDayChange={setActiveScrambleDay} />)}
        {tab === "setup" && canEdit && <Setup players={players} setPlayers={setPlayers} resetAllTeams={() => setTeamsByDay({ friday: makeTeams(startingRoster), saturday: makeTeams(startingRoster) })} locked={locked} lifecycleBusy={lifecycleBusy} runLifecycleAction={runLifecycleAction} />}
        {tab === "archive" && <Archive />}
      </div>}
      <ClubPet />
    </main>
  );
}

function ClubhouseLoading() {
  return <main className="story-loading grid min-h-screen place-items-center px-5 text-center"><BrandLogo className="story-loading-logo" priority sizes="144px" /><div><p className="story-eyebrow">Otsego Club · 2026</p><p className="club-display mt-3 text-4xl">Opening the grounds…</p></div></main>;
}

function AccessGate({ code, setCode, error, enter }: { code: string; setCode: (value: string) => void; error: string; enter: () => void }) {
  return <main className="story-gate min-h-screen"><div className="story-gate-photo" aria-hidden="true" /><div className="story-gate-shade" /><section className="story-gate-card"><BrandLogo className="story-gate-logo" priority sizes="128px" /><p className="story-eyebrow">Otsego Club · Gaylord, Michigan</p><h1>Welcome to<br /><em>the inner circle.</em></h1><p className="story-gate-deck">The official 2026 proceedings of the East Coast Big Playas.</p><form onSubmit={(event) => { event.preventDefault(); enter(); }}><label htmlFor="clubhouse-code">Clubhouse passcode</label><div><input id="clubhouse-code" autoComplete="current-password" autoFocus type="password" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter passcode" /><button>Enter</button></div>{error && <p role="alert" className="story-gate-error">{error}</p>}</form></section><p className="story-gate-foot">Private tournament ledger · Est. under disputed circumstances</p></main>;
}

function Central({ players, activeScoreDay, setActiveScoreDay, activeRoundType, setActiveRoundType, skinPot, entriesFor, skinFieldSize, absences, skinPayouts, skinResults, closestToPin, scrambleResults, scramblePayouts, teams, skinIsPosted, scrambleIsPosted, canEdit, skinScores, allClosestToPin, teamsByDay, scrambleTotals, postings, openSkins, openScramble }: {
  players: Player[];
  activeScoreDay: ScoreDay;
  setActiveScoreDay: (day: ScoreDay) => void;
  activeRoundType: RoundType;
  setActiveRoundType: (roundType: RoundType) => void;
  skinPot: ReturnType<typeof skinRoundPot>;
  entriesFor: (round: RoundKey) => number;
  skinFieldSize: number;
  absences: Partial<Record<RoundKey, string[]>>;
  skinPayouts: Record<number, number>;
  skinResults: ReturnType<typeof calculateSkins>;
  closestToPin: Record<number, string>;
  scrambleResults: Array<{ teamId: string; total: number }>;
  scramblePayouts: ReturnType<typeof calculateScramblePayouts>;
  teams: ReturnType<typeof makeTeams>;
  skinIsPosted: boolean;
  scrambleIsPosted: boolean;
  canEdit: boolean;
  skinScores: Scores;
  allClosestToPin: Record<string, string>;
  teamsByDay: Record<ScrambleDay, Team[]>;
  scrambleTotals: Record<string, string>;
  postings: Partial<Record<RoundKey, RoundPosting>>;
  openSkins: () => void;
  openScramble: () => void;
}) {
  const potFor = (round: RoundKey) => entriesFor(round) * confirmed2026Rules.skinRound.playerEntryFee;
  const roundPot = potFor(`skins-${activeScoreDay === "payouts" ? "thursday" : activeScoreDay}` as RoundKey);
  const tournamentPot = allRoundKeys.reduce((sum, round) => sum + potFor(round), 0);
  const dayPot = (day: SkinDay) => potFor(`skins-${day}` as RoundKey) + (day === "thursday" ? 0 : potFor(`scramble-${day}` as RoundKey));
  const dayNav = <nav className="scoring-day-nav" aria-label="Scoring day">
    {(["thursday", "friday", "saturday", "payouts"] as const).map((day) => <button key={day} type="button" aria-pressed={activeScoreDay === day} onClick={() => setActiveScoreDay(day)}><strong>{day === "payouts" ? "Total payouts" : capitalize(day)}</strong><small>${day === "payouts" ? tournamentPot : dayPot(day)}</small></button>)}
  </nav>;

  if (activeScoreDay === "payouts") return <div className="space-y-6">{dayNav}<PayoutDashboard players={players} skinScores={skinScores} closestToPin={allClosestToPin} teamsByDay={teamsByDay} scrambleTotals={scrambleTotals} postings={postings} entriesFor={entriesFor} absences={absences} canEdit={canEdit} /></div>;

  const scramblePot = activeScoreDay === "thursday" ? 0 : potFor(`scramble-${activeScoreDay}` as RoundKey);
  const selectedRound: RoundType = activeScoreDay === "thursday" ? "skins" : activeRoundType;
  const isSkins = selectedRound === "skins";
  const isPosted = isSkins ? skinIsPosted : scrambleIsPosted;
  const canOpen = canEdit || isPosted;
  const classicPar = classicCourse.holes.reduce((sum, hole) => sum + hole.par, 0);
  const scrambleLeader = [...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total)[0];
  const skinStandings = players.map((player) => {
    const wins = skinResults.filter((result) => result.winnerId === player.id);
    return { player, wins: wins.length, payout: wins.reduce((sum, result) => sum + (skinPayouts[result.holeNumber] ?? 0), 0) };
  }).filter((entry) => entry.wins > 0).sort((a, b) => b.payout - a.payout || a.player.name.localeCompare(b.player.name));
  const roundOptions = activeScoreDay === "thursday" ? [{ id: "skins" as const, title: "Skins" }] : [{ id: "skins" as const, title: "Skins" }, { id: "scramble" as const, title: "Scramble" }];
  const roundAccessCopy = canEdit
    ? isSkins ? "Commissioner override: select a player to review or correct their complete 18-hole card." : "Commissioner override: review or correct any team's result against par."
    : isSkins ? "View any player's complete 18-hole card after the round is posted." : "View every team's result once the round is posted.";

  return <div className="space-y-6">
    {dayNav}
    <section className={`day-pot-summary ${activeScoreDay !== "thursday" ? "has-scramble" : ""}`} aria-label={`${capitalize(activeScoreDay)} prize pool`}>
      <div><span>{capitalize(activeScoreDay)} pot</span><strong>${dayPot(activeScoreDay)}</strong><small>{activeScoreDay === "thursday" ? `one $${roundPot} round` : `two $${roundPot} rounds`}</small></div>
      <div><span>Skins round</span><strong>${roundPot}</strong><small>${skinPot.skinsTotal} skins · ${skinPot.closestToPinTotal} CTP</small></div>
      {activeScoreDay !== "thursday" ? <div><span>Scramble round</span><strong>${scramblePot}</strong><small>${scramblePot - confirmed2026Rules.scrambleRound.secondPlacePrize} first · ${confirmed2026Rules.scrambleRound.secondPlacePrize} second</small></div> : null}
    </section>
    <nav className="scoring-round-nav" aria-label={`${capitalize(activeScoreDay)} round type`}>{roundOptions.map((round) => <button key={round.id} type="button" aria-pressed={selectedRound === round.id} onClick={() => setActiveRoundType(round.id)}><strong>{round.title}</strong></button>)}</nav>
    <section className="club-hero grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <BrandLogo className="club-hero-logo" decorative sizes="150px" />
      <div><p className="club-kicker">{capitalize(activeScoreDay)} score ledger</p><h2 className="club-display mt-3 text-4xl sm:text-6xl">{isSkins ? "Skins." : "Scramble."}</h2>{!isSkins ? <p className="mt-3 text-sm text-stone-300">{"Each team's result against par · first and second place payouts"}</p> : null}</div>
      <div className={`grid ${isSkins ? "grid-cols-3" : "grid-cols-3"} gap-2`}><Stat label="Status" value={isPosted ? "Posted" : "Draft"} detail="" />{isSkins ? <Stat label="Field" value={String(skinFieldSize)} detail="playing" /> : null}{!isSkins ? <Stat label="Teams" value={String(teams.length)} detail="reported" /> : null}<Stat label="Purse" value={`$${isSkins ? skinPot.total : scramblePot}`} detail="" /></div>
    </section>
    {isSkins && (isPosted || canEdit) ? <HoleByHoleSkins players={players} results={skinResults} payouts={skinPayouts} /> : null}
    <section className={`grid gap-4 ${isPosted || canEdit ? "lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}`}>
      {isPosted || canEdit ? <div className="club-card p-5 sm:p-6">
        <p className="club-kicker">{isPosted ? "Official results" : "Live committee projection"}</p>
        <h3 className="club-card-title mt-1">{isSkins ? "Skins, CTP & player cards" : "Team standings & payouts"}</h3>
        {isSkins ? isPosted || canEdit ? <><div className="mt-4">{skinStandings.length ? skinStandings.map((entry, index) => <div key={entry.player.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-[#bca062]/30 py-2 text-sm"><span className="text-[#d6ba73]">{index + 1}</span><span className="font-semibold">{entry.player.name}</span><span>{entry.wins} skin{entry.wins === 1 ? "" : "s"}</span><span className="font-bold text-[#ead292]">${entry.payout}</span></div>) : <p className="mt-3 text-sm text-stone-400">Complete all player cards to calculate skins.</p>}</div><div className="mt-5"><p className="club-kicker">Closest to pin · $20 each</p>{Object.entries(closestToPin).length ? Object.entries(closestToPin).map(([hole, playerId]) => <p key={hole} className="mt-2 text-sm">Hole {hole} · <span className="font-semibold text-[#ead292]">{players.find((player) => player.id === playerId)?.name ?? "Winner pending"}</span></p>) : <p className="mt-2 text-sm text-stone-400">No CTP winners entered.</p>}</div></> : null : isPosted || canEdit ? <div className="mt-4">{[...scrambleResults].filter((entry) => entry.total > 0).sort((a, b) => a.total - b.total).map((entry, index) => { const payout = scramblePayouts.find((item) => item.teamId === entry.teamId); return <div key={entry.teamId} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-[#bca062]/30 py-2 text-sm"><span className="text-[#d6ba73]">{index + 1}</span><span className="font-semibold">{teamPlayerNames(teams.find((team) => team.id === entry.teamId), players).join(" · ") || "Unknown team"}</span><span className={entry.total && entry.total < classicPar ? "font-bold text-[#8fd6a8]" : "font-bold"}>{formatToPar(entry.total, classicPar)}</span><span className="font-bold text-[#ead292]">{payout ? `$${Math.floor(payout.teamPayout)}` : "—"}</span></div>})}{!scrambleLeader ? <p className="text-sm text-stone-400">Complete all team cards to calculate places and payouts.</p> : null}</div> : null}
      </div> : null}
      <aside className="club-ledger self-start p-5 text-[#12332d]"><p className="club-ledger-label">Round access</p><h3 className="club-card-title !text-[#173f35]">{isSkins ? "Player scorecards" : "Team scorecards"}</h3><p className="mt-3 text-sm leading-6 text-[#557269]">{roundAccessCopy}</p><button type="button" disabled={!canOpen} onClick={isSkins ? openSkins : openScramble} className="publication-primary mt-5 w-full">{canOpen ? canEdit ? `Open ${isSkins ? "player" : "team"} cards` : "View official cards" : "Awaiting posted results"}</button></aside>
    </section>
  </div>;
}

function HoleByHoleSkins({ players, results, payouts }: { players: Player[]; results: ReturnType<typeof calculateSkins>; payouts: Record<number, number> }) {
  return <section className="club-card p-5 sm:p-6" aria-labelledby="hole-by-hole-skins-title">
    <p className="club-kicker">Hole-by-hole skins</p>
    <h3 id="hole-by-hole-skins-title" className="club-card-title mt-1">Lowest score on every hole</h3>
    <p className="mt-2 text-sm leading-6 text-stone-300">The lowest handicap-adjusted score wins the skin. A tie at the lowest net score makes the hole dead.</p>
    <div className="skin-hole-ledger mt-5">
      {results.map((result) => {
        const winner = result.winnerId ? players.find((player) => player.id === result.winnerId) : undefined;
        return <div key={result.holeNumber} className="skin-hole-row">
          <span className="skin-hole-number">Hole {result.holeNumber}</span>
          <div className="min-w-0">
            <strong className={winner ? "text-[#ead292]" : result.isComplete ? "text-stone-300" : "text-stone-400"}>{winner?.name ?? (result.isComplete ? "Tie — dead hole" : "Awaiting complete cards")}</strong>
            <small>{result.bestNetScore == null ? "Lowest net score —" : `Lowest net score ${result.bestNetScore}`}</small>
          </div>
          <span className={winner ? "skin-hole-payout" : "skin-hole-payout is-dead"}>{winner ? `$${payouts[result.holeNumber] ?? 0}` : result.isComplete ? "No payout" : "—"}</span>
        </div>;
      })}
    </div>
  </section>;
}

function SkinsBoard({ canEdit, activeDay, backToDay, players, scores, updateScore, closestToPin, setClosestToPin, posting, canPublish, publish, returnToReview }: { canEdit: boolean; activeDay: SkinDay; backToDay: () => void; players: Player[]; scores: Scores; updateScore: (id: string, hole: number, value: string) => void; closestToPin: Record<string, string>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<string, string>>>; posting?: RoundPosting; canPublish: boolean; publish: () => void; returnToReview: () => void }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visiblePlayers = players.filter((player) => !normalizedSearch || player.name.toLowerCase().includes(normalizedSearch) || `${player.tier} tier`.toLowerCase().includes(normalizedSearch));

  return <div className="space-y-6"><button type="button" className="scoring-back" onClick={backToDay}>← {capitalize(activeDay)} overview</button><SectionTitle eyebrow={`${capitalize(activeDay)} · Skins`} title="Player scorecards" text="" />
    <section className="scorecard-directory">
      <label htmlFor="scorecard-search"><span>Find a player</span><input id="scorecard-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by player or tier" /></label>
      <p><strong>{visiblePlayers.length}</strong> of {players.length} cards</p>
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="club-card p-5"><p className="club-kicker">Closest to pin</p><div className="ctp-card-grid mt-4">{confirmed2026Rules.skinRound.closestToPinHoleNumbers.map((hole) => { const ctpKey = cardKey(activeDay, hole); return <label key={hole} className="block text-sm font-semibold">Hole {hole}<select disabled={!canEdit} value={closestToPin[ctpKey] ?? ""} onChange={(event) => setClosestToPin((current) => ({ ...current, [ctpKey]: event.target.value }))} className="field mt-1 w-full disabled:opacity-70"><option value="">No winner entered</option>{players.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>})}</div></div>
      {canEdit ? <PublicationPanel posting={posting} ready={canPublish} incompleteText="Every player card must have all 18 holes, and all four CTP winners must be entered." publish={publish} returnToReview={returnToReview} /> : null}
    </div>
    <section className="player-scorecard-stack" aria-live="polite">
      {visiblePlayers.map((player) => <TributePlayerScorecard key={player.id} player={player} playerNumber={players.indexOf(player) + 1} activeDay={activeDay} scores={scores[cardKey(activeDay, player.id)]} canEdit={canEdit} updateScore={(hole, value) => updateScore(player.id, hole, value)} />)}
      {!visiblePlayers.length ? <div className="club-card p-8 text-center"><p className="club-card-title">No player matches “{search}”.</p></div> : null}
    </section>
  </div>;
}

function TributePlayerScorecard({ player, playerNumber, activeDay, scores, canEdit, updateScore }: { player: Player; playerNumber: number; activeDay: SkinDay; scores: HoleScore[] | undefined; canEdit: boolean; updateScore: (hole: number, value: string) => void }) {
  const enteredHoles = scores?.length ?? 0;
  const gross = sumScores(scores);
  const handicap = confirmed2026Rules.skinRound.tierStrokes[player.tier];
  const net = enteredHoles === 18 ? gross - handicap : 0;
  const frontScore = scores?.filter((score) => score.holeNumber <= 9).reduce((sum, score) => sum + score.strokes, 0) ?? 0;
  const backScore = scores?.filter((score) => score.holeNumber > 9).reduce((sum, score) => sum + score.strokes, 0) ?? 0;
  const holeValue = (hole: number) => scores?.find((score) => score.holeNumber === hole)?.strokes ?? "";
  const holeStrokes = (strokeIndex: number) => strokesReceivedOnHole(player.tier, strokeIndex, confirmed2026Rules.skinRound);
  const scoreCell = (hole: (typeof tributeCourse.holes)[number]) => { const received = holeStrokes(hole.strokeIndex); return <td key={hole.number} className={received ? "receives-stroke" : undefined}><span className="scorecard-stroke-marker" aria-label={`${received} handicap ${received === 1 ? "stroke" : "strokes"} received`}>{"•".repeat(received)}</span><input disabled={!canEdit} inputMode="numeric" aria-label={`${player.name}, hole ${hole.number}${received ? `, receives ${received} handicap ${received === 1 ? "stroke" : "strokes"}` : ""}`} value={holeValue(hole.number)} onChange={(event) => updateScore(hole.number, event.target.value)} placeholder="—" /></td>; };
  const frontPar = tributeCourse.holes.slice(0, 9).reduce((sum, hole) => sum + hole.par, 0);
  const backPar = tributeCourse.holes.slice(9).reduce((sum, hole) => sum + hole.par, 0);
  const nineHoleTable = (label: "Front" | "Back", holes: typeof tributeCourse.holes, par: number, score: number) => <table className="scorecard-nine" aria-label={`${player.name} ${label.toLowerCase()} nine`}>
    <thead><tr><th>{label}</th>{holes.map((hole) => <th key={hole.number}>{hole.number}</th>)}<th className="scorecard-total-cell">{label === "Front" ? "Out" : "In"}</th></tr></thead>
    <tbody>
      <tr className="scorecard-reference-row"><th>Handicap</th>{holes.map((hole) => <td key={hole.number}>{hole.strokeIndex}</td>)}<td className="scorecard-total-cell" /></tr>
      <tr className="scorecard-par-row"><th>Par</th>{holes.map((hole) => <td key={hole.number}>{hole.par}</td>)}<td className="scorecard-total-cell">{par}</td></tr>
      <tr className="scorecard-player-row"><th>{player.name}</th>{holes.map(scoreCell)}<td className="scorecard-total-cell">{score || "—"}</td></tr>
    </tbody>
  </table>;

  return <article id={`scorecard-${player.id}`} className="traditional-scorecard">
    <header>
      <div><span>Player {String(playerNumber).padStart(2, "0")}</span><h3>{player.name}</h3><p>{capitalize(activeDay)} · {player.tier} tier · {handicap} strokes</p></div>
      <div className="scorecard-course-mark"><small>Otsego Resort</small><strong>The Tribute</strong><span>Official scorecard</span></div>
      <dl><div><dt>Gross</dt><dd>{enteredHoles === 18 ? gross : "—"}</dd></div><div><dt>HCP</dt><dd>{handicap}</dd></div><div><dt>Net</dt><dd>{net || "—"}</dd></div></dl>
    </header>
    <div className="traditional-scorecard-scroll" tabIndex={0} aria-label={`${player.name} scorecard. Scroll horizontally to see all holes.`}>
      {nineHoleTable("Front", tributeCourse.holes.slice(0, 9), frontPar, frontScore)}
      {nineHoleTable("Back", tributeCourse.holes.slice(9), backPar, backScore)}
    </div>
  </article>;
}

/**
 * The scramble is scored as one number per team, not hole by hole. Six teams are
 * listed top to bottom with their players, the team score, and how that score
 * finished against the card.
 */
function ScrambleBoard({ canEdit, activeDay, backToDay, teams, players, officialTotals, setOfficialTotals, payouts, posting, canPublish, publish, returnToReview }: { canEdit: boolean; activeDay: ScrambleDay; backToDay: () => void; teams: ReturnType<typeof makeTeams>; players: Player[]; officialTotals: Record<string, string>; setOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; payouts: ReturnType<typeof calculateScramblePayouts>; posting?: RoundPosting; canPublish: boolean; publish: () => void; returnToReview: () => void }) {
  const par = classicCourse.holes.reduce((sum, hole) => sum + hole.par, 0);

  return <div className="space-y-6">
    <button type="button" className="scoring-back" onClick={backToDay}>← {capitalize(activeDay)} overview</button>
    <SectionTitle eyebrow={`${capitalize(activeDay)} · Scramble`} title="18-hole team scramble" text={`The Classic · par ${par}`} />
    {canEdit ? <PublicationPanel posting={posting} ready={canPublish} incompleteText="Report at least the two teams that finished in the money before posting this round." publish={publish} returnToReview={returnToReview} /> : null}
    {!teams.length ? <section className="club-hero board-awaiting p-8 text-center sm:p-12"><h3 className="club-display text-3xl sm:text-5xl">No results reported.</h3><p className="mt-3 text-sm text-stone-300">Teams appear here as their results come in. Send them from Telegram by naming the players: “Roger, Logan, Mitchell and Aiden, 5 under”.</p></section> : null}
    <div className="scramble-team-list">
      {teams.map((team, index) => {
        const key = cardKey(activeDay, team.id);
        const total = teamTotal(officialTotals, activeDay, team.id);
        const payout = payouts.find((entry) => entry.teamId === team.id);
        return <section key={team.id} className="scramble-team-card" aria-label={teamPlayerNames(team, players).join(", ")}>
          <header className="scramble-team-head">
            <span className="scramble-team-rank">{index + 1}</span>
            <h3>{teamPlayerNames(team, players).join(" · ")}</h3>
            {payout ? <span className="scramble-team-payout">{ordinalPlace(payout.place)} · ${Math.floor(payout.teamPayout)}</span> : null}
          </header>
          <div className="scramble-team-score">
            {canEdit
              ? <label><span>To par</span><input inputMode="text" value={toParInput(officialTotals[key], par)} onChange={(event) => setOfficialTotals((current) => {
                  const raw = event.target.value.replace(/[^0-9+-]/g, "");
                  const parsed = raw === "" || raw === "-" || raw === "+" ? NaN : Number(raw);
                  const next = { ...current };
                  if (Number.isFinite(parsed)) next[key] = String(par + parsed); else delete next[key];
                  return next;
                })} placeholder="—" aria-label={`${teamPlayerNames(team, players).join(", ")} strokes against par`} /></label>
              : <strong className={total && total < par ? "is-under" : ""}>{formatToPar(total, par)}</strong>}
            <span className="scramble-team-topar">{total ? `${total} strokes` : "—"}</span>
          </div>
        </section>;
      })}
    </div>
  </div>;
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

/**
 * The one-way door between testing and the real tournament. Before the start it
 * offers throwaway preview data; after it, it is a status card only — the site
 * has no way back.
 */
function TournamentLifecycle({ locked, busy, run }: { locked: boolean; busy: boolean; run: (action: "seed-preview" | "start-tournament") => void }) {
  if (locked) {
    return <section className="publication-panel is-posted p-5">
      <p className="club-kicker">Tournament status</p>
      <h3 className="club-card-title mt-2">Started &amp; locked</h3>
      <p className="mt-3 text-sm leading-6 text-stone-300">The roster and both days of teams are locked in, and the ledger is the permanent record. Scores entered from here or from Telegram are saved and kept. Unlocking is a backend-only action.</p>
    </section>;
  }

  return <section className="publication-panel p-5">
    <p className="club-kicker">Tournament status</p>
    <h3 className="club-card-title mt-2">Not started</h3>
    <p className="mt-3 text-sm leading-6 text-stone-300">Nothing on the board is permanent yet. Load preview data to test the workflow, then start the tournament to clear it all and lock the field in for real.</p>
    <div className="mt-4 grid gap-2">
      <button type="button" disabled={busy} onClick={() => run("seed-preview")} className="publication-secondary">Load preview data for testing</button>
      <button type="button" disabled={busy} onClick={() => run("start-tournament")} className="publication-primary">Start the tournament &amp; lock the field</button>
    </div>
  </section>;
}

function AwaitingBoard<T extends string>({ course, day, days, onDayChange }: { course: string; day: T; days: readonly T[]; onDayChange: (day: T) => void }) {
  return <div className="space-y-6"><SectionTitle eyebrow={`${capitalize(day)} · ${course}`} title="No scores yet." text="" /><DayPicker days={days} activeDay={day} onChange={onDayChange} /><section className="club-hero board-awaiting p-8 text-center sm:p-12"><h3 className="club-display text-3xl sm:text-5xl">Still counting.</h3></section></div>;
}


function Setup({ players, setPlayers, resetAllTeams, locked, lifecycleBusy, runLifecycleAction }: { players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; resetAllTeams: () => void; locked: boolean; lifecycleBusy: boolean; runLifecycleAction: (action: "seed-preview" | "start-tournament") => void }) {
  return <div className="space-y-6"><SectionTitle eyebrow="Commissioner workspace" title="Roster, bands & teams" text={locked ? "The tournament has started. The roster and both days of teams are locked; this page is now a read-only record of the field. Score entry is unaffected." : "Arrange the field and the teams, then start the tournament to lock them in and clear the board."} />
    <TournamentLifecycle locked={locked} busy={lifecycleBusy} run={runLifecycleAction} />
    <section className="club-ledger p-5 text-[#12332d] sm:p-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="club-ledger-label">Official field</p><h3 className="club-card-title !text-[#173f35]">Player stroke bands</h3></div>{locked ? <span className="border border-[#8d794f] px-4 py-2 text-sm font-semibold text-[#61766d]">Locked field</span> : <button onClick={() => { setPlayers(startingRoster); resetAllTeams(); }} className="border border-[#8d794f] px-4 py-2 text-sm font-semibold hover:bg-[#ded1b4]">Reset roster & both days</button>}</div><div className="mb-5 grid grid-cols-4 border border-[#a99670] bg-[#f8f2e5]">{(["A", "B", "C", "D"] as const).map((tier) => <div key={tier} className="border-r border-[#a99670] p-3 text-center last:border-r-0"><p className="font-serif text-xl font-bold">{tier}</p><p className="text-xs text-[#61766d]">{players.filter((player) => player.tier === tier).length} players · {confirmed2026Rules.skinRound.tierStrokes[tier]} strokes</p></div>)}</div><div className="grid gap-px border border-[#a99670] bg-[#a99670] sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => <div key={player.id} className="flex items-center justify-between bg-[#f8f2e5] px-4 py-3"><span className="font-semibold">{player.name}</span><select disabled={locked} aria-label={`${player.name} stroke band`} value={player.tier} onChange={(event) => setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, tier: event.target.value as Player["tier"] } : entry))} className="field !min-h-0 !py-1 text-sm font-semibold"><option value="A">A · 0</option><option value="B">B · 6</option><option value="C">C · 12</option><option value="D">D · 18</option></select></div>)}</div></section>
    <section className="club-card p-5 sm:p-7"><p className="club-kicker">The Classic pairings</p><h3 className="club-card-title mt-1">Teams form as results come in</h3><p className="mt-2 text-sm text-stone-300">Scramble teams are not arranged in advance. A team is created the first time its result is reported, by naming the 3 or 4 players who played together. Only the teams that finish in the money need to be reported at all.</p></section>
  </div>;
}

function Archive() {
  return <div className="mx-auto max-w-4xl">
    <SectionTitle eyebrow="The club record book" title="Archive" text="Previous tournaments, preserved exactly as they finished." />
    <div className="archive-year-list mt-7">
      <a href="https://tournament-archive-2025.vercel.app" target="_blank" rel="noreferrer" className="archive-year">
        <span className="archive-year-number">2025</span>
        <span className="archive-year-detail">Open the 2025 board ↗</span>
      </a>
    </div>
  </div>;
}

function DayPicker<T extends string>({ days, activeDay, onChange, compact = false }: { days: readonly T[]; activeDay: T; onChange: (day: T) => void; compact?: boolean }) { return <div className={`day-picker ${compact ? "inline-flex" : "flex w-fit"}`} role="group" aria-label="Select tournament day">{days.map((day) => <button key={day} type="button" aria-pressed={activeDay === day} onClick={() => onChange(day)} className={`day-picker-button ${activeDay === day ? "day-picker-active" : ""}`}>{capitalize(day)}</button>)}</div>; }
function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <section><p className="club-kicker">{eyebrow}</p><h2 className="club-display mt-2 text-3xl sm:text-4xl">{title}</h2>{text && <p className="mt-3 max-w-2xl leading-7 text-stone-300">{text}</p>}</section>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="club-stat min-w-0 p-3 sm:p-4"><p>{label}</p><p className="club-stat-value mt-2 break-words">{value}</p>{detail && <p className="mt-1 text-xs text-[#c5b48f]">{detail}</p>}</div>; }
function toParInput(stored: string | undefined, par: number) { const strokes = Number(stored); return Number.isFinite(strokes) && strokes > 0 ? String(strokes - par) : ""; }
function teamTotal(officialTotals: Record<string, string>, day: string, teamId: string) { return Number(officialTotals[cardKey(day, teamId)]) || 0; }
function formatToPar(total: number, par: number) { if (!total) return "\u2014"; const difference = total - par; return difference === 0 ? "Even" : difference > 0 ? `+${difference}` : String(difference); }
function ordinalPlace(place: 1 | 2) { return place === 1 ? "1st" : "2nd"; }
function sumScores(scores: HoleScore[] | undefined) { return scores?.reduce((sum, score) => sum + score.strokes, 0) ?? 0; }
function updateHoleScore(scores: HoleScore[] | undefined, holeNumber: number, rawValue: string) { const value = Number(rawValue); const rest = (scores ?? []).filter((score) => score.holeNumber !== holeNumber); return Number.isInteger(value) && value > 0 && value < 20 ? [...rest, { holeNumber, strokes: value }].sort((a, b) => a.holeNumber - b.holeNumber) : rest; }
function teamPlayerNames(team: { playerIds: string[] } | undefined, players: Player[]) { return (team?.playerIds ?? []).map((id) => players.find((player) => player.id === id)?.name ?? "—"); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function applyTournamentState(state: TournamentState, setters: { setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; setSkinScores: React.Dispatch<React.SetStateAction<Scores>>; setClosestToPin: React.Dispatch<React.SetStateAction<Record<string, string>>>; setTeamsByDay: React.Dispatch<React.SetStateAction<Record<ScrambleDay, Team[]>>>; setScrambleScores: React.Dispatch<React.SetStateAction<Scores>>; setSkinOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; setScrambleOfficialTotals: React.Dispatch<React.SetStateAction<Record<string, string>>>; setPostings: React.Dispatch<React.SetStateAction<Partial<Record<RoundKey, RoundPosting>>>>; setPaidEntries: React.Dispatch<React.SetStateAction<Partial<Record<RoundKey, number>>>>; setAbsences: React.Dispatch<React.SetStateAction<Partial<Record<RoundKey, string[]>>>> }) { const players = state.players?.length ? state.players : startingRoster; const legacyTeams = (state as TournamentState & { teams?: Team[] }).teams; setters.setPlayers(players); setters.setSkinScores(state.skinScores ?? {}); setters.setClosestToPin(state.closestToPin ?? {}); setters.setTeamsByDay(state.teamsByDay ?? { friday: legacyTeams?.length ? legacyTeams : makeTeams(players), saturday: legacyTeams?.length ? legacyTeams : makeTeams(players) }); setters.setScrambleScores(state.scrambleScores ?? {}); setters.setSkinOfficialTotals(state.skinOfficialTotals ?? {}); setters.setScrambleOfficialTotals(state.scrambleOfficialTotals ?? {}); setters.setPostings(state.postings ?? {}); setters.setPaidEntries(state.paidEntries ?? {}); setters.setAbsences(state.absences ?? {}); }
