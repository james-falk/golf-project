"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Jeff2DInteractive } from "@/components/Jeff2DInteractive";
import { loreItems, useClubLore } from "@/components/ClubLore";
import { cleanUploader, photoAccept, photoRejectionReason, type GalleryPhoto } from "@/lib/gallery";

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

type UploadState = { busy: boolean; done: number; total: number; error: string };

export function GalleryPage({ canEdit }: { canEdit: boolean }) {
  const lore = useClubLore();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [storage, setStorage] = useState(true);
  const [caption, setCaption] = useState("");
  const [uploader, setUploader] = useState("");
  const [upload, setUpload] = useState<UploadState>({ busy: false, done: 0, total: 0, error: "" });

  useEffect(() => {
    fetch("/api/gallery", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { photos?: GalleryPhoto[]; storage?: boolean }) => {
        setPhotos(data.photos ?? []);
        setStorage(data.storage !== false);
      })
      .catch(() => setStorage(false));
  }, []);

  /** Each photo goes straight from the phone to blob storage, then its address is recorded. */
  const addPhotos = async (files: FileList | null) => {
    const chosen = Array.from(files ?? []);
    if (!chosen.length) return;
    const rejected = chosen.map(photoRejectionReason).find(Boolean);
    if (rejected) {
      setUpload({ busy: false, done: 0, total: 0, error: rejected });
      return;
    }

    setUpload({ busy: true, done: 0, total: chosen.length, error: "" });
    const { upload: uploadToBlob } = await import("@vercel/blob/client");
    const filedBy = cleanUploader(uploader);
    const note = caption.trim();

    for (const [index, file] of chosen.entries()) {
      try {
        const blob = await uploadToBlob(file.name, file, { access: "public", handleUploadUrl: "/api/gallery/upload" });
        const response = await fetch("/api/gallery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: blob.url, pathname: blob.pathname, caption: note, uploader: filedBy }),
        });
        const data = await response.json() as { photo?: GalleryPhoto; error?: string };
        if (!response.ok || !data.photo) throw new Error(data.error ?? "The gallery would not accept that photo.");
        setPhotos((current) => [data.photo!, ...current]);
        setUpload((current) => ({ ...current, done: index + 1 }));
      } catch (error) {
        setUpload({ busy: false, done: index, total: chosen.length, error: error instanceof Error ? error.message : "That upload did not finish." });
        return;
      }
    }
    setCaption("");
    setUpload({ busy: false, done: chosen.length, total: chosen.length, error: "" });
  };

  const removePhoto = async (photo: GalleryPhoto) => {
    if (!window.confirm("Remove this photo from the vault for everyone?")) return;
    const response = await fetch("/api/gallery", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: photo.id }) });
    if (response.ok) setPhotos((current) => current.filter((entry) => entry.id !== photo.id));
  };

  return <div className="gallery-page">
    <header className="gallery-heading"><div><p className="club-kicker">The trip photo vault</p><h2>Evidence from the grounds.</h2></div><p>The club archive, then everything filed since. Captions optional. Judgment guaranteed.</p></header>

    <section className="gallery-upload">
      <div><p className="club-kicker">Submit clubhouse evidence</p><h3>Accountant-assisted filing</h3><p>{storage ? "Upload the evidence before anyone has time to establish a consistent story. Everyone in the clubhouse sees what you file." : "Photo storage is not connected yet, so the vault is showing the club archive only."}</p></div>
      {storage ? <div className="gallery-fields">
        <label><span>Member or suspicious alias</span><input value={uploader} onChange={(event) => setUploader(event.target.value)} placeholder="Anonymous member" /></label>
        <label><span>Optional caption</span><input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Explain yourself, briefly" /></label>
        <label className="gallery-file"><input type="file" accept={photoAccept} capture="environment" multiple disabled={upload.busy} onChange={(event) => { void addPhotos(event.target.files); event.currentTarget.value = ""; }} /><span>{upload.busy ? `Filing ${upload.done + 1} of ${upload.total}…` : "Choose photos from iPhone"}</span></label>
      </div> : null}
      {upload.error ? <p role="alert" className="gallery-upload-error">{upload.error}</p> : null}
    </section>

    <section className="gallery-grid" aria-live="polite">
      {photos.map((photo) => <figure key={photo.id}>
        <Image src={photo.url} alt={photo.caption || `Photo filed by ${photo.uploader}`} fill sizes="(max-width: 700px) 100vw, 33vw" />
        <figcaption><strong>{photo.caption || "Untitled clubhouse evidence"}</strong><span>Filed by {photo.uploader}</span></figcaption>
        {canEdit ? <button type="button" className="gallery-remove" onClick={() => void removePhoto(photo)} aria-label="Remove this photo">Remove</button> : null}
      </figure>)}

      {loreItems.map((item, index) => <figure key={item.src} className="gallery-lore">
        <Image src={item.src} alt={item.title} fill sizes="(max-width: 700px) 100vw, 33vw" className="object-contain" />
        <figcaption><strong>{item.title}</strong><span>{item.caption}</span></figcaption>
        {lore ? <button type="button" className="gallery-open-file" onClick={() => lore.openLore(index)} aria-label={`Open clubhouse file: ${item.title}`}>Open file</button> : null}
      </figure>)}

      <figure className="gallery-video"><video src="/story/unlicensed-cart-operator.mp4" controls playsInline preload="metadata" aria-label="Golf cart video" /><figcaption><strong>Golf cart footage</strong></figcaption></figure>
    </section>
  </div>;
}
