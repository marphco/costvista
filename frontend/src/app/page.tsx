"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// ---------- Types ----------
type Row = {
  provider_name: string;
  code_type: string;
  code: string;
  description: string;
  rate_type: string;
  negotiated_rate: number;
  geo?: string;
  last_updated?: string;
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

type Dir = "asc" | "desc";
type CodeItem = { code: string; label: string };
type CodeChip = { code: string; label: string };

// ---------- Utils ----------
const currency = (n: number | undefined) => `$${Number(n ?? 0).toFixed(2)}`;
const contains = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());

// Minimal local catalog (replace with server search later)
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

// ---------- Component ----------
export default function Home() {
  // --- Source URL ---
  const [url, setUrl] = useState("/data/sample_hospital_mrf.csv");

  // --- Codes: chips + typeahead ---
  const [codeChips, setCodeChips] = useState<CodeChip[]>([]); // ← empty at start
  const [procQuery, setProcQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [catalog] = useState(COMMON_CPT);

  // Debounce query
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(procQuery.trim()), 120);
    return () => clearTimeout(t);
  }, [procQuery]);

  // Suggestions (dropdown)
  const suggestions = useMemo(() => {
    const q = debouncedQ.toLowerCase();
    if (!q) return [] as CodeItem[];
    return catalog
      .filter((p) => p.code.includes(q) || p.label.toLowerCase().includes(q))
      .slice(0, 50);
  }, [catalog, debouncedQ]);

  const addCode = (item: CodeItem) =>
    setCodeChips((prev) => (prev.some((x) => x.code === item.code) ? prev : [...prev, item]));
  const removeCode = (code: string) =>
    setCodeChips((prev) => prev.filter((x) => x.code !== code));

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Keyboard nav
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

  // --- Data results ---
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Filters & sorting: ROWS ---
  const [rowCodeQ, setRowCodeQ] = useState("");
  const [rowProviderQ, setRowProviderQ] = useState("");
  const [rowMinRate, setRowMinRate] = useState<string>("");
  const [rowMaxRate, setRowMaxRate] = useState<string>("");
  const [rowSortKey, setRowSortKey] = useState<keyof Row>("negotiated_rate");
  const [rowSortDir, setRowSortDir] = useState<Dir>("asc");

  // --- Filters & sorting: SUMMARY ---
  const [sumCodeQ, setSumCodeQ] = useState("");
  const [sumSortKey, setSumSortKey] = useState<keyof Summary>("median");
  const [sumSortDir, setSumSortDir] = useState<Dir>("asc");

  async function parseMRF(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRows([]);
    setSummary([]);
    try {
      const API = process.env.NEXT_PUBLIC_API || "";
      const resp = await fetch(`${API}/api/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          codes: codeChips.map((c) => c.code), // ← send only codes
          include_rows: true,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Summary error");
      setRows(data.rows || []);
      setSummary(data.summary || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Derived: ROWS ---
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

  // --- Derived: SUMMARY ---
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

  // --- UI helpers ---
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

  // --- Export ---
  function exportRowsCSV() {
    const header = ["provider_name","code_type","code","description","rate_type","negotiated_rate","geo","last_updated"];
    const csv = [header.join(",")]
      .concat(filteredSortedRows.map(r => header.map(h => (r as any)[h] ?? "").join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "costvista_rows.csv";
    a.click();
  }
  function exportSummaryCSV() {
    const header = ["code","description","count","min","median","p25","p75","max","top1","top2","top3"];
    const csv = [header.join(",")]
      .concat(filteredSortedSummary.map(s => {
        const tops = s.top3?.map(t => `${t.provider_name} ($${t.negotiated_rate.toFixed(2)})`) || [];
        return [
          s.code, `"${(s.description||"").replace(/"/g,'""')}"`, s.count ?? 0,
          s.min ?? 0, s.median ?? 0, s.p25 ?? 0, s.p75 ?? 0, s.max ?? 0,
          tops[0]||"", tops[1]||"", tops[2]||""
        ].join(",")
      }))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "costvista_summary.csv";
    a.click();
  }

  // --- Samples ---
  const useSampleCSV = () => setUrl("/data/sample_hospital_mrf.csv");
  const useSampleJSON = () => setUrl("/data/sample_hospital_mrf.json");

  // ---------- Render ----------
  return (
    <main className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Costvista — MVP</h1>

        {/* FORM */}
        <form onSubmit={parseMRF} className="space-y-4">
          <input
            className="w-full border rounded p-2 bg-transparent text-slate-100 placeholder-slate-400"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="CSV/JSON URL or local path (e.g., /data/sample_hospital_mrf.csv)"
          />

          {/* Typeahead codes */}
          <div ref={boxRef} className="relative">
            <label className="block text-sm opacity-80 mb-1">Pick procedures</label>
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

            {/* Dropdown */}
            {isOpen && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto border rounded-lg bg-black/90 backdrop-blur-sm">
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

            {/* Chips selected */}
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
                <button
                  type="button"
                  onClick={() => setCodeChips([])}
                  className="text-xs px-2 py-1 rounded border"
                >
                  Clear all
                </button>
              </div>
            )}

            <p className="text-xs opacity-60 mt-1">
              Tip: paste codes separated by comma/space — we’ll add them automatically later.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded bg-blue-600 text-white" type="submit">
              {loading ? "Analyzing…" : "Analyze"}
            </button>
            <button type="button" onClick={useSampleCSV} className="px-3 py-2 rounded border">
              Use sample CSV
            </button>
            <button type="button" onClick={useSampleJSON} className="px-3 py-2 rounded border">
              Use sample JSON
            </button>
            <button type="button" onClick={exportRowsCSV} disabled={!filteredSortedRows.length} className="px-3 py-2 rounded border">
              Export rows CSV
            </button>
            <button type="button" onClick={exportSummaryCSV} disabled={!filteredSortedSummary.length} className="px-3 py-2 rounded border">
              Export summary CSV
            </button>
          </div>
        </form>

        {error && <p className="text-red-500">{error}</p>}

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
                <button onClick={() => setSumCodeQ("")} className="px-3 py-2 rounded border">Reset</button>
              </div>
              <div className="text-xs opacity-70">Showing {filteredSortedSummary.length} of {summary.length}</div>
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
                  onClick={() => {
                    setRowProviderQ("");
                    setRowCodeQ("");
                    setRowMinRate("");
                    setRowMaxRate("");
                  }}
                  className="px-3 py-2 rounded border"
                >
                  Reset
                </button>
              </div>
              <div className="text-xs opacity-70">Showing {filteredSortedRows.length} of {rows.length}</div>
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
                      <td className="p-2">{r.provider_name}</td>
                      <td className="p-2">{r.code}</td>
                      <td className="p-2">{r.description}</td>
                      <td className="p-2">{r.rate_type}</td>
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
