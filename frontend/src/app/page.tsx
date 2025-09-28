// src/app/page.tsx
import type { Metadata } from "next";
import LandingClient from "./landing/LandingClient";

export const metadata: Metadata = {
  title: "CostVista — Price transparency made usable",
  description:
    "CostVista transforms massive healthcare price files into clean comparisons for brokers, HR, and employers.",
};

export default function Home() {
  return <LandingClient />;
}
