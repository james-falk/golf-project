import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Gallery photos live in Vercel Blob. Serving them through the image
    // optimizer keeps a 4 MB iPhone photo from being sent at full size to
    // every viewer, which is what would actually burn through the free tier.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
