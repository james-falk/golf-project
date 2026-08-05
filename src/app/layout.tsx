import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-club-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tournament-central-2026.vercel.app"),
  title: "East Coast Big Playas — Tournament Central",
  description: "The official posted results, tournament story, standings, and payouts of the East Coast Big Playas Invitational.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "East Coast Big Playas — Tournament Central",
    description: "Official posted results, standings, and payouts from Otsego Club.",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "East Coast Big Playas at Otsego Club" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "East Coast Big Playas — Tournament Central",
    description: "Official posted results, standings, and payouts from Otsego Club.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full`}
    >
      <body className="min-h-full bg-[#071b18] font-sans antialiased">{children}</body>
    </html>
  );
}
