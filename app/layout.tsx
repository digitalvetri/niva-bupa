import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Territory IQ",
  description: "AI-powered New Business Command Center for Insurance Territory Heads",
};

// Apply the saved theme before paint to avoid a flash. Dark is the default.
const THEME_INIT = `try{var t=localStorage.getItem('tiq-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
