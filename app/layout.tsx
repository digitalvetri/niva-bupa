import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Territory IQ",
  description: "AI-powered New Business Command Center for Insurance Territory Heads",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
