export type GalleryPhoto = {
  id: string;
  url: string;
  pathname: string;
  caption: string;
  uploader: string;
  createdAt: string;
};

/**
 * iPhones shoot HEIC, which most browsers cannot render in an <img>. The file
 * input advertises these types so iOS transcodes to JPEG as the photo is picked,
 * and the server refuses anything that slipped past.
 */
export const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
export const photoAccept = allowedPhotoTypes.join(",");

/** Comfortably above an iPhone photo, well under anything that would be a video. */
export const maxPhotoBytes = 15 * 1024 * 1024;

export function isAllowedPhotoType(contentType: string | undefined) {
  return Boolean(contentType && allowedPhotoTypes.includes(contentType.toLowerCase()));
}

export function photoRejectionReason(file: { type?: string; size?: number; name?: string }) {
  if (!isAllowedPhotoType(file.type)) {
    return `${file.name ?? "That file"} is not a photo the gallery can show. Pick a JPEG, PNG or WebP.`;
  }
  if ((file.size ?? 0) > maxPhotoBytes) {
    return `${file.name ?? "That file"} is larger than ${Math.round(maxPhotoBytes / 1024 / 1024)} MB.`;
  }
  return null;
}

/** Captions and names are shown to everyone, so they are trimmed and bounded. */
export function cleanCaption(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 140) : "";
}

export function cleanUploader(value: unknown) {
  const name = typeof value === "string" ? value.trim().slice(0, 40) : "";
  return name || "Anonymous member";
}

/** Only blobs this store actually issued may be recorded against the gallery. */
export function isVercelBlobUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
