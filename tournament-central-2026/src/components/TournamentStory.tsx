"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type Lenis from "lenis";
import { BrandLogo } from "@/components/BrandLogo";
import type { AccessRole } from "@/lib/access";
import type { RoundKey, RoundPosting } from "@/lib/tournament/state";
import type { Player } from "@/lib/tournament/types";

type StoryProps = {
  players: Player[];
  role: AccessRole;
  postings: Partial<Record<RoundKey, RoundPosting>>;
  onOpenResults: () => void;
  onOpenScoring: () => void;
  onExit: () => void;
};

const chapters = [
  { id: "arrival", label: "Arrival", progress: 0 },
  { id: "field", label: "The field", progress: 0.17 },
  { id: "shrine", label: "Jeff", progress: 0.35 },
  { id: "clubhouse", label: "Evidence", progress: 0.52 },
  { id: "weekend", label: "The rounds", progress: 0.7 },
  { id: "results", label: "Posted boards", progress: 0.9 },
] as const;

const rounds: Array<{ key: RoundKey; day: string; course: string; format: string }> = [
  { key: "skins-thursday", day: "Thu", course: "The Tribute", format: "Skins" },
  { key: "skins-friday", day: "Fri", course: "The Tribute", format: "Skins" },
  { key: "scramble-friday", day: "Fri", course: "The Classic", format: "Scramble" },
  { key: "skins-saturday", day: "Sat", course: "The Tribute", format: "Skins" },
  { key: "scramble-saturday", day: "Sat", course: "The Classic", format: "Scramble" },
];

type ChapterId = (typeof chapters)[number]["id"];

export function TournamentStory({ players, role, postings, onOpenResults, onOpenScoring, onExit }: StoryProps) {
  const shellRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [activeChapter, setActiveChapter] = useState<ChapterId>("arrival");
  const [soundOn, setSoundOn] = useState(false);
  const postedCount = rounds.filter(({ key }) => postings[key]?.status === "posted").length;

  useEffect(() => {
    const shell = shellRef.current;
    const track = trackRef.current;
    if (!shell || !track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;
    let media: { add: (query: string, callback: () => void) => void; revert: () => void } | undefined;
    let lenis: Lenis | undefined;
    let rafId = 0;

    Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("gsap/MotionPathPlugin"),
      import("lenis"),
    ]).then(([gsapModule, triggerModule, motionModule, lenisModule]) => {
      if (cancelled) return;
      const gsap = gsapModule.gsap;
      const ScrollTrigger = triggerModule.ScrollTrigger;
      const MotionPathPlugin = motionModule.MotionPathPlugin;
      gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

      lenis = new lenisModule.default({
        duration: 1.15,
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 1.2,
        wheelMultiplier: 0.9,
      });
      lenisRef.current = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = window.requestAnimationFrame(raf);
      };
      rafId = window.requestAnimationFrame(raf);

      context = gsap.context(() => {
        media = gsap.matchMedia();
        const buildJourney = (mobile: boolean) => {
          const camera = mobile
            ? { start: 2.42, field: 2.6, shrine: 2.72, clubhouse: 2.55, weekend: 2.35, results: 2.5 }
            : { start: 1.12, field: 1.24, shrine: 1.4, clubhouse: 1.35, weekend: 1.15, results: 1.25 };
          const timeline = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            scrollTrigger: {
              trigger: track,
              start: "top top",
              end: "bottom bottom",
              scrub: 1.05,
              invalidateOnRefresh: true,
              onUpdate: ({ progress }: { progress: number }) => {
                let next: ChapterId = chapters[0].id;
                chapters.forEach((chapter) => { if (progress >= chapter.progress - 0.035) next = chapter.id; });
                setActiveChapter((current) => current === next ? current : next);
              },
            },
          });

          timeline
            .set(".journey-layer", { autoAlpha: 0 })
            .set(".journey-hero", { autoAlpha: 1 })
            .set(".journey-world-image", { scale: camera.start, transformOrigin: "50% 91%" })
            .set(".journey-cart-runner", { autoAlpha: 0, scale: 0.35 })
            .to(".journey-hero-copy", { autoAlpha: 0, yPercent: -35, filter: "blur(8px)", duration: 0.55 }, 0.35)
            .to(".journey-world-image", { scale: camera.field, transformOrigin: "71% 73%", duration: 1.05 }, 0.15)
            .fromTo(".journey-vignette", { opacity: 0.5 }, { opacity: 0.2, duration: 0.7 }, 0.25)
            .fromTo(".journey-field", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, 0.72)
            .fromTo(".journey-field-copy > *", { y: 45, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.36 }, 0.8)
            .fromTo(".journey-field-cutout", { yPercent: 35, scale: 0.72, autoAlpha: 0 }, { yPercent: 0, scale: 1, autoAlpha: 1, duration: 0.72 }, 0.72)
            .fromTo(".journey-cart-runner", { autoAlpha: 0, scale: 0.3 }, {
              autoAlpha: 1,
              scale: 0.72,
              duration: 1.05,
              motionPath: {
                path: mobile
                  ? [{ x: -150, y: 120 }, { x: 60, y: -40 }, { x: -75, y: -210 }]
                  : [{ x: -420, y: 150 }, { x: 180, y: -60 }, { x: -260, y: -250 }],
                curviness: 1.45,
                autoRotate: 12,
              },
            }, 0.7)
            .to(".journey-field", { autoAlpha: 0, duration: 0.34 }, 1.62)
            .to(".journey-world-image", { scale: camera.shrine, transformOrigin: "50% 57%", duration: 1.08 }, 1.5)
            .fromTo(".journey-shrine", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38 }, 1.84)
            .fromTo(".journey-jeff", { yPercent: 45, scale: 0.56, rotate: -7, autoAlpha: 0 }, { yPercent: 0, scale: 1, rotate: 0, autoAlpha: 1, duration: 0.82 }, 1.72)
            .fromTo(".journey-shrine-copy > *", { y: 35, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.36 }, 1.96)
            .to(".journey-shrine-halo", { rotate: 32, scale: 1.12, duration: 1.05 }, 1.78)
            .to(".journey-shrine", { autoAlpha: 0, duration: 0.36 }, 2.64)
            .to(".journey-world-image", { scale: camera.clubhouse, transformOrigin: "23% 51%", duration: 1.08 }, 2.5)
            .fromTo(".journey-evidence", { autoAlpha: 0, scale: 0.22, rotate: 8 }, { autoAlpha: 1, scale: 1, rotate: -1.5, duration: 0.72 }, 2.72)
            .fromTo(".journey-evidence-copy > *", { x: -45, autoAlpha: 0 }, { x: 0, autoAlpha: 1, stagger: 0.08, duration: 0.35 }, 2.86)
            .to(".journey-cart-runner", { autoAlpha: 0, scale: 2.8, filter: "blur(8px)", duration: 0.52 }, 2.72)
            .to(".journey-evidence", { autoAlpha: 0, yPercent: -18, filter: "blur(7px)", duration: 0.4 }, 3.57)
            .to(".journey-world-image", { scale: camera.weekend, transformOrigin: "67% 29%", duration: 1.15 }, 3.43)
            .fromTo(".journey-weekend", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38 }, 3.75)
            .fromTo(".journey-weekend-copy > *", { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.35 }, 3.82)
            .fromTo(".journey-round", { y: 70, rotate: 4, autoAlpha: 0 }, { y: 0, rotate: 0, autoAlpha: 1, stagger: 0.1, duration: 0.42 }, 3.98)
            .to(".journey-weekend", { autoAlpha: 0, duration: 0.38 }, 4.92)
            .to(".journey-world-image", { scale: camera.results, transformOrigin: "76% 13%", duration: 1.16 }, 4.78)
            .to(".journey-light", { opacity: 0.8, duration: 0.85 }, 4.78)
            .fromTo(".journey-results", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.42 }, 5.15)
            .fromTo(".journey-board", { yPercent: 35, scale: 0.86, rotateX: -12, autoAlpha: 0 }, { yPercent: 0, scale: 1, rotateX: 0, autoAlpha: 1, duration: 0.78 }, 5.08)
            .fromTo(".journey-board > *", { y: 25, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.34 }, 5.35);
        };
        media.add("(max-width: 759px)", () => buildJourney(true));
        media.add("(min-width: 760px)", () => buildJourney(false));
      }, shell);
      window.setTimeout(() => ScrollTrigger.refresh(), 250);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      lenis?.destroy();
      lenisRef.current = null;
      media?.revert();
      context?.revert();
    };
  }, []);

  const goToChapter = (chapter: (typeof chapters)[number]) => {
    const track = trackRef.current;
    if (!track) return;
    const top = window.scrollY + track.getBoundingClientRect().top;
    const distance = track.offsetHeight - window.innerHeight;
    const target = top + distance * chapter.progress;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.2 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  };

  return (
    <main ref={shellRef} className="journey-shell">
      <header className="journey-topbar">
        <button type="button" className="journey-crest" onClick={() => goToChapter(chapters[0])} aria-label="Return to the first tee"><BrandLogo decorative priority sizes="44px" /></button>
        <p><strong>East Coast Big Playas</strong></p>
        <button type="button" className="journey-posted" onClick={onOpenResults}><span>{postedCount}</span>/5 posted</button>
      </header>

      <div ref={trackRef} className="journey-track">
        <div className="journey-stage">
          <div className="journey-world" aria-hidden="true">
            <div className="journey-camera">
              <Image className="journey-world-image" src="/story/otsego-world-v2.png" alt="" width={941} height={1672} priority sizes="100vw" />
            </div>
            <div className="journey-clouds" />
            <div className="journey-light" />
            <div className="journey-vignette" />
            <div className="journey-grain" />
          </div>

          <section className="journey-layer journey-hero" aria-label="Tournament arrival">
            <BrandLogo className="journey-hero-seal" decorative priority sizes="(max-width: 759px) 44vw, 22vw" />
            <div className="journey-hero-copy">
              <p className="journey-kicker">Otsego Club · 2026</p>
              <h1><span>East Coast</span><em>Big Playas</em></h1>
            </div>
            <button type="button" className="journey-enter" onClick={() => goToChapter(chapters[1])}><span>Enter the grounds</span><i /></button>
          </section>

          <section className="journey-layer journey-field" aria-label="The twenty-four player field">
            <BrandLogo className="journey-field-seal" decorative sizes="120px" />
            <div className="journey-field-copy">
              <p className="journey-kicker">24 players</p>
              <h2>The<br /><em>field.</em></h2>
              <div className="journey-tier-counts">{(["A", "B", "C", "D"] as const).map((tier) => <span key={tier}><b>{tier}</b>{players.filter((player) => player.tier === tier).length}</span>)}</div>
            </div>
            <Image className="journey-field-cutout" src="/story/field-cutout-24-v2.png" alt="Twenty-four golfers assembled on the practice lawn" width={1363} height={1154} sizes="(max-width: 759px) 112vw, 66vw" />
          </section>

          <section className="journey-layer journey-shrine" aria-label="Jeff's fountain roundabout">
            <BrandLogo className="journey-shrine-seal" decorative sizes="150px" />
            <div className="journey-shrine-halo" aria-hidden="true" />
            <Image className="journey-jeff" src="/story/jeff-goat-fountain.png" alt="Jeff rendered as a monumental gold half-man, half-goat fountain" width={1024} height={1536} sizes="(max-width: 759px) 90vw, 50vw" />
            <div className="journey-shrine-copy">
              <p className="journey-kicker">The roundabout</p>
              <h2>Jeff.</h2>
              <p>Half man. Half goat.</p>
            </div>
          </section>

          <section className="journey-layer journey-evidence" aria-label="Suppressed cart footage">
            <div className="journey-evidence-copy">
              <p className="journey-kicker">Evidence 18</p>
              <h2>No<br /><em>license.</em></h2>
            </div>
            <div className="journey-film">
              <video muted={!soundOn} loop playsInline autoPlay preload="metadata" poster="/story/unlicensed-cart-operator-poster.jpg">
                <source src="/story/unlicensed-cart-operator.mp4" type="video/mp4" />
              </video>
              <span>Evidence 18 · Aug. 16</span>
              <button type="button" onClick={() => setSoundOn((current) => !current)}>{soundOn ? "Mute" : "Sound on"}</button>
              <BrandLogo className="journey-film-seal" decorative sizes="64px" />
            </div>
          </section>

          <div className="journey-cart-runner" aria-hidden="true"><Image src="/story/unlicensed-cart-operator-poster.jpg" alt="" fill sizes="120px" /></div>

          <section className="journey-layer journey-weekend" aria-label="Tournament round itinerary">
            <BrandLogo className="journey-weekend-seal" decorative sizes="260px" />
            <div className="journey-weekend-copy">
              <p className="journey-kicker">Five rounds</p>
              <h2>Tribute.<br /><em>Classic.</em></h2>
            </div>
            <div className="journey-rounds">
              {rounds.map((round, index) => <article className="journey-round" key={round.key}><span>{String(index + 1).padStart(2, "0")}</span><p><b>{round.day}</b><strong>{round.course}</strong><small>{round.format}</small></p><i className={postings[round.key]?.status === "posted" ? "is-posted" : ""}>{postings[round.key]?.status === "posted" ? "Posted" : "After play"}</i></article>)}
            </div>
          </section>

          <section className="journey-layer journey-results" aria-label="Official posted results">
            <div className="journey-board">
              <BrandLogo className="journey-board-seal" sizes="96px" />
              <p className="journey-kicker">Posted results</p>
              <h2>Official<br /><em>boards.</em></h2>
              <p>Released after commissioner review.</p>
              <div className="journey-board-status"><strong>{postedCount}</strong><span>of five boards<br /><b>officially posted</b></span></div>
              <button type="button" onClick={onOpenResults}>Open the posted boards <span>→</span></button>
              {role === "scorekeeper" && <button type="button" className="journey-scorekeeper-link" onClick={onOpenScoring}>Enter the scoring room</button>}
            </div>
          </section>
        </div>
      </div>

      <nav className="journey-nav" aria-label="Course journey">
        {chapters.map((chapter) => <button key={chapter.id} type="button" className={activeChapter === chapter.id ? "is-active" : ""} onClick={() => goToChapter(chapter)} aria-label={`Go to ${chapter.label}`}><i /></button>)}
      </nav>

      <div className="journey-utilities">
        <button type="button" onClick={onOpenResults}><span>{postedCount}</span>Results</button>
        <button type="button" onClick={role === "scorekeeper" ? onOpenScoring : onExit}><span>{role === "scorekeeper" ? "+" : "↗"}</span>{role === "scorekeeper" ? "Scores" : "Exit"}</button>
      </div>
    </main>
  );
}
