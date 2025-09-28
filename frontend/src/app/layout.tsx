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
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    // other: [
    //   { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#0B1220" }, // opzionale
    // ],
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}

