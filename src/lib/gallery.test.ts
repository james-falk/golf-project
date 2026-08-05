import { describe, expect, it } from "vitest";
import { cleanCaption, cleanUploader, isAllowedPhotoType, isVercelBlobUrl, maxPhotoBytes, photoRejectionReason } from "./gallery";

describe("what the photo vault will accept", () => {
  it("takes the formats every browser can actually render", () => {
    expect(isAllowedPhotoType("image/jpeg")).toBe(true);
    expect(isAllowedPhotoType("image/png")).toBe(true);
    expect(isAllowedPhotoType("image/webp")).toBe(true);
  });

  it("refuses HEIC, video and anything unrecognised", () => {
    expect(isAllowedPhotoType("image/heic")).toBe(false);
    expect(isAllowedPhotoType("video/mp4")).toBe(false);
    expect(isAllowedPhotoType("application/pdf")).toBe(false);
    expect(isAllowedPhotoType(undefined)).toBe(false);
  });

  it("explains why a file was turned away", () => {
    expect(photoRejectionReason({ type: "image/jpeg", size: 4_000_000, name: "18th.jpg" })).toBeNull();
    expect(photoRejectionReason({ type: "video/quicktime", size: 100, name: "cart.mov" })).toMatch(/not a photo/);
    expect(photoRejectionReason({ type: "image/jpeg", size: maxPhotoBytes + 1, name: "huge.jpg" })).toMatch(/larger than/);
  });
});

describe("what gets shown next to a photo", () => {
  it("trims and bounds captions and names", () => {
    expect(cleanCaption("  the 7th went badly  ")).toBe("the 7th went badly");
    expect(cleanCaption("x".repeat(400))).toHaveLength(140);
    expect(cleanCaption(undefined)).toBe("");
    expect(cleanUploader("   ")).toBe("Anonymous member");
    expect(cleanUploader("Jeff")).toBe("Jeff");
    expect(cleanUploader("y".repeat(90))).toHaveLength(40);
  });
});

describe("only this gallery's own blobs may be recorded", () => {
  it("accepts a Vercel blob address", () => {
    expect(isVercelBlobUrl("https://abc123.public.blob.vercel-storage.com/photo-x1.jpg")).toBe(true);
  });

  it("rejects anything else, including lookalike hosts", () => {
    expect(isVercelBlobUrl("https://evil.com/photo.jpg")).toBe(false);
    expect(isVercelBlobUrl("https://public.blob.vercel-storage.com.evil.com/x.jpg")).toBe(false);
    expect(isVercelBlobUrl("http://abc.public.blob.vercel-storage.com/x.jpg")).toBe(false);
    expect(isVercelBlobUrl("javascript:alert(1)")).toBe(false);
    expect(isVercelBlobUrl(undefined)).toBe(false);
  });
});
