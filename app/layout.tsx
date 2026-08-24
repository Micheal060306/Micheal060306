import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://zeralytics.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Zeralytics — Digital Growth. Engineered to Perform.",
    template: "%s — Zeralytics",
  },
  description:
    "Zeralytics builds performance-driven digital systems that help ambitious brands attract, convert and scale. Strategy, creative, media and technology under one roof.",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Zeralytics",
    title: "Zeralytics — Digital Growth. Engineered to Perform.",
    description:
      "Zeralytics builds performance-driven digital systems that help ambitious brands attract, convert and scale.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeralytics — Digital Growth. Engineered to Perform.",
    description:
      "Zeralytics builds performance-driven digital systems that help ambitious brands attract, convert and scale.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-gold focus:text-on-gold focus:px-4 focus:py-3 font-mono-label"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1 pt-[76px]">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
