// src/app/landing/HeroCinematic.tsx
"use client";

import * as React from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";

/* =========================
   Config: timelines & types
   ========================= */

type Scene = 0 | 1 | 2; // 0 Upload, 1 Processing, 2 Ready
type Point = { x: number; y: number };
type Ease = Transition["ease"];

type Keyframe = {
  to: Point;
  duration: number;
  ease?: Ease;
  click?: boolean;
  waitAfterMs?: number;
};

type Timeline = {
  upload: Keyframe[];
  processingBarMs: number;
  ready: Keyframe[];
};

// AnimatePresence exit timing
const EXIT_MS = 280;
const EASE_DEFAULT: Ease = "easeOut";

/** ⬇ TUNE AREA: coord & timing ⬇ */

// DESKTOP (tuoi valori — invariati)
const DESKTOP_TIMELINE: Timeline = {
  upload: [
    { to: { x: 18, y: 92 }, duration: 1.2, ease: "easeOut" },
    { to: { x: 52, y: 226 }, duration: 1.2, ease: "easeInOut", click: true, waitAfterMs: 600 },
  ],
  processingBarMs: 1600,
  ready: [{ to: { x: 940, y: 170 }, duration: 1.2, ease: "easeOut", click: true, waitAfterMs: 1400 }],
};

// MOBILE (placeholder iniziale: modificalo liberamente)
const MOBILE_TIMELINE: Timeline = {
  upload: [
    { to: { x: 22, y: 58 }, duration: 1.0, ease: "easeOut" },
    { to: { x: 56, y: 310 }, duration: 1.1, ease: "easeInOut", click: true, waitAfterMs: 500 },
  ],
  processingBarMs: 1400,
  ready: [{ to: { x: 250, y: 180 }, duration: 1.0, ease: "easeOut", click: true, waitAfterMs: 1100 }],
};

// Altezza fissa del box scene (evita shift del layout)
const SCENE_H_DESKTOP = 280; // px
const SCENE_H_MOBILE = 350;  // px

/** ↑ FINE TUNE AREA ↑ **/

// Alias controls (tip-safe, una sola definizione)
type Controls = ReturnType<typeof useAnimation>;

export default function HeroCinematic() {
  const [scene, setScene] = React.useState<Scene>(0);
  const [paused, setPaused] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  const cursor = useAnimation();
  const click = useAnimation();
  const progress = useAnimation();

  const runIdRef = React.useRef(0);

  // Breakpoint (<=768)
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  const hardStop = React.useCallback(() => {
    cursor.stop();
    click.stop();
    progress.stop();
  }, [cursor, click, progress]);

  // Pausa solo desktop (hover). Su mobile è disabilitata.
  const requestPause = React.useCallback(() => {
    if (isMobile) return;
    setPaused(true);
    hardStop();
    runIdRef.current += 1; // invalida subito la timeline corrente
  }, [hardStop, isMobile]);

  const requestResume = React.useCallback(() => {
    if (isMobile) return;
    if (!paused) return;
    setPaused(false);
  }, [paused, isMobile]);

  React.useEffect(() => {
    if (paused) return;

    const timeline = isMobile ? MOBILE_TIMELINE : DESKTOP_TIMELINE;
    let cancelled = false;
    const myRun = ++runIdRef.current;

    const isCancelled = () => cancelled || myRun !== runIdRef.current || paused;

    const waitCancellable = (ms: number) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = () => {
          if (isCancelled()) return resolve();
          const now = performance.now();
          if (now - start >= ms) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    const clickFlash = async (ctrl: Controls) => {
      if (isCancelled()) return;
      await ctrl.start({ scale: 1, opacity: 0.8, transition: { duration: 0.08 } });
      if (isCancelled()) return;
      await ctrl.start({ scale: 1.25, opacity: 0, transition: { duration: 0.28 } });
    };

    const moveCursor = async (kf: Keyframe) => {
      if (isCancelled()) return;
      await cursor.start({
        x: kf.to.x,
        y: kf.to.y,
        transition: { duration: kf.duration, ease: kf.ease ?? EASE_DEFAULT },
      });
      if (isCancelled()) return;
      if (kf.click) await clickFlash(click);
      if (isCancelled()) return;
      if (kf.waitAfterMs) await waitCancellable(kf.waitAfterMs);
    };

    (async () => {
      while (!isCancelled()) {
        // Scene 0
        setScene(0);
        for (const kf of timeline.upload) {
          await moveCursor(kf);
          if (isCancelled()) break;
        }
        if (isCancelled()) break;

        // Scene 1
        setScene(1);
        await waitCancellable(EXIT_MS + 40); // attendi il mount
        await progress.start({ width: "0%" });
        if (isCancelled()) break;
        await progress.start({
          width: "100%",
          transition: { duration: timeline.processingBarMs / 1000, ease: [0.22, 1, 0.36, 1] },
        });
        if (isCancelled()) break;
        await waitCancellable(300);

        // Scene 2
        setScene(2);
        await waitCancellable(EXIT_MS + 40);
        for (const kf of timeline.ready) {
          await moveCursor(kf);
          if (isCancelled()) break;
        }
        if (isCancelled()) break;

        await waitCancellable(400); // respiro prima del loop
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paused, isMobile, cursor, click, progress]);

  // height fissa del box scene
  const sceneHeight = (isMobile ? SCENE_H_MOBILE : SCENE_H_DESKTOP) + "px";
  const pauseLabelDesktop = paused ? "Paused — Click or hover out" : "Hover to pause";

  return (
    <div
      onMouseEnter={requestPause}
      onMouseLeave={requestResume}
      className="relative rounded-2xl border border-white/10 bg-white/5 shadow-2xl overflow-hidden"
      aria-label="Costvista cinematic demo"
    >
      <div className="px-4 py-2 text-xs text-slate-300 border-b border-white/10">
        Live preview — From file to shareable summary
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[42rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl"
      />

      {/* WRAPPER con height fissa delle scene */}
      <div className="relative p-4 md:p-6">
        <div className="relative w-full overflow-hidden" style={{ height: sceneHeight }}>
          {/* Cursor: sopra ai componenti */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 z-50"
            animate={cursor}
            initial={{ x: 16, y: 40 }}
          >
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-white/90 shadow" />
              <motion.span
                className="absolute -inset-3 rounded-full border border-white/40"
                animate={click}
                initial={{ scale: 0.6, opacity: 0 }}
                style={{ pointerEvents: "none" }}
              />
            </div>
          </motion.div>

          {/* SCENES sovrapposte (no layout shift) */}
          <AnimatePresence mode="wait">
            {scene === 0 && <SceneUpload key="s0" />}
            {scene === 1 && <SceneProcessing key="s1" progress={progress} />}
            {scene === 2 && <SceneReady key="s2" />}
          </AnimatePresence>
        </div>

        {/* chips + badge pausa allineato a destra su DESKTOP;
            su MOBILE: i chip stanno su un solo rigo (scroll orizzontale) e niente pausa */}
        <div className="mt-5 flex items-center gap-2 text-[9.5px] md:text-xs">
          <div
            className={[
              "min-w-0 flex items-center gap-1",
              "flex-nowrap overflow-x-auto whitespace-nowrap",
              // nascondo scrollbar su Mobile (tailwind JIT)
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            ].join(" ")}
          >
            <Chip active={scene === 0}>Upload or paste URL</Chip>
            <Dot />
            <Chip active={scene === 1}>Normalizing & aligning</Chip>
            <Dot />
            <Chip active={scene === 2}>Summary ready</Chip>
          </div>

          {/* badge pausa: solo desktop, nella stessa riga */}
          <div className="ml-auto hidden md:flex">
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full",
                "border border-white/30 bg-black/70 px-3 py-1.5 backdrop-blur",
                "text-xs text-white/90",
              ].join(" ")}
              aria-live="polite"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor">
                {paused ? (
                  <path strokeWidth="2" d="M6 12l6 6 6-6M12 6v12" />
                ) : (
                  <path strokeWidth="2" d="M8 6h3v12H8zm5 0h3v12h-3z" />
                )}
              </svg>
              <span className="font-medium">{pauseLabelDesktop}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Scenes --------------------------------
   Le scene sono assolute (inset-0) dentro al box a height fissa.
--------------------------------------------------------------------------- */

function SceneUpload() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 z-10 space-y-3 md:space-y-5"
    >
      <div className="text-sm text-slate-300">Start with your file</div>
      <div className="grid md:grid-cols-2 gap-3">
        <Panel>
          <Label>Paste URL</Label>
          <Field>https://hospital.org/prices/sample_hospital_mrf.csv</Field>
        </Panel>
        <Panel>
          <Label>Or upload</Label>
          <ButtonGhost>
            <span className="truncate">choose file…</span>
            <Chevron />
          </ButtonGhost>
        </Panel>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip>CSV / JSON</Chip>
        <Chip>Max 50MB (demo)</Chip>
        <Chip>No signup</Chip>
      </div>
      <ButtonPrimary>Analyze</ButtonPrimary>
    </motion.div>
  );
}

function SceneProcessing({ progress }: { progress: Controls }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 z-10 space-y-3 md:space-y-5"
    >
      <div className="text-sm text-slate-300">Processing</div>

      <Panel>
        <div className="text-xs text-slate-400 mb-2">Normalizing headers…</div>
        <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
          <motion.div className="h-2 rounded bg-sky-400/80" animate={progress} initial={{ width: "0%" }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] md:text-xs">
          <Tag>Mapping codes</Tag>
          <Tag>Coercing numbers</Tag>
          <Tag>Aligning tables</Tag>
        </div>
      </Panel>

      <Panel subtle>
        <div className="text-xs text-slate-400">What you’ll get</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MiniStat title="Median" value="auto" />
          <MiniStat title="P25–P75" value="ready" />
          <MiniStat title="Shareable" value="summary" />
        </div>
      </Panel>
    </motion.div>
  );
}

function SceneReady() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 z-10 space-y-3 md:space-y-5"
    >
      <div className="text-sm text-slate-300">Done in minutes</div>

      <Panel>
        <div className="flex items-center gap-3">
          <Spark />
          <div>
            <div className="text-slate-100 font-medium">Decision-ready summary</div>
            <div className="text-xs text-slate-400">
              Clean, defensible comparisons for your stakeholders.
            </div>
          </div>
        </div>

        <div className="mt-3 md:mt-4 flex flex-wrap gap-2">
          <Badge>Filter by provider / code</Badge>
          <Badge>Median & ranges</Badge>
          <Badge>CSV / PDF export</Badge>
        </div>

        <div className="mt-3 md:mt-4 flex gap-2">
          <ButtonGhost>Export rows (CSV)</ButtonGhost>
          <motion.button whileHover={{ scale: 1.02 }} className="rounded-lg bg-sky-500 text-black px-4 py-2 text-sm font-medium hover:bg-sky-400">
            Export summary
          </motion.button>
        </div>
      </Panel>
    </motion.div>
  );
}

/* ------------------------------- UI Bits ------------------------------- */

function Panel({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <div
      className={[
        "rounded-xl border p-3 md:p-4",
        subtle ? "border-white/10 bg-black/20" : "border-white/10 bg-white/5",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-400">{children}</div>;
}
function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 truncate">
      {children}
    </div>
  );
}
function ButtonPrimary({ children }: { children: React.ReactNode }) {
  return <button className="rounded-lg bg-sky-500 text-black px-4 py-2 text-sm font-medium hover:bg-sky-400">{children}</button>;
}
function ButtonGhost({ children }: { children: React.ReactNode }) {
  return (
    <button className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between">
      {children}
    </button>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
      <span className="text-[11px] text-slate-300">{children}</span>
    </span>
  );
}
function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
      <div className="text-[10px] text-slate-400">{title}</div>
      <div className="text-sm text-slate-100">{value}</div>
    </div>
  );
}
function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-lg border px-2.5 py-1",
        active ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-white/10 bg-white/5 text-slate-300",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200">{children}</span>;
}
function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-white/20" />;
}
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <path strokeWidth="2" d="M7 10l5 5 5-5" />
    </svg>
  );
}
function Spark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-300" fill="none" stroke="currentColor">
      <path strokeWidth="2" d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
    </svg>
  );
}
