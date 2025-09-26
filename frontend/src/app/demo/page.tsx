// src/app/demo/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { MotionConfig, motion } from "framer-motion";

/* ============================
   Demo paths (unica fonte)
============================ */
const DEMO_PATHS = [
  "/data/sample_hospital_mrf.csv",
  "/data/sample_hospital_mrf.json",
  "/data/sample_hospital_mrf_plan_b.csv",
  "/data/sample_hospital_mrf_plan_c.json",
] as const;

type DemoPath = (typeof DEMO_PATHS)[number];

const DEMO_LABEL: Record<DemoPath, string> = {
  "/data/sample_hospital_mrf.csv": "Plan A (CSV)",
  "/data/sample_hospital_mrf.json": "Plan A (JSON)",
  "/data/sample_hospital_mrf_plan_b.csv": "Plan B (CSV)",
  "/data/sample_hospital_mrf_plan_c.json": "Plan C (JSON)",
};

function isDemoPath(x: string): x is DemoPath {
  return (DEMO_PATHS as readonly string[]).includes(x);
}

/* ============================
   Types
============================ */
type Source =
  | { kind: "upload"; name: string; size: number; type: string }
  | { kind: "demo"; path: DemoPath }
  | { kind: "url"; href: string };

type Row = {
  provider_name?: string;
  code_type?: string;
  code?: string | number;
  description?: string;
  rate_type?: string;
  negotiated_rate: number;
  geo?: string;
  last_updated?: string;
  source?: string; // tag della sorgente (aggiunto lato client)
  [k: string]: unknown;
};

type TopItem = { provider_name: string; negotiated_rate: number };

type Summary = {
  code: string;
  description: string;
  count: number;
  min: number;
  median: number;
  max: number;
  p25: number;
  p75: number;
  top3: TopItem[];
};

type ApiSummaryResponse = { rows?: Row[]; summary?: Summary[] };
type ApiError = { detail?: string; error?: string; message?: string; suggestions?: string[] };

type CodeItem = { code: string; label: string };
type CodeChip = { code: string; label: string };
type Dir = "asc" | "desc";

/* ============================
   Type guards
============================ */
const hasDetail = (x: unknown): x is { detail: unknown } =>
  typeof x === "object" && x !== null && "detail" in x;

const isApiErrorShape = (x: unknown): x is ApiError =>
  typeof x === "object" && x !== null && ("detail" in x || "error" in x || "message" in x);

const isApiSummaryShape = (x: unknown): x is ApiSummaryResponse =>
  typeof x === "object" && x !== null && ("rows" in x || "summary" in x);

/* ============================
   Utils
============================ */
const currency = (n: number | undefined) => `$${Number(n ?? 0).toFixed(2)}`;
const contains = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());

const COMMON_CPT: CodeItem[] = [
  { code: "70551", label: "MRI brain without contrast" },
  { code: "74177", label: "CT abdomen/pelvis with contrast" },
  { code: "45378", label: "Colonoscopy (diagnostic)" },
  { code: "66984", label: "Cataract surgery w/ IOL" },
  { code: "77067", label: "Screening mammography, bilateral" },
  { code: "97110", label: "Therapeutic exercises" },
  { code: "36415", label: "Collection of venous blood" },
  { code: "99213", label: "Office/outpatient visit, established" },
];

// filtri pre-analisi
const extractCodesFromText = (text: string): string[] => {
  const found = text.match(/\b\d{4,5}\b/g) || [];
  return Array.from(new Set(found));
};
const getCodesToSend = (chips: { code: string }[], currentQuery: string): string[] => {
  const fromChips = chips.map((c) => String(c.code));
  const fromQuery = extractCodesFromText(currentQuery);
  return Array.from(new Set([...fromChips, ...fromQuery]));
};

// riepilogo lato client (replica del backend)
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  const m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const k = (s.length - 1) * (p / 100);
  const f = Math.floor(k);
  const c = Math.min(f + 1, s.length - 1);
  if (f === c) return s[f];
  return s[f] + (s[c] - s[f]) * (k - f);
};
const summarizeClient = (rows: Row[]): Summary[] => {
  const by: Record<string, Row[]> = {};
  for (const r of rows) {
    const code = String(r.code ?? "").trim();
    if (!code) continue;
    (by[code] ||= []).push(r);
  }
  const out: Summary[] = [];
  for (const code of Object.keys(by)) {
    const items = by[code];
    const vals = items.map((i) => Number(i.negotiated_rate ?? 0));
    if (!vals.length) continue;
    const desc = (items.find((i) => String(i.description ?? "").trim())?.description ?? "") as string;
    const top3 = [...items]
      .map((i) => ({ provider_name: String(i.provider_name ?? ""), negotiated_rate: Number(i.negotiated_rate ?? 0) }))
      .sort((a, b) => a.negotiated_rate - b.negotiated_rate)
      .slice(0, 3);
    out.push({
      code,
      description: desc,
      count: vals.length,
      min: Math.min(...vals),
      median: median(vals),
      p25: percentile(vals, 25),
      p75: percentile(vals, 75),
      max: Math.max(...vals),
      top3,
    });
  }
  return out.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
};

/* ============================
   UI helpers (solo stile)
============================ */
const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}

function Btn({
  children,
  kind = "ghost",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "outline" }) {
  // Nota: le classi `disabled:*` si attivano automaticamente quando <button disabled />
  const base =
    "px-3 py-2 rounded transition text-sm " +
    "disabled:opacity-40 disabled:pointer-events-none"; // niente hover/click

  const variant =
    kind === "primary"
      ? "bg-sky-500 text-black hover:bg-sky-400"
      : kind === "outline"
      ? "border border-white/20 hover:bg-white/10"
      : "border hover:bg-white/10";

  return (
    <button {...props} className={`${base} ${variant} ${className}`}>
      {children}
    </button>
  );
}


function CardShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 shadow-2xl overflow-hidden">
      {title ? (
        <div className="px-4 py-2 text-xs text-slate-300 border-b border-white/10">{title}</div>
      ) : null}
      <div className="p-4 md:p-6 relative">{children}</div>
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[42rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base md:text-lg font-semibold">{children}</h2>;
}

/* ============================
   Page Component
============================ */
export default function DemoPage() {
  /* ---------- Header ---------- */
  const Header = (
    <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
      <div className="mx-auto max-w-6xl px-3 md:px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/costvista.svg"
            alt="Costvista"
            width={240}
            height={64}
            priority
            className="h-12 md:h-14 w-auto drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] [filter:brightness(1.15)]"
          />
          <span className="sr-only">Costvista</span>
        </Link>
        <Link href="/" className="text-sm px-3 py-1.5 rounded border border-white/20 hover:bg-white/10">
          Back to landing
        </Link>
      </div>
    </header>
  );

  // API base (dev fallback per localhost)
  const API =
    process.env.NEXT_PUBLIC_API ||
    (typeof window !== "undefined" && location.hostname === "localhost" ? "http://localhost:8000" : "");

  /* ---------- Source state (hooks dentro al componente!) ---------- */
  const [source, setSource] = useState<Source | null>(null);
  const isActiveDemo = (p: Source | null, path: DemoPath) => !!(p && p.kind === "demo" && p.path === path);

  /* ---------- Upload ---------- */
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [indexSuggestions, setIndexSuggestions] = useState<string[]>([]);

  function handleFileUpload(file: File) {
    setUploadErr(null);
    if (file.size > 50 * 1024 * 1024) {
      setUploadErr("File too large. Max 50MB.");
      return;
    }
    if (!/(csv|json)$/i.test(file.name)) {
      setUploadErr("Unsupported format. Use .csv or .json.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/summary_upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => {
      setUploadErr("Failed to upload. Please try again.");
      setUploading(false);
    };
    xhr.onload = () => {
      try {
        let data: unknown;
        try {
          data = JSON.parse(xhr.responseText) as unknown;
        } catch {
          data = { detail: xhr.responseText || "Server returned a non-JSON response." };
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          const payload = isApiSummaryShape(data) ? data : { rows: [], summary: [] };
          resetTables(payload);
          setSource({ kind: "upload", name: file.name, size: file.size, type: file.type });
          setProgress(100);
        } else {
          const d = (isApiErrorShape(data) ? data : { detail: `Upload error (HTTP ${xhr.status}).` }) as ApiError;
          setUploadErr(typeof d.detail === "string" && d.detail.trim() ? d.detail : `Upload error (HTTP ${xhr.status}).`);
        }
      } catch {
        setUploadErr("Unexpected error while reading the server response.");
      } finally {
               setUploading(false);
        setTimeout(() => setProgress(0), 600);
      }
    };
    xhr.send(form);
  }

  async function uploadOne(file: File): Promise<{ rows: Row[]; summary: Summary[] }> {
    const form = new FormData();
    form.append("file", file);
    const resp = await fetch(`${API}/api/summary_upload`, { method: "POST", body: form });
    const data: unknown = await resp.json();

    if (!resp.ok) {
      const err = (isApiErrorShape(data) && (data.detail || data.message)) || "Upload error";
      throw new Error(String(err));
    }

    const payload: ApiSummaryResponse = isApiSummaryShape(data) ? data : { rows: [], summary: [] };
    const rows: Row[] = (payload.rows ?? []).map((r) => ({ ...r, source: file.name }));
    const summary: Summary[] = payload.summary ?? summarizeClient(rows);
    return { rows, summary };
  }

  async function onUploadInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const parts = await Promise.all(files.map(uploadOne));
      const mergedRows = parts.flatMap((p) => p.rows);
      setAllRows(mergedRows);
      setAllSummary(summarizeClient(mergedRows));
      setRows(mergedRows);
      setSummary(summarizeClient(mergedRows));
      setSource({ kind: "upload", name: `${files.length} files`, size: 0, type: "mixed" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  // Drag & drop (usa upload singolo; il file input gestisce il multi)
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileUpload(f);
  }
  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  /* ---------- Codes typeahead ---------- */
  const [codeChips, setCodeChips] = useState<CodeChip[]>([]);
  const [procQuery, setProcQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [catalog] = useState(COMMON_CPT);

  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(procQuery.trim()), 120);
    return () => clearTimeout(t);
  }, [procQuery]);

  const suggestions = useMemo(() => {
    const q = debouncedQ.toLowerCase();
    if (!q) return [] as CodeItem[];
    return catalog.filter((p) => p.code.includes(q) || p.label.toLowerCase().includes(q)).slice(0, 50);
  }, [catalog, debouncedQ]);

  const addCode = (item: CodeItem) =>
    setCodeChips((prev) => (prev.some((x) => x.code === item.code) ? prev : [...prev, item]));
  const removeCode = (code: string) => setCodeChips((prev) => prev.filter((x) => x.code !== code));

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[highlightIdx];
      if (pick) {
        addCode(pick);
        setProcQuery("");
        setIsOpen(false);
        setHighlightIdx(0);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  /* ---------- Results ---------- */
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [allSummary, setAllSummary] = useState<Summary[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Filters & sorting ---------- */
  const [rowCodeQ, setRowCodeQ] = useState("");
  const [rowProviderQ, setRowProviderQ] = useState("");
  const [rowMinRate, setRowMinRate] = useState<string>("");
  const [rowMaxRate, setRowMaxRate] = useState<string>("");
  const [rowSortKey, setRowSortKey] = useState<keyof Row>("negotiated_rate");
  const [rowSortDir, setRowSortDir] = useState<Dir>("asc");

  const [sumCodeQ, setSumCodeQ] = useState("");
  const [sumSortKey, setSumSortKey] = useState<keyof Summary>("median");
  const [sumSortDir, setSumSortDir] = useState<Dir>("asc");

  function resetTables(payload: { rows?: Row[]; summary?: Summary[] }) {
    const rs = (payload.rows ?? []) as Row[];
    const sm = (payload.summary ?? []) as Summary[];
    setAllRows(rs);
    setAllSummary(sm);
    setRows(rs);
    setSummary(sm);

    setRowCodeQ("");
    setRowProviderQ("");
    setRowMinRate("");
    setRowMaxRate("");
    setRowSortKey("negotiated_rate");
    setRowSortDir("asc");
    setSumCodeQ("");
    setSumSortKey("median");
    setSumSortDir("asc");
  }

  const skipNextAuto = useRef(false);

  function clearResults() {
    setSource(null);
    setAllRows([]);
    setAllSummary([]);
    setRows([]);
    setSummary([]);
    setRowCodeQ("");
    setRowProviderQ("");
    setRowMinRate("");
    setRowMaxRate("");
    setRowSortKey("negotiated_rate");
    setRowSortDir("asc");
    setSumCodeQ("");
    setSumSortKey("median");
    setSumSortDir("asc");
    setCodeChips([]);
    setProcQuery("");
    setDebouncedQ("");
    setIndexSuggestions([]);
  }

  useEffect(() => {
    if (!allRows.length) return;
    if (skipNextAuto.current) {
      skipNextAuto.current = false;
      return;
    }
    const codes = getCodesToSend(codeChips, debouncedQ);
    const target = codes.length ? allRows.filter((r) => codes.includes(String(r.code ?? ""))) : allRows;
    setRows(codes.length ? target : [...allRows]);
    setSummary(codes.length ? summarizeClient(target) : allSummary.length ? [...allSummary] : summarizeClient(allRows));
  }, [allRows, allSummary, codeChips, debouncedQ]);

  /* ---------- Analyze by URL / demo ---------- */
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [url, setUrl] = useState("");

  async function analyzeURL(hrefOrLocalPath: string) {
    if (isDemoPath(hrefOrLocalPath)) {
      setSource({ kind: "demo", path: hrefOrLocalPath });
    } else {
      setSource({ kind: "url", href: hrefOrLocalPath });
    }

    setLoading(true);
    setError(null);
    setRows([]);
    setSummary([]);
    setProgress(0);

    try {
      const resp = await fetch(`${API}/api/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: hrefOrLocalPath, include_rows: true }),
      });

      const raw: unknown = await resp.json().catch(() => ({} as unknown));
      const body: unknown = hasDetail(raw) ? raw.detail : raw;

      if (!resp.ok) {
        // 409 da backend: index CMS con suggerimenti
        const maybeErr = body as ApiError;
        if (
          typeof maybeErr === "object" &&
          maybeErr !== null &&
          (maybeErr as ApiError).error === "index_detected" &&
          Array.isArray((maybeErr as ApiError).suggestions) &&
          (maybeErr as ApiError).suggestions!.length > 0
        ) {
          setIndexSuggestions((maybeErr as ApiError).suggestions as string[]);
          setShowUrlBox(true);
          setError(null);
          setRows([]);
          setSummary([]);
          setProgress(0);
          return;
        }

        const msg =
          (isApiErrorShape(body) && (body.detail || body.message)) ||
          (isApiErrorShape(raw) && (raw.detail || raw.message)) ||
          `HTTP ${resp.status}`;
        throw new Error(String(msg));
      }

      const payload = (isApiSummaryShape(raw) ? raw : (hasDetail(raw) && isApiSummaryShape((raw as any).detail) ? (raw as any).detail : {
        rows: [],
        summary: [],
      })) as ApiSummaryResponse;

      resetTables(payload);
      setIndexSuggestions([]);
      setProgress(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSource(null);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 600);
    }
  }

  async function analyzeManyURLs(paths: DemoPath[]) {
    setLoading(true);
    setError(null);
    setRows([]);
    setSummary([]);
    setProgress(0);
    try {
      const parts = await Promise.all(
        paths.map(async (p) => {
          const resp = await fetch(`${API}/api/summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: p, include_rows: true }),
          });
          const data: unknown = await resp.json();

          if (!resp.ok) {
            const msg = (isApiErrorShape(data) && (data.detail || data.message)) || `Summary error for ${p}`;
            throw new Error(String(msg));
          }

          const payload: ApiSummaryResponse = isApiSummaryShape(data) ? data : { rows: [], summary: [] };
          const rs = (payload.rows ?? []).map((r) => ({ ...r, source: DEMO_LABEL[p] }));
          return rs;
        })
      );
      const merged = parts.flat();
      setAllRows(merged);
      setAllSummary(summarizeClient(merged));
      setRows(merged);
      setSummary(summarizeClient(merged));
      setSource({ kind: "demo", path: paths[0] });
      setProgress(100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setSource(null);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 600);
    }
  }

  /* ---------- Derived ---------- */
  const filteredSortedRows = useMemo(() => {
    const min = rowMinRate ? Number(rowMinRate) : -Infinity;
    const max = rowMaxRate ? Number(rowMaxRate) : Infinity;
    const filtered = rows.filter((r) => {
      const codeOk = rowCodeQ ? contains(String(r.code ?? ""), rowCodeQ) : true;
      const provOk = rowProviderQ ? contains(String(r.provider_name ?? ""), rowProviderQ) : true;
      const rate = Number(r.negotiated_rate ?? 0);
      const rateOk = rate >= min && rate <= max;
      return codeOk && provOk && rateOk;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = rowSortDir === "asc" ? 1 : -1;
      const va = a[rowSortKey];
      const vb = b[rowSortKey];
      if (rowSortKey === "negotiated_rate") return (Number(va) - Number(vb)) * dir;
      return String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true }) * dir;
    });
    return sorted;
  }, [rows, rowCodeQ, rowProviderQ, rowMinRate, rowMaxRate, rowSortKey, rowSortDir]);

  const filteredSortedSummary = useMemo(() => {
    const filtered = summary.filter((s) =>
      sumCodeQ ? contains(String(s.code ?? ""), sumCodeQ) || contains(String(s.description ?? ""), sumCodeQ) : true
    );
    const sorted = [...filtered].sort((a, b) => {
      const dir = sumSortDir === "asc" ? 1 : -1;
      const va = a[sumSortKey];
      const vb = b[sumSortKey];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true }) * dir;
    });
    return sorted;
  }, [summary, sumCodeQ, sumSortKey, sumSortDir]);

  const headerBtn = (label: string, active: boolean, dir: Dir) =>
    `${label} ${active ? (dir === "asc" ? "▲" : "▼") : ""}`;
  const setRowSort = (k: keyof Row) => {
    setRowSortDir((d) => (rowSortKey === k ? (d === "asc" ? "desc" : "asc") : "asc"));
    setRowSortKey(k);
  };
  const setSumSort = (k: keyof Summary) => {
    setSumSortDir((d) => (sumSortKey === k ? (d === "asc" ? "desc" : "asc") : "asc"));
    setSumSortKey(k);
  };

  /* ---------- CSV exports ---------- */
  function exportRowsCSV() {
    const headerKeys: (keyof Row)[] = [
      "provider_name",
      "code_type",
      "code",
      "description",
      "rate_type",
      "negotiated_rate",
      "geo",
      "last_updated",
    ];
    const header = headerKeys.join(",");
    const lines = filteredSortedRows.map((r) =>
      headerKeys
        .map((k) => (r[k] ?? ""))
        .map((v) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : String(v)))
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "costvista_rows.csv";
    a.click();
  }

  function exportSummaryCSV() {
    const header = ["code", "description", "count", "min", "median", "p25", "p75", "max", "top1", "top2", "top3"];
    const lines = filteredSortedSummary.map((s) => {
      const tops = (s.top3 ?? []).map((t) => `${t.provider_name} ($${Number(t.negotiated_rate ?? 0).toFixed(2)})`);
      return [
        s.code,
        `"${String(s.description ?? "").replace(/"/g, '""')}"`,
        s.count ?? 0,
        s.min ?? 0,
        s.median ?? 0,
        s.p25 ?? 0,
        s.p75 ?? 0,
        s.max ?? 0,
        tops[0] ?? "",
        tops[1] ?? "",
        tops[2] ?? "",
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "costvista_summary.csv";
    a.click();
  }

  /* ---------- UI ---------- */
  const SourceBadge = () => {
    if (!source) return null;
    let label = "";
    if (source.kind === "demo") label = source.path.endsWith(".csv") ? "DEMO CSV" : "DEMO JSON";
    if (source.kind === "upload") label = `Uploaded • ${source.name}`;
    if (source.kind === "url") label = `URL • ${source.href}`;
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-white/10 px-2 py-1">
          Current source: <span className="font-medium">{label}</span>
        </span>
        <button
          type="button"
          className="underline opacity-80 hover:opacity-100"
          onClick={clearResults}
          aria-label="Clear current source and results"
        >
          Clear
        </button>
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
        {Header}

        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Upload / Demo */}
          <section className="space-y-3">
            <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ duration: 0.4 }}>
              <SectionTitle>Upload or pick a demo</SectionTitle>
            </motion.div>

            <CardShell>
              {/* Dropzone */}
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                className="rounded-xl border border-dashed border-white/20 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-black/30"
              >
                <div className="text-sm text-slate-300">Drag & drop a CSV or JSON (max 50MB), or</div>

                <div className="flex items-center gap-3">
                  <Btn kind="primary" type="button" onClick={() => fileInputRef.current?.click()}>
                    Choose file
                  </Btn>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,application/json,.json,text/csv"
                    multiple
                    onChange={onUploadInputChange}
                    className="hidden"
                  />
                  <div className="text-xs opacity-60">CSV / JSON only</div>
                </div>
              </div>

              {(uploading || progress > 0) && (
                <div className="flex items-center gap-3 mt-3">
                  <div className="relative w-64 h-2 rounded bg-white/10 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-sky-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs opacity-70">{progress}%</span>
                </div>
              )}
              {uploadErr && <div className="text-sm text-rose-400 mt-2">{uploadErr}</div>}

              {/* Demo buttons + URL toggle */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Btn
                  type="button"
                  kind={isActiveDemo(source, "/data/sample_hospital_mrf.csv") ? "primary" : "outline"}
                  onClick={() => analyzeURL("/data/sample_hospital_mrf.csv")}
                >
                  Demo A (CSV)
                </Btn>

                <Btn
                  type="button"
                  kind={isActiveDemo(source, "/data/sample_hospital_mrf_plan_b.csv") ? "primary" : "outline"}
                  onClick={() => analyzeURL("/data/sample_hospital_mrf_plan_b.csv")}
                >
                  Demo B (CSV)
                </Btn>

                <Btn
                  type="button"
                  kind={isActiveDemo(source, "/data/sample_hospital_mrf_plan_c.json") ? "primary" : "outline"}
                  onClick={() => analyzeURL("/data/sample_hospital_mrf_plan_c.json")}
                >
                  Demo C (JSON)
                </Btn>

                <Btn
                  type="button"
                  kind="outline"
                  onClick={() =>
                    analyzeManyURLs([
                      "/data/sample_hospital_mrf.csv",
                      "/data/sample_hospital_mrf_plan_b.csv",
                      "/data/sample_hospital_mrf_plan_c.json",
                    ])
                  }
                >
                  Compare A + B + C
                </Btn>

                <div className="ml-2">
                  <SourceBadge />
                </div>

                <Btn type="button" className="ml-auto" kind="outline" onClick={() => setShowUrlBox((v) => !v)}>
                  {showUrlBox ? "Hide URL (advanced)" : "Show URL (advanced)"}
                </Btn>
              </div>

              {showUrlBox && (
                <div className="flex flex-col gap-2 mt-3">
                  <input
                    className="w-full border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="CSV/JSON URL or local path (e.g., /data/sample_hospital_mrf.csv)"
                  />

                  {indexSuggestions.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
                      <div className="text-sm font-medium">This looks like a CMS index. Pick an in-network file:</div>
                      <div className="flex flex-wrap gap-2">
                        {indexSuggestions.map((u, i) => (
                          <Btn
                            key={u + i}
                            type="button"
                            kind="outline"
                            onClick={() => analyzeURL(u)}
                            className="text-xs truncate max-w-full"
                            title={u}
                          >
                            {u}
                          </Btn>
                        ))}
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setIndexSuggestions([])}
                          className="text-xs underline opacity-80 hover:opacity-100"
                        >
                          Dismiss suggestions
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Btn type="button" kind="primary" onClick={() => url && analyzeURL(url)}>
                      Analyze
                    </Btn>
                  </div>
                </div>
              )}
            </CardShell>
          </section>

          {/* Codes typeahead & actions */}
          <section ref={boxRef} className="space-y-1">
            <label className="block text-sm opacity-80">Pick procedures</label>
            <input
              ref={inputRef}
              value={procQuery}
              onChange={(e) => {
                setProcQuery(e.target.value);
                setIsOpen(true);
                setHighlightIdx(0);
              }}
              onFocus={() => setIsOpen(!!procQuery)}
              onKeyDown={onKeyDown}
              placeholder="Search by code or description (e.g., MRI, 70551)…"
              className="w-full border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
              autoComplete="off"
            />

            {isOpen && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-[calc(100%-3rem)] max-w-6xl max-h-72 overflow-auto border rounded-lg bg-black/90 backdrop-blur-sm">
                {suggestions.map((s, idx) => (
                  <button
                    type="button"
                    key={s.code + idx}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => {
                      addCode(s);
                      setProcQuery("");
                      setIsOpen(false);
                      inputRef.current?.focus();
                    }}
                    className={`w-full text-left px-3 py-2 text-sm ${idx === highlightIdx ? "bg-white/10" : ""}`}
                    title={s.label}
                  >
                    <span className="font-medium">{s.code}</span> · {s.label}
                  </button>
                ))}
              </div>
            )}

            {!!codeChips.length && (
              <div className="flex flex-wrap gap-2 mt-2">
                {codeChips.map((c) => (
                  <span key={c.code} className="text-xs px-2 py-1 rounded-full border">
                    {c.code} · {c.label}
                    <button
                      type="button"
                      onClick={() => removeCode(c.code)}
                      className="ml-2 opacity-70 hover:opacity-100"
                      aria-label={`Remove ${c.code}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Btn type="button" onClick={() => setCodeChips([])}>
                  Clear all
                </Btn>
              </div>
            )}

            <p className="text-xs opacity-60">Tip: paste codes separated by comma/space — we’ll add them automatically later.</p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Btn
                type="button"
                onClick={() => {
                  clearResults();
                }}
                disabled={!allRows.length}
              >
                Clear results
              </Btn>
              <Btn type="button" onClick={exportRowsCSV} disabled={!filteredSortedRows.length}>
                Export rows CSV
              </Btn>
              <Btn type="button" onClick={exportSummaryCSV} disabled={!filteredSortedSummary.length}>
                Export summary CSV
              </Btn>
            </div>
          </section>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {loading && (
            <motion.p
              variants={fadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.3 }}
              className="opacity-80 text-sm"
            >
              Analyzing…
            </motion.p>
          )}

          {/* SUMMARY */}
          {!!summary.length && (
            <section className="space-y-3">
              <div className="flex items-end gap-2 flex-wrap">
                <SectionTitle>Executive summary</SectionTitle>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    value={sumCodeQ}
                    onChange={(e) => setSumCodeQ(e.target.value)}
                    placeholder="Filter by code/description…"
                    className="border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
                  />
                  <Btn onClick={clearResults}>Reset</Btn>
                </div>
                <div className="text-xs opacity-70">
                  Showing {filteredSortedSummary.length} of {summary.length}
                </div>
              </div>

              <CardShell title="Executive summary">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-slate-200 border-b border-white/10">
                      <tr>
                        <th className="p-2 text-left cursor-pointer" onClick={() => setSumSort("code")}>
                          {headerBtn("Code", sumSortKey === "code", sumSortDir)}
                        </th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setSumSort("count")}>
                          {headerBtn("Count", sumSortKey === "count", sumSortDir)}
                        </th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setSumSort("min")}>
                          {headerBtn("Min", sumSortKey === "min", sumSortDir)}
                        </th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setSumSort("median")}>
                          {headerBtn("Median", sumSortKey === "median", sumSortDir)}
                        </th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setSumSort("p25")}>
                          {headerBtn("P25", sumSortKey === "p25", sumSortDir)}
                        </th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setSumSort("p75")}>
                          {headerBtn("P75", sumSortKey === "p75", sumSortDir)}
                        </th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setSumSort("max")}>
                          {headerBtn("Max", sumSortKey === "max", sumSortDir)}
                        </th>
                        <th className="p-2 text-left">Top 3 cheapest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSortedSummary.map((s) => (
                        <tr key={s.code} className="border-t border-white/10 hover:bg-white/[.03] align-top">
                          <td className="p-2">{s.code}</td>
                          <td className="p-2">{s.description}</td>
                          <td className="p-2 text-right">{s.count}</td>
                          <td className="p-2 text-right">{currency(s.min)}</td>
                          <td className="p-2 text-right">{currency(s.median)}</td>
                          <td className="p-2 text-right">{currency(s.p25)}</td>
                          <td className="p-2 text-right">{currency(s.p75)}</td>
                          <td className="p-2 text-right">{currency(s.max)}</td>
                          <td className="p-2">
                            {(s.top3?.length ?? 0) === 0 && <span className="opacity-70">No providers found</span>}
                            <ul className="space-y-1">
                              {(s.top3 || []).map((t, i) => (
                                <li key={i} className="text-slate-300">
                                  <span className="font-medium text-slate-100">{t.provider_name}</span> —{" "}
                                  {currency(t.negotiated_rate)}
                                </li>
                              ))}
                            </ul>
                            {(s.top3?.length ?? 0) < 3 && (
                              <div className="text-xs opacity-60">Showing {s.top3?.length || 0} of up to 3 providers</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardShell>
            </section>
          )}

          {/* ROWS */}
          {!!rows.length && (
            <section className="space-y-3">
              <div className="flex items-end gap-2 flex-wrap">
                <SectionTitle>Rows</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 w-full md:w-auto md:flex md:items-center md:gap-2 md:ml-auto">
                  <input
                    value={rowProviderQ}
                    onChange={(e) => setRowProviderQ(e.target.value)}
                    placeholder="Filter provider…"
                    className="border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
                  />
                  <input
                    value={rowCodeQ}
                    onChange={(e) => setRowCodeQ(e.target.value)}
                    placeholder="Filter code…"
                    className="border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
                  />
                  <input
                    value={rowMinRate}
                    onChange={(e) => setRowMinRate(e.target.value)}
                    placeholder="Min $"
                    inputMode="decimal"
                    className="border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
                  />
                  <input
                    value={rowMaxRate}
                    onChange={(e) => setRowMaxRate(e.target.value)}
                    placeholder="Max $"
                    inputMode="decimal"
                    className="border rounded p-2 bg-white/5 border-white/10 text-slate-100 placeholder-slate-400"
                  />
                  <Btn type="button" onClick={clearResults}>
                    Reset
                  </Btn>
                </div>
                <div className="text-xs opacity-70">Showing {filteredSortedRows.length} of {rows.length}</div>
              </div>

              <CardShell title="Rows">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-slate-200 border-b border-white/10">
                      <tr>
                        <th className="p-2 text-left cursor-pointer" onClick={() => setRowSort("provider_name")}>
                          {headerBtn("Provider", rowSortKey === "provider_name", rowSortDir)}
                        </th>
                        <th className="p-2 text-left cursor-pointer" onClick={() => setRowSort("code")}>
                          {headerBtn("Code", rowSortKey === "code", rowSortDir)}
                        </th>
                        <th className="p-2 text-left cursor-pointer" onClick={() => setRowSort("description")}>
                          {headerBtn("Description", rowSortKey === "description", rowSortDir)}
                        </th>
                        <th className="p-2 text-left cursor-pointer" onClick={() => setRowSort("rate_type")}>
                          {headerBtn("Type", rowSortKey === "rate_type", rowSortDir)}
                        </th>
                        <th className="p-2 text-right cursor-pointer" onClick={() => setRowSort("negotiated_rate")}>
                          {headerBtn("Rate", rowSortKey === "negotiated_rate", rowSortDir)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSortedRows.map((r, i) => (
                        <tr key={i} className="border-t border-white/10 hover:bg-white/[.03]">
                          <td className="p-2">{String(r.provider_name ?? "")}</td>
                          <td className="p-2">{String(r.code ?? "")}</td>
                          <td className="p-2">{String(r.description ?? "")}</td>
                          <td className="p-2">{String(r.rate_type ?? "")}</td>
                          <td className="p-2 text-right">{currency(r.negotiated_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardShell>
            </section>
          )}
        </div>
      </main>
    </MotionConfig>
  );
}
