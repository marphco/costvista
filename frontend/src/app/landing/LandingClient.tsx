// src/app/landing/LandingClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MotionConfig, motion, AnimatePresence } from "framer-motion";

/* ----------------------------- Content data ----------------------------- */
const features = [
  {
    title: "Instant clarity",
    desc: "Paste a CSV/JSON link or upload a file. Clean tables with min/median/max and top providers in seconds.",
    icon: UploadIcon,
  },
  {
    title: "Actionable comparisons",
    desc: "Focus the procedures that drive spend. Search by code or description; sort results instantly.",
    icon: FilterIcon,
  },
  {
    title: "Share & decide",
    desc: "Export CSV or an executive summary stakeholders will actually read.",
    icon: ShareIcon,
  },
];

const steps = [
  ["Link or upload", "Use any public transparency file or your local sample."],
  ["Pick procedures", "Search by code or description — no need to memorize CPT."],
  ["Compare & export", "Spot opportunities and share a clear summary."],
];

const faqs = [
  {
    q: "Do I need huge uploads?",
    a: "For the MVP you can upload a sample file or paste a link. We focus on the most relevant rows so you don’t wait hours.",
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

/* ----------------------------- Motion helpers ---------------------------- */
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } };

/* --------------------------------- Page --------------------------------- */
export default function LandingClient() {
  const [open, setOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
        {/* ------------------------------- Header ------------------------------- */}
        <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
          <div className="mx-auto max-w-6xl px-3 md:px-4 py-3 flex items-center justify-between">
            <Link href="/landing" className="flex items-center gap-3">
              {/* Logo: niente toppa, solo glow/drop-shadow per contrasto */}
              <Image
                src="/assets/costvista.svg"
                alt="Costvista"
                width={172}
                height={48}
                priority
                className="h-9 md:h-10 w-auto drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] [filter:brightness(1.15)]"
              />
              <span className="sr-only">Costvista</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4">
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

            {/* Mobile button */}
            <button
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded border border-white/15 hover:bg-white/10"
            >
              <MenuIcon open={open} />
            </button>
          </div>

          {/* Mobile menu (animated) */}
          <AnimatePresence>
            {open && (
              <motion.nav
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="md:hidden border-t border-white/10 bg-black/40 backdrop-blur"
              >
                <div className="mx-auto max-w-6xl px-3 py-3 flex flex-col gap-2">
                  <a onClick={() => setOpen(false)} href="#features" className="px-2 py-2 rounded hover:bg-white/10">
                    Features
                  </a>
                  <a onClick={() => setOpen(false)} href="#how" className="px-2 py-2 rounded hover:bg-white/10">
                    How it works
                  </a>
                  <a onClick={() => setOpen(false)} href="#faq" className="px-2 py-2 rounded hover:bg-white/10">
                    FAQ
                  </a>
                  <Link
                    onClick={() => setOpen(false)}
                    href="/"
                    className="mt-1 inline-flex w-full items-center justify-center rounded border border-white/20 px-3 py-2 hover:bg-white/10"
                  >
                    Try demo
                  </Link>
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        {/* -------------------------------- Hero -------------------------------- */}
        <section className="relative overflow-hidden">
          {/* === SFONDO STATICO (radial gradient + vignette, zero motion) === */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0
                       [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
          >
            <div className="absolute inset-0
                            bg-[radial-gradient(1000px_600px_at_20%_-10%,rgba(56,189,248,.18),transparent),
                                radial-gradient(800px_400px_at_80%_10%,rgba(14,165,233,.12),transparent),
                                linear-gradient(to_bottom,rgba(2,6,23,.35),transparent)]" />
            <div className="absolute inset-x-0 bottom-0 h-px
                            bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="relative mx-auto max-w-6xl px-3 md:px-4 py-16 md:py-24">
            <motion.div
              variants={fadeUp}
              initial="initial"
              whileInView="animate"
              transition={{ duration: 0.6, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.4 }}
              className="max-w-3xl"
            >
              <h1 className="text-balance text-4xl md:text-6xl font-semibold leading-tight">
                Healthcare price transparency,
                <span className="block text-sky-300">finally usable.</span>
              </h1>
              <p className="mt-4 md:mt-5 text-base md:text-lg text-slate-300">
                Costvista turns massive machine-readable files into crisp comparisons for
                brokers, HR and self-insured employers. Focus on what drives costs — not on parsing gigabytes.
              </p>

              {/* Trust cues */}
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

              <div className="mt-7 md:mt-8 flex flex-wrap gap-3">
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
              className="mt-10 md:mt-14"
            >
              <div className="relative rounded-2xl border border-white/10 bg-white/5 shadow-2xl overflow-hidden">
                <div className="px-4 py-2 text-xs text-slate-300 border-b border-white/10">
                  Preview — Executive Summary
                </div>
                <div className="p-3 md:p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
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
                    <Link href="/" className="text-sky-300 hover:underline text-xs md:text-sm">
                      Open demo →
                    </Link>
                    <span className="text-[10px] md:text-xs text-slate-400">Sample data for illustration</span>
                  </div>
                </div>

                {/* base glow */}
                <div className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[42rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ------------------------------- Features ------------------------------ */}
        <section
          id="features"
          className="mx-auto max-w-6xl px-3 md:px-4 py-12 md:py-16 grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
        >
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 * idx }}
                viewport={{ once: true, amount: 0.4 }}
                className="rounded-2xl border border-white/10 p-5 md:p-6 bg-white/5 hover:-translate-y-1 hover:shadow-lg transition"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15">
                  <Icon className="h-5 w-5 text-sky-300" />
                </div>
                <h3 className="text-base md:text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 md:mt-2 text-slate-300 text-sm md:text-base">{f.desc}</p>
              </motion.div>
            );
          })}
        </section>

        {/* ----------------------------- How it works ---------------------------- */}
        <section id="how" className="mx-auto max-w-6xl px-3 md:px-4 py-12 md:py-16">
          <h2 className="text-xl md:text-2xl font-semibold mb-6 md:mb-8">How it works</h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            {steps.map(([t, d], i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, delay: 0.05 * i }}
                viewport={{ once: true, amount: 0.3 }}
                className="rounded-2xl border border-white/10 p-5 md:p-6 bg-white/5 hover:shadow-lg transition"
              >
                <div className="text-sky-300 font-bold text-2xl md:text-3xl mb-2">{i + 1}</div>
                <h3 className="font-medium">{t}</h3>
                <p className="mt-1 text-slate-300 text-sm md:text-base">{d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --------------------------------- CTA --------------------------------- */}
        <section className="mx-auto max-w-6xl px-3 md:px-4 pb-12 md:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, amount: 0.5 }}
            className="rounded-2xl border border-white/10 p-6 md:p-8 bg-[linear-gradient(120deg,rgba(56,189,248,0.15),transparent)]"
          >
            <div className="md:flex items-center justify-between gap-6">
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">See your costs clearly.</h3>
                <p className="text-slate-300 mt-1 text-sm md:text-base">
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

        {/* --------------------------------- FAQ --------------------------------- */}
        <section id="faq" className="mx-auto max-w-6xl px-3 md:px-4 pb-20">
          <h3 className="text-lg md:text-xl font-semibold mb-5 md:mb-6">FAQ</h3>
          <div className="space-y-3 md:space-y-4">
            {faqs.map((f, idx) => (
              <motion.details
                key={f.q}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.05 * idx }}
                viewport={{ once: true, amount: 0.4 }}
                className="rounded-2xl border border-white/10 p-4 md:p-5 bg-white/5"
              >
                <summary className="cursor-pointer select-none font-medium">{f.q}</summary>
                <p className="mt-2 text-slate-300 text-sm md:text-base">{f.a}</p>
              </motion.details>
            ))}
          </div>
        </section>

        {/* -------------------------------- Footer -------------------------------- */}
        <footer className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-3 md:px-4 py-6 md:py-8 text-xs md:text-sm text-slate-400 flex items-center justify-between">
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

/* --------------------------------- Icons -------------------------------- */
function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path strokeWidth="2" strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor">
      <path strokeWidth="2" d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path strokeWidth="2" d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
    </svg>
  );
}
function FilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor">
      <path strokeWidth="2" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}
function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor">
      <path strokeWidth="2" d="M8 12l8-5v10l-8-5z" />
      <circle cx="5" cy="12" r="2" strokeWidth="2" />
      <circle cx="19" cy="5" r="2" strokeWidth="2" />
      <circle cx="19" cy="19" r="2" strokeWidth="2" />
    </svg>
  );
}
