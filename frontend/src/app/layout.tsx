// frontend/src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#0B1220",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://costvista.com"),
  title: "CostVista",
  description: "Healthcare price transparency made usable.",
  applicationName: "CostVista",
  icons: {
        icon: '/icon.svg', // For general favicons
        apple: '/apple-icon.png', // For Apple touch icons
        shortcut: '/favicon.ico', // For legacy favicon.ico
      },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
