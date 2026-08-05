"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const PET_STORAGE_KEY = "ecbp-club-pet-v1";

const pets = [
  {
    id: "putter-goblin",
    name: "Stephan",
    image: "/pets/poofy-pants-pet-v1.png",
    imagePosition: "center bottom",
  },
  {
    id: "fur-marshal",
    name: "Petor",
    image: "/pets/hawaiian-stance-pet-v1.png",
    imagePosition: "center bottom",
  },
  {
    id: "remote-official",
    name: "Bubbles",
    image: "/pets/optical-auditor-pet-v1.png",
    imagePosition: "center bottom",
  },
] as const;

type PetId = (typeof pets)[number]["id"];

function isPetId(value: string | null): value is PetId {
  return pets.some((pet) => pet.id === value);
}

export function ClubPet({ quiet = false }: { quiet?: boolean }) {
  const petRef = useRef<HTMLDivElement>(null);
  const performanceTimer = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<PetId>(pets[0].id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [performanceId, setPerformanceId] = useState(0);
  const [performing, setPerforming] = useState(false);
  const selectedPet = pets.find((pet) => pet.id === selectedId) ?? pets[0];

  useEffect(() => {
    const storedPet = window.localStorage.getItem(PET_STORAGE_KEY);
    const frame = window.requestAnimationFrame(() => {
      if (isPetId(storedPet)) setSelectedId(storedPet);
      else setPickerOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    const pet = petRef.current;
    if (!pet) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isMobile = () => coarsePointer || window.innerWidth <= 820;
    const viewportWidth = () => window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
    const dockX = () => isMobile() ? 12 : viewportWidth() - (quiet ? 88 : 112);
    const dockY = () => viewportHeight() - (isMobile() ? 118 : quiet ? 178 : 238);
    let x = Math.max(12, dockX());
    let y = Math.max(84, dockY());
    let targetX = x;
    let targetY = y;
    let frame = 0;
    let dockTimer: number | null = null;

    const clampTarget = (nextX: number, nextY: number) => {
      const petWidth = Math.max(pet.offsetWidth, isMobile() ? 44 : 56);
      const petHeight = Math.max(pet.offsetHeight, isMobile() ? 96 : 140);
      targetX = Math.max(8, Math.min(viewportWidth() - petWidth - 8, nextX));
      targetY = Math.max(78, Math.min(viewportHeight() - petHeight - 8, nextY));
      pet.dataset.facing = targetX < x ? "left" : "right";
    };

    const draw = () => {
      const easing = isMobile() ? 0.085 : 0.12;
      x += (targetX - x) * easing;
      y += (targetY - y) * easing;
      pet.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.35) {
        frame = window.requestAnimationFrame(draw);
      } else {
        frame = 0;
        pet.classList.remove("is-scurrying");
      }
    };

    const seek = () => {
      if (!frame) frame = window.requestAnimationFrame(draw);
    };

    const dock = () => {
      clampTarget(dockX(), dockY());
      seek();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      if (event.pointerType === "mouse") {
        clampTarget(event.clientX + 28, event.clientY + 32);
      } else if (event.isPrimary) {
        clampTarget(event.clientX - pet.offsetWidth - 22, event.clientY + 26);
      } else {
        return;
      }
      pet.classList.add("is-scurrying");
      seek();
    };

    const scheduleDock = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (dockTimer !== null) window.clearTimeout(dockTimer);
      dockTimer = window.setTimeout(() => {
        pet.classList.remove("is-scurrying");
        dock();
      }, 1100);
    };

    const handleResize = () => dock();
    pet.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", scheduleDock, { passive: true });
    window.addEventListener("pointercancel", scheduleDock, { passive: true });
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (dockTimer !== null) window.clearTimeout(dockTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", scheduleDock);
      window.removeEventListener("pointercancel", scheduleDock);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [quiet]);

  useEffect(() => () => {
    if (performanceTimer.current !== null) window.clearTimeout(performanceTimer.current);
  }, []);

  const choosePet = (petId: PetId) => {
    window.localStorage.setItem(PET_STORAGE_KEY, petId);
    setSelectedId(petId);
    setPerforming(false);
    setPickerOpen(false);
  };

  const perform = () => {
    setPerformanceId((current) => current + 1);
    setPerforming(true);
    if (performanceTimer.current !== null) window.clearTimeout(performanceTimer.current);
    performanceTimer.current = window.setTimeout(() => setPerforming(false), 1250);
  };

  return <>
    <div
      ref={petRef}
      data-pet={selectedPet.id}
      className={`club-pet ${quiet ? "is-quiet" : ""}`}
    >
      <button
        key={`${selectedPet.id}-${performanceId}`}
        type="button"
        className={`club-pet-figure club-pet-action ${performing ? "is-performing" : ""}`}
        onClick={perform}
        aria-label={`Make ${selectedPet.name} do something stupid`}
      >
        <span className="club-pet-puppet">
          <Image className="club-pet-base" src={selectedPet.image} alt="" fill sizes="110px" style={{ objectPosition: selectedPet.imagePosition }} />
          <span className="club-pet-part club-pet-part-primary" aria-hidden="true"><Image src={selectedPet.image} alt="" fill sizes="110px" style={{ objectPosition: selectedPet.imagePosition }} /></span>
          <span className="club-pet-part club-pet-part-secondary" aria-hidden="true"><Image src={selectedPet.image} alt="" fill sizes="110px" style={{ objectPosition: selectedPet.imagePosition }} /></span>
        </span>
      </button>
    </div>

    <button type="button" className="club-pet-picker-toggle" onClick={() => setPickerOpen(true)} aria-label="Choose your club pet">
      <span aria-hidden="true">🐾</span><span>Choose pet</span>
    </button>

    {pickerOpen ? <div className="club-pet-picker-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) setPickerOpen(false);
    }}>
      <section className="club-pet-picker" role="dialog" aria-modal="true" aria-labelledby="club-pet-picker-title">
        <button type="button" className="club-pet-picker-close" onClick={() => setPickerOpen(false)} aria-label="Close pet chooser">×</button>
        <h2 id="club-pet-picker-title">Choose your pet</h2>
        <div className="club-pet-choices">
          {pets.map((pet) => <button
            key={pet.id}
            type="button"
            className={`club-pet-choice ${selectedId === pet.id ? "is-selected" : ""}`}
            onClick={() => choosePet(pet.id)}
            aria-pressed={selectedId === pet.id}
            aria-label={`Choose ${pet.name}`}
          >
            <span className="club-pet-choice-art"><Image src={pet.image} alt="" fill sizes="(max-width: 820px) 100px, 180px" /></span>
            <span className="club-pet-choice-copy"><strong>{pet.name}</strong></span>
          </button>)}
        </div>
      </section>
    </div> : null}
  </>;
}
