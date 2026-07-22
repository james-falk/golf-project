"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type LoreItem = {
  src: string;
  alt: string;
  title: string;
  caption: string;
  sensitive?: boolean;
};

export const loreItems: LoreItem[] = [
  { src: "/lore/membership-committee.png", alt: "Two tournament members in matching red shirts", title: "The Membership Committee", caption: "The dress code meeting ended without a dress code." },
  { src: "/lore/daryl-1.png", alt: "A vintage identification photograph", title: "Legacy Handicap Verification", caption: "The number on the card remains under committee review." },
  { src: "/lore/daryl-2.png", alt: "A member wearing a sideways cap and glasses", title: "Director of Digital Operations", caption: "He has seen the leaderboard. He has concerns." },
  { src: "/lore/daryl-3.png", alt: "A member holding two frogs", title: "Course Wildlife Liaison", caption: "Both witnesses confirmed the ball was playable." },
  { src: "/lore/daryl-4.png", alt: "Two formally dressed members posing together", title: "The Pairings Committee", caption: "Six teams. Four players. Zero explanations." },
  { src: "/lore/daryl-5.jpeg", alt: "A vintage formal portrait", title: "Founding Board Member", caption: "Photographed moments before objecting to ready golf." },
  { src: "/lore/daryl-6.png", alt: "A member taking a drink", title: "Hydration Marshal", caption: "Maintaining tournament standards one suspicious beverage at a time." },
  { src: "/lore/daryl-7.jpeg", alt: "A member relaxing in a large outdoor chair", title: "Pace-of-Play Enforcement", caption: "Monitoring the group ahead with tremendous urgency." },
  { src: "/lore/daryl-8.png", alt: "A member wearing a headband and gaming headset", title: "Remote Rules Official", caption: "Headset certified. Ruling questionable." },
  { src: "/lore/daryl-9.png", alt: "A member holding a first-place trophy", title: "Trophy Custodian", caption: "He brought his own trophy, which is an elite confidence move." },
  { src: "/lore/larry-1.png", alt: "A member wearing a green novelty hat", title: "Swamp Division Champion", caption: "No one remembers approving the hat. No one is brave enough to revoke it." },
  { src: "/lore/larry-2.png", alt: "A shirtless member looking down", title: "Pre-Round Visualization", caption: "Imagining the breakfast sandwich at the turn." },
  { src: "/lore/larry-3.png", alt: "A surprised member wearing a winter cap", title: "The Cold-Plunge Incident", caption: "The minutes from this committee meeting were sealed." },
  { src: "/lore/larry-4.png", alt: "A member asleep between pillows", title: "Weather Delay Coordinator", caption: "Wake him only if the cart path opens." },
  { src: "/lore/larry-5.png", alt: "A member gesturing toward something", title: "Volunteer Starter", caption: "Your tee time was seven minutes ago, apparently." },
  { src: "/lore/larry-6.png", alt: "A golfer posing with a putter", title: "Putting Laboratory", caption: "The shorts added three degrees of toe flow." },
  { src: "/lore/larry-7.png", alt: "A member wearing a paper crown and eating a fry", title: "Reigning Turn Champion", caption: "One crown. No conceded putts." },
  { src: "/lore/larry-8.jpeg", alt: "A vintage portrait wearing a novelty cap", title: "Archive Department", caption: "Keeper of receipts, grudges and disputed scorecards." },
  { src: "/lore/larry-9.png", alt: "A member wearing a white fur coat", title: "Clubhouse Formalwear", caption: "Country-club casual was interpreted broadly." },
  { src: "/lore/jeff-1.jpeg", alt: "A vintage photograph of a member relaxing in a bathtub", title: "Recovery Room", caption: "Two beverages. One headset. No notes." },
  { src: "/lore/jeff-2.jpeg", alt: "A humorous vintage missing poster", title: "Sealed Personnel File", caption: "Declassified against the advice of counsel.", sensitive: true },
  { src: "/lore/baby-sun.jpg", alt: "A smiling baby sun over a green hill", title: "Official Tournament Weather", caption: "Forecast: deeply unsettling with a chance of three-putts." },
];

type ClubLoreContextValue = { openLore: (index: number) => void };
const ClubLoreContext = createContext<ClubLoreContextValue | null>(null);
const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export function ClubLoreProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [discovered, setDiscovered] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const keys = useRef<string[]>([]);

  const openLore = useCallback((index: number) => {
    const safeIndex = ((index % loreItems.length) + loreItems.length) % loreItems.length;
    setCurrent(safeIndex);
    setRevealed(false);
    setOpen(true);
    setDiscovered((existing) => {
      if (existing.includes(safeIndex)) return existing;
      return [...existing, safeIndex];
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const move = useCallback((direction: number) => openLore(current + direction), [current, openLore]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") close();
      else if (open && event.key === "ArrowRight") move(1);
      else if (open && event.key === "ArrowLeft") move(-1);
      keys.current = [...keys.current, event.key].slice(-konami.length);
      if (keys.current.join("|").toLowerCase() === konami.join("|").toLowerCase()) openLore(21);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close, move, open, openLore]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const item = loreItems[current];
  return <ClubLoreContext.Provider value={{ openLore }}>
    {children}
    <button type="button" onClick={() => openLore(discovered.length % loreItems.length)} className="lore-button" aria-label="Open the clubhouse lore collection">
      <BrandLogo className="lore-button-logo" decorative sizes="36px" /><span>Club lore</span><small>{discovered.length}/{loreItems.length}</small>
    </button>
    {open && <div className="lore-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="lore-dialog" role="dialog" aria-modal="true" aria-labelledby="lore-title">
        <div className="lore-dialog-bar"><span>East Coast Big Playas · Club File {String(current + 1).padStart(2, "0")}</span><button type="button" onClick={close} aria-label="Close clubhouse lore">Close ×</button></div>
        <div className="lore-stage">
          <Image src={item.src} alt={item.alt} fill sizes="(max-width: 768px) 92vw, 54vw" className={`lore-stage-image ${item.sensitive && !revealed ? "lore-redacted" : ""}`} priority />
          {item.sensitive && !revealed && <button type="button" onClick={() => setRevealed(true)} className="lore-declassify"><span>Restricted clubhouse material</span><strong>Declassify at your own risk</strong></button>}
          <span className="lore-stamp" aria-hidden="true">Property of the club</span>
        </div>
        <div className="lore-copy"><div><p>Clubhouse evidence</p><h2 id="lore-title">{item.title}</h2><span>{item.caption}</span></div><div className="lore-controls"><button type="button" onClick={() => move(-1)} aria-label="Previous clubhouse file">←</button><strong>{current + 1} / {loreItems.length}</strong><button type="button" onClick={() => move(1)} aria-label="Next clubhouse file">→</button></div></div>
      </section>
    </div>}
  </ClubLoreContext.Provider>;
}

export function LorePhoto({ index, label, className = "" }: { index: number; label: string; className?: string }) {
  const lore = useContext(ClubLoreContext);
  const item = loreItems[index];
  if (!lore || !item) return null;
  return <button type="button" onClick={() => lore.openLore(index)} className={`lore-photo ${className}`} aria-label={`Open clubhouse file: ${item.title}`}>
    <span className="lore-photo-frame"><Image src={item.src} alt="" fill sizes="220px" className="object-contain" /></span>
    <span className="lore-photo-label">{label}</span>
  </button>;
}

export function LoreStrip() {
  return <section className="lore-strip" aria-label="Clubhouse lore">
    <div><p className="club-kicker">Unverified clubhouse intelligence</p><p className="mt-1 text-sm text-[#d6c9ab]">The official board is serious. The membership is not.</p></div>
    <div className="lore-strip-photos"><LorePhoto index={9} label="Defending something" /><LorePhoto index={15} label="Putting lab" /><LorePhoto index={18} label="Formal attire" /></div>
  </section>;
}
