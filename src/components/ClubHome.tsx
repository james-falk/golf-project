"use client";

import { useEffect, useRef } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Jeff2DInteractive } from "@/components/Jeff2DInteractive";

export function ClubHome({ onOpenScoring }: { onOpenScoring: () => void }) {
  return <div className="club-home">
    <section className="home-hero">
      <div className="home-hero-photo" aria-hidden="true" />
      <div className="home-hero-shade" aria-hidden="true" />
      <div className="home-hero-copy">
        <p className="club-kicker">Private club · public concern</p>
        <h2>The lodge is open.<br /><em>Standards are not.</em></h2>
        <div className="home-hero-actions">
          <button type="button" onClick={onOpenScoring}>Open tournament scoring</button>
        </div>
      </div>
      <JeffIdol />
      <div className="home-crest"><BrandLogo decorative sizes="84px" /></div>
    </section>

  </div>;
}

function JeffIdol() {
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/jeff-audio", { method: "HEAD" }).then((response) => {
      if (response.headers.get("x-jeff-audio") === "ready") {
        audio.current = new Audio("/audio/jeff-poke.mp3");
        audio.current.preload = "auto";
      }
    }).catch(() => undefined);
    return () => {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const pokeJeff = () => {
    if (audio.current) {
      audio.current.currentTime = 0;
      void audio.current.play();
    } else if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const reaction = new SpeechSynthesisUtterance("Ooh! Ah! Ooh! Ah!");
      reaction.rate = 1.28;
      reaction.pitch = 0.62;
      reaction.volume = 1;
      window.speechSynthesis.speak(reaction);
    }
  };

  return <div className="home-jeff-stage">
    <div className="home-jeff-halo" aria-hidden="true" />
    <Jeff2DInteractive onPoke={pokeJeff} />
    <div className="home-jeff-poke-hint" aria-hidden="true">Touch me</div>
    <div className="home-jeff-plaque"><small>Half man · half goat · full Daryl</small></div>
  </div>;
}
