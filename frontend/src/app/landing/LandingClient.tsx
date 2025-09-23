// src/app/landing/LandingClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { MotionConfig, motion } from "framer-motion";

const features = [
  {
    title: "Instant clarity",
    desc: "Paste a CSV/JSON link or upload a file. Get clean tables with min/median/max and top providers in seconds.",
  },
  {
    title: "Actionable comparisons",
    desc: "Focus on the procedures that drive spend. Filter by codes or keywords and sort results instantly.",
  },
  {
    title: "Share & decide",
    desc: "Export CSV or an executive summary your stakeholders will actually read.",
  },
];

const steps = [
  ["Link or upload", "Use any public transparency file or your local sample."],
  ["Pick procedures", "Search by code or description — no need to memorize CPT."],
  ["Compare & export", "Identify opportunities and share a clear summary."],
];

const faqs = [
  {
    q: "Do I need huge uploads?",
    a: "For the MVP you can upload a sample file or paste a link. We focus on the most relevant rows so you don’t wait for hours.",
  },
  {
    q: "Is PHI involved?",
    a: "No. We work with public transparency files (MRFs) or non-identifiable data you provide for testing.",
  },
  {
    q: "Who is it for?",
    a: "Benefits brokers, HR and self-insured employers who need fast, defensible price comparisons.",
  },
];

// Framer Motion: variants corretti (transition separata)
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export default function LandingClient() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/landing" className="flex items-center gap-3">
              {/* Badge bianco per contrasto + logo più grande */}
              <span className="inline-flex items-center rounded-lg bg-white px-2 py-1 shadow-lg">
                <Image
                  src="/assets/costvista.svg"
                  alt="Costvista"
                  width={160}
                  height={44}
                  priority
                  className="h-8 w-auto"
                />
              </span>
            </Link>
            <nav className="flex items-center gap-3">
              <a href="#features" className="text-sm opacity-80 hover:opacity-100">
                Features
              </a>
              <a href="#how" className="text-sm opacity-80 hover:opacity-100">
                How it works
              </a>
              <a href="#faq" className="text-sm opacity-80 hover:opacity-100">
                FAQ
              </a>
              <Link
                href="/"
                className="text-sm px-3 py-1.5 rounded border border-white/20 hover:bg-white/10"
              >
                Try demo
              </Link>
            </nav>
          </div>
        </header>

        {/* HERO con bokeh animato */}
        <section className="relative overflow-hidden">
          {/* Bokeh: cerchi sfumati animati */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-24 h-[36rem] w-[36rem] rounded-full bg-sky-500/15 blur-3xl animate-pulse" />
            <div className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl animate-[ping_6s_linear_infinite]" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
            <motion.div
              variants={fadeUp}
              initial="initial"
              whileInView="animate"
              transition={{ duration: 0.6, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.4 }}
              className="max-w-3xl"
            >
              <h1 className="text-4xl md:text-6xl font-semibold leading-tight">
                Healthcare price transparency,
                <span className="block text-sky-300">finally usable.</span>
              </h1>
              <p className="mt-5 text-lg text-slate-300">
                Costvista turns massive machine-readable files into crisp comparisons for
                brokers, HR and self-insured employers. Focus on what drives costs — not on
                parsing gigabytes.
              </p>

              {/* Safety cues */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  No signup • No install
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                  Public data only (no PHI)
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="px-5 py-3 rounded-lg bg-sky-500 text-black font-medium hover:bg-sky-400 transition"
                >
                  Try the live demo
                </Link>
                <a
                  href="#features"
                  className="px-5 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition"
                >
                  See features
                </a>
              </div>
            </motion.div>

            {/* Mock preview */}
            <motion.div
              variants={fadeIn}
              initial="initial"
              whileInView="animate"
              transition={{ duration: 0.6, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.3 }}
              className="mt-14"
            >
              <div className="relative rounded-2xl border border-white/10 bg-white/5 shadow-2xl overflow-hidden">
                <div className="px-4 py-2 text-xs text-slate-300 border-b border-white/10">
                  Preview — Executive Summary
                </div>
                <div className="p-4 md:p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-left p-2">Code</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Median</th>
                          <th className="text-right p-2">P25–P75</th>
                          <th className="text-left p-2">Top providers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["70551", "MRI brain without contrast", "$876", "$859–$893", "General • Metro"],
                          ["66984", "Cataract surgery w/ IOL", "$3,000", "$2,950–$3,050", "General • Metro"],
                          ["74177", "CT abdomen/pelvis w/ contrast", "$1,230", "$1,215–$1,248", "General • Metro"],
                        ].map((r, i) => (
                          <tr key={i} className="border-t border-white/10">
                            <td className="p-2">{r[0]}</td>
                            <td className="p-2">{r[1]}</td>
                            <td className="p-2 text-right">{r[2]}</td>
                            <td className="p-2 text-right">{r[3]}</td>
                            <td className="p-2">{r[4]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Link href="/" className="text-sky-300 hover:underline text-sm">
                      Open demo →
                    </Link>
                    <span className="text-xs text-slate-400">Sample data for illustration</span>
                  </div>
                </div>

                {/* Glow bottom */}
                <div className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[42rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 grid md:grid-cols-3 gap-6">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 * idx }}
              viewport={{ once: true, amount: 0.4 }}
              className="rounded-2xl border border-white/10 p-6 bg-white/5 hover:-translate-y-1 hover:shadow-lg transition"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-slate-300">{f.desc}</p>
            </motion.div>
          ))}
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold mb-8">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map(([t, d], i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, delay: 0.05 * i }}
                viewport={{ once: true, amount: 0.3 }}
                className="rounded-2xl border border-white/10 p-6 bg-white/5 hover:shadow-lg transition"
              >
                <div className="text-sky-300 font-bold text-3xl mb-2">{i + 1}</div>
                <h3 className="font-medium">{t}</h3>
                <p className="mt-1 text-slate-300">{d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, amount: 0.5 }}
            className="rounded-2xl border border-white/10 p-6 md:p-8 bg-[linear-gradient(120deg,rgba(56,189,248,0.15),transparent)]"
          >
            <div className="md:flex items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-semibold">See your costs clearly.</h3>
                <p className="text-slate-300 mt-1">
                  Upload a sample file or paste a link — get a decision-ready summary.
                </p>
              </div>
              <Link
                href="/"
                className="mt-4 md:mt-0 inline-flex px-5 py-3 rounded-lg bg-sky-500 text-black font-medium hover:bg-sky-400 transition"
              >
                Try the live demo
              </Link>
            </div>
          </motion.div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-6xl px-4 pb-24">
          <h3 className="text-xl font-semibold mb-6">FAQ</h3>
          <div className="space-y-4">
            {faqs.map((f, idx) => (
              <motion.details
                key={f.q}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.05 * idx }}
                viewport={{ once: true, amount: 0.4 }}
                className="rounded-2xl border border-white/10 p-5 bg-white/5"
              >
                <summary className="cursor-pointer select-none font-medium">
                  {f.q}
                </summary>
                <p className="mt-2 text-slate-300">{f.a}</p>
              </motion.details>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-400 flex items-center justify-between">
            <span>© {new Date().getFullYear()} Costvista</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="hover:underline">Demo</Link>
              <a href="#features" className="hover:underline">Features</a>
              <a href="#faq" className="hover:underline">FAQ</a>
            </div>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
