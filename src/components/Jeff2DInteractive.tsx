"use client";

import Image from "next/image";
import { useState } from "react";

const regions = ["pecs", "thong"] as const;
export type JeffPokeZone = (typeof regions)[number];

export function Jeff2DInteractive({ onPoke }: { onPoke: (zone: JeffPokeZone) => void }) {
  const [reaction, setReaction] = useState({ zone: "" as JeffPokeZone | "", id: 0 });

  const poke = (zone: JeffPokeZone) => {
    setReaction((current) => ({ zone, id: current.id + 1 }));
    onPoke(zone);
  };

  return (
    <div className="home-jeff-2d">
      <div className="home-jeff-puppet" role="img" aria-label="Jeff, the golden half-man half-goat patron saint">
        <div className="home-jeff-visual" aria-hidden="true">
          <Image src="/story/jeff-goat-podium.png" alt="" width={1024} height={1536} preload className="home-jeff-portrait" />
          <div key={`pec-left-${reaction.id}`} className={`home-jeff-part home-jeff-pec-left ${reaction.zone === "pecs" ? "is-reacting" : ""}`} />
          <div key={`pec-right-${reaction.id}`} className={`home-jeff-part home-jeff-pec-right ${reaction.zone === "pecs" ? "is-reacting" : ""}`} />
          <div key={`waistband-${reaction.id}`} className={`home-jeff-part home-jeff-waistband ${reaction.zone === "thong" ? "is-reacting" : ""}`} />
          <div key={`bulge-${reaction.id}`} className={`home-jeff-part home-jeff-bulge ${reaction.zone === "thong" ? "is-reacting" : ""}`} />
        </div>
        {regions.map((zone) => (
          <button key={zone} type="button" className={`home-jeff-hit home-jeff-hit-${zone}`} onClick={() => poke(zone)} aria-label={`Poke Jeff's ${zone}`} />
        ))}
      </div>
    </div>
  );
}
