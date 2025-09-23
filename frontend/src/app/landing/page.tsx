// src/app/landing/page.tsx
import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "Costvista — Price transparency made usable",
  description:
    "Turn massive healthcare machine-readable files into crisp, comparable insights. Built for brokers, HR and self-insured employers.",
};

export default function Page() {
  return <LandingClient />;
}
