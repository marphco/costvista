// src/app/page.tsx  (HOME = landing)
import type { Metadata } from "next";
import LandingClient from "./landing/LandingClient";

export const metadata: Metadata = {
  title: "Costvista — Price transparency made usable",
  description:
    "Turn massive healthcare machine-readable files into crisp, comparable insights. Built for brokers, HR and self-insured employers.",
};

export default function Home() {
  return <LandingClient />;
}
