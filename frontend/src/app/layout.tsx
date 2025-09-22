// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

// (rimuovi questi import se non usi i font nel className del body)
// import { Geist, Geist_Mono } from "next/font/google";

export const metadata: Metadata = {
  title: "Costvista – MVP",
  description: "Healthcare price transparency",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* aggiungi suppressHydrationWarning anche qui */}
      <body suppressHydrationWarning className="antialiased bg-black text-slate-100">
        {children}
      </body>
    </html>
  );
}
