"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Jeff2DInteractive } from "@/components/Jeff2DInteractive";

export function ClubHome({ onOpenScoring, onOpenGallery }: { onOpenScoring: () => void; onOpenGallery: () => void }) {
  return <div className="club-home">
    <section className="home-hero">
      <div className="home-hero-photo" aria-hidden="true" />
      <div className="home-hero-shade" aria-hidden="true" />
      <div className="home-hero-copy">
        <p className="club-kicker">Private club · public concern</p>
        <h2>The lodge is open.<br /><em>Standards are not.</em></h2>
        <div className="home-hero-actions">
          <button type="button" onClick={onOpenScoring}>Open tournament scoring</button>
          <button type="button" onClick={onOpenGallery}>Enter the photo vault</button>
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

type LocalPhoto = { id: string; url: string; caption: string; uploader: string };

export function GalleryPage() {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [uploader, setUploader] = useState("");
  const photoUrls = useRef<string[]>([]);

  useEffect(() => () => photoUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/")).map((file) => {
      const url = URL.createObjectURL(file);
      photoUrls.current.push(url);
      return { id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, url, caption: caption.trim(), uploader: uploader.trim() || "Anonymous member" };
    });
    setPhotos((current) => [...incoming, ...current]);
    setCaption("");
  };

  return <div className="gallery-page">
    <header className="gallery-heading"><div><p className="club-kicker">The trip photo vault</p><h2>Evidence from the grounds.</h2></div><p>Direct from the camera roll. Captions optional. Judgment guaranteed.</p></header>
    <section className="gallery-upload">
      <div><p className="club-kicker">Submit clubhouse evidence</p><h3>Accountant-assisted filing</h3><p>Upload the evidence before anyone has time to establish a consistent story.</p></div>
      <div className="gallery-fields"><label><span>Member or suspicious alias</span><input value={uploader} onChange={(event) => setUploader(event.target.value)} placeholder="Anonymous member" /></label><label><span>Optional caption</span><input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Explain yourself, briefly" /></label><label className="gallery-file"><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => { addPhotos(event.target.files); event.currentTarget.value = ""; }} /><span>Choose photos from iPhone</span></label></div>
    </section>
    <section className="gallery-grid" aria-live="polite">
      {photos.map((photo) => <figure key={photo.id}><Image src={photo.url} alt={photo.caption || `Photo uploaded by ${photo.uploader}`} fill unoptimized sizes="(max-width: 700px) 100vw, 33vw" /><figcaption><strong>{photo.caption || "Untitled clubhouse evidence"}</strong><span>Filed by {photo.uploader}</span></figcaption></figure>)}
      <figure className="gallery-video"><video src="/story/unlicensed-cart-operator.mp4" controls playsInline preload="metadata" aria-label="Golf cart video" /><figcaption><strong>Golf cart footage</strong></figcaption></figure>
    </section>
  </div>;
}
