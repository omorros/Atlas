import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Counterparty Risk Radar",
  description: "Cursor x Briefcase London 2026 — Track 02",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
