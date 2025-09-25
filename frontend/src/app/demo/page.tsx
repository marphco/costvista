// frontend/src/app/demo/page.tsx
// src/app/demo/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/* ============================
   Types
============================ */
type Row = {
  provider_name?: string;
  code_type?: string;
  code?: string | number;
  description?: string;
  rate_type?: string;
  negotiated_rate: number;
  geo?: string;
  last_updated?: string;
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

type CodeItem = { code: string; label: string };
type CodeChip = { code: string; label: string };
type Dir = "asc" | "desc";

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

/* ============================
   Page
============================ */

// ---- Helpers per i filtri pre-analisi ----
const extractCodesFromText = (text: string): string[] => {
  const found = (text.match(/\b\d{4,5}\b/g) || []);
  return Array.from(new Set(found));
};

const getCodesToSend = (chips: {code: string}[], currentQuery: string): string[] => {
  const fromChips = chips.map(c => String(c.code));
  const fromQuery = extractCodesFromText(currentQuery);
  return Array.from(new Set([...fromChips, ...fromQuery]));
};

// ---- Helpers per riepilogo lato client (replica del backend) ----
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const n = s.length, m = Math.floor(n/2);
  return n % 2 ? s[m] : (s[m-1] + s[m]) / 2;
};

const percentile = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  if (s.length === 1) return s[0];
  const k = (s.length - 1) * (p / 100);
  const f = Math.floor(k), c = Math.min(f + 1, s.length - 1);
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
    const vals = items.map(i => Number(i.negotiated_rate ?? 0));
    if (!vals.length) continue;
    const desc = (items.find(i => String(i.description ?? "").trim())?.description ?? "") as string;
    const top3 = [...items]
      .map(i => ({ provider_name: String(i.provider_name ?? ""), negotiated_rate: Number(i.negotiated_rate ?? 0) }))
      .sort((a,b)=>a.negotiated_rate - b.negotiated_rate)
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
  return out.sort((a,b)=>String(a.code).localeCompare(String(b.code), undefined, {numeric:true}));
};


export default function DemoPage() {
  /* ---------- Header ---------- */
  const Header = (
    <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
      <div className="mx-auto max-w-6xl px-3 md:px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/costvista.svg"
            alt="Costvista"
            width={260}
            height={72}
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
    (typeof window !== "undefined" && location.hostname === "localhost"
      ? "http://localhost:8000"
      : "");

  /* ---------- Source ---------- */
 // ✅ percorsi consentiti per i demo
type DemoPath = "/data/sample_hospital_mrf.csv" | "/data/sample_hospital_mrf.json";

// ✅ union “discriminata”
type Source =
  | { kind: "upload"; name: string; size: number; type: string }
  | { kind: "demo"; path: DemoPath }
  | { kind: "url"; href: string };

const [source, setSource] = useState<Source | null>(null);

// ✅ type-guard per riconoscere i path demo
function isDemoPath(x: string): x is DemoPath {
  return x === "/data/sample_hospital_mrf.csv" || x === "/data/sample_hospital_mrf.json";
}

// ✅ helper senza errori di typing
const isActiveDemo = (p: Source | null, path: DemoPath) =>
  !!(p && p.kind === "demo" && p.path === path);

  // Piccolo badge sempre visibile con la sorgente corrente
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

  /* ---------- Upload ---------- */
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
// for (const c of getCodesToSend(codeChips, procQuery)) form.append("codes", c);

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
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resetTables(data);
          setSource({ kind: "upload", name: file.name, size: file.size, type: file.type });
          setProgress(100);
        } else {
          setUploadErr(data?.detail || "Upload error.");
        }
      } catch {
        setUploadErr("Invalid server response.");
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 600);
      }
    };
    xhr.send(form);
  }

  function onUploadInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileUpload(f);
  }

  // Drag & drop
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileUpload(f);
  }
  function onDragOver(e: React.DragEvent) {
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    // reset filtri
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
  // reset anche della sorgente selezionata
  setSource(null);

  // svuota dataset e risultati
  setAllRows([]);
  setAllSummary([]);
  setRows([]);
  setSummary([]);

  // reset UI state
  setRowCodeQ(""); setRowProviderQ(""); setRowMinRate(""); setRowMaxRate("");
  setRowSortKey("negotiated_rate"); setRowSortDir("asc");
  setSumCodeQ(""); setSumSortKey("median"); setSumSortDir("asc");
  setCodeChips([]); setProcQuery(""); setDebouncedQ("");
}


useEffect(() => {
  if (!allRows.length) return;

  if (skipNextAuto.current) {
    skipNextAuto.current = false;
    return;
  }

  const codes = getCodesToSend(codeChips, debouncedQ);
  const target = codes.length
    ? allRows.filter(r => codes.includes(String(r.code ?? "")))
    : allRows;

  setRows(codes.length ? target : [...allRows]);
  setSummary(
    codes.length
      ? summarizeClient(target)
      : (allSummary.length ? [...allSummary] : summarizeClient(allRows))
  );
}, [allRows, allSummary, codeChips, debouncedQ]);


  /* ---------- Analyze by URL / demo ---------- */
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [url, setUrl] = useState("");

  async function analyzeURL(hrefOrLocalPath: string) {
  // feedback immediato
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
    // ⬇️ NON mandiamo codes: prendiamo il dataset pieno
    const resp = await fetch(`${API}/api/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: hrefOrLocalPath,
        include_rows: true,
        // codes: []  // <-- tolto
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.detail || "Summary error");

    resetTables(data);      // allRows pieno
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
      const tops = (s.top3 ?? []).map((t) => `${t.provider_name} ($${t.negotiated_rate.toFixed(2)})`);
      return [
        s.code,
        `"${(s.description ?? "").replace(/"/g, '""')}"`,
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
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      {Header}

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Upload / Demo */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Upload or pick a demo</h2>

          {/* Dropzone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="rounded-xl border border-dashed border-white/20 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          >
            <div className="text-sm opacity-80">Drag & drop a CSV or JSON (max 50MB), or</div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Choose file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,application/json,.json,text/csv"
                onChange={onUploadInputChange}
                className="hidden"
              />
              <div className="text-xs opacity-60">CSV / JSON only</div>
            </div>
          </div>

          {/* Progress */}
          {(uploading || progress > 0) && (
            <div className="flex items-center gap-3">
              <progress max={100} value={progress} className="w-64 h-2" />
              <span className="text-xs opacity-70">{progress}%</span>
            </div>
          )}
          {uploadErr && <div className="text-sm text-red-500">{uploadErr}</div>}

          {/* Demo buttons + URL toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => analyzeURL("/data/sample_hospital_mrf.csv")}
              className={`px-3 py-2 rounded border transition ${
                isActiveDemo(source, "/data/sample_hospital_mrf.csv")
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "hover:bg-white/10"
              }`}
              aria-pressed={isActiveDemo(source, "/data/sample_hospital_mrf.csv")}
            >
              Analyze DEMO CSV
            </button>

            <button
              type="button"
              onClick={() => analyzeURL("/data/sample_hospital_mrf.json")}
              className={`px-3 py-2 rounded border transition ${
                isActiveDemo(source, "/data/sample_hospital_mrf.json")
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "hover:bg-white/10"
              }`}
              aria-pressed={isActiveDemo(source, "/data/sample_hospital_mrf.json")}
            >
              Analyze DEMO JSON
            </button>

            {/* Badge con sorgente corrente */}
            <div className="ml-2"><SourceBadge /></div>

            <button
              type="button"
              onClick={() => setShowUrlBox((v) => !v)}
              className="ml-auto px-3 py-2 rounded border hover:bg-white/10"
            >
              {showUrlBox ? "Hide URL (advanced)" : "Show URL (advanced)"}
            </button>
          </div>

          {showUrlBox && (
            <div className="flex gap-2">
              <input
                className="w-full border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="CSV/JSON URL or local path (e.g., /data/sample_hospital_mrf.csv)"
              />
              <button
                type="button"
                onClick={() => url && analyzeURL(url)}
                className="px-3 py-2 rounded bg-blue-600 text-white"
              >
                Analyze
              </button>
            </div>
          )}
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
            className="w-full border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
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
              <button type="button" onClick={() => setCodeChips([])} className="text-xs px-2 py-1 rounded border">
                Clear all
              </button>
            </div>
          )}

          <p className="text-xs opacity-60">
            Tip: paste codes separated by comma/space — we’ll add them automatically later.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
  type="button"
  onClick={() => { 
    clearResults(); 
  }}
  className="px-3 py-2 rounded border"
  disabled={!allRows.length}
>
              Clear results
            </button>
            <button
              type="button"
              onClick={exportRowsCSV}
              disabled={!filteredSortedRows.length}
              className="px-3 py-2 rounded border"
            >
              Export rows CSV
            </button>
            <button
              type="button"
              onClick={exportSummaryCSV}
              disabled={!filteredSortedSummary.length}
              className="px-3 py-2 rounded border"
            >
              Export summary CSV
            </button>
          </div>
        </section>

        {error && <p className="text-red-500">{error}</p>}
        {loading && <p className="opacity-70 text-sm">Analyzing…</p>}

        {/* SUMMARY */}
        {!!summary.length && (
          <section className="space-y-3">
            <div className="flex items-end gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Executive summary</h2>
              <div className="ml-auto flex items-center gap-2">
                <input
                  value={sumCodeQ}
                  onChange={(e) => setSumCodeQ(e.target.value)}
                  placeholder="Filter by code/description…"
                  className="border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
                />
                <button onClick={clearResults} className="px-3 py-2 rounded border">
  Reset
</button>
              </div>
              <div className="text-xs opacity-70">
                Showing {filteredSortedSummary.length} of {summary.length}
              </div>
            </div>

            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-900">
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
                    <tr key={s.code} className="border-t align-top">
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
                              <span className="font-medium text-slate-100">{t.provider_name}</span> — {currency(t.negotiated_rate)}
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
          </section>
        )}

        {/* ROWS */}
        {!!rows.length && (
          <section className="space-y-3">
            <div className="flex items-end gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Rows</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 w-full md:w-auto md:flex md:items-center md:gap-2 md:ml-auto">
                <input
                  value={rowProviderQ}
                  onChange={(e) => setRowProviderQ(e.target.value)}
                  placeholder="Filter provider…"
                  className="border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
                />
                <input
                  value={rowCodeQ}
                  onChange={(e) => setRowCodeQ(e.target.value)}
                  placeholder="Filter code…"
                  className="border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
                />
                <input
                  value={rowMinRate}
                  onChange={(e) => setRowMinRate(e.target.value)}
                  placeholder="Min $"
                  inputMode="decimal"
                  className="border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
                />
                <input
                  value={rowMaxRate}
                  onChange={(e) => setRowMaxRate(e.target.value)}
                  placeholder="Max $"
                  inputMode="decimal"
                  className="border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
                />
                <button
  type="button"
  onClick={clearResults}
  className="px-3 py-2 rounded border"
>
  Reset
</button>
              </div>
              <div className="text-xs opacity-70">
                Showing {filteredSortedRows.length} of {rows.length}
              </div>
            </div>

            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-900">
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
                    <tr key={i} className="border-t">
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
          </section>
        )}
      </div>
    </main>
  );
}
