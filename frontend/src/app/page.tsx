"use client";
import { useMemo, useState } from "react";

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

// helpers --------------------------------------------------
function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentile(nums: number[], p: number) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[idx];
}

export default function Home() {
  const [url, setUrl] = useState("/data/sample_hospital_mrf.csv");
  const [codes, setCodes] = useState("70551,74177,45378,66984,775");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parseMRF(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const API = process.env.NEXT_PUBLIC_API || "";
const resp = await fetch(`${API}/api/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          codes: codes.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || "Parse error");
      setRows(data.rows || []);
    } catch (err:any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // summary per code + top3 --------------------------------
  const summary: Summary[] = useMemo(() => {
    const byCode = new Map<string, { desc: string; items: Row[] }>();
    for (const r of rows) {
      const key = String(r.code);
      const entry = byCode.get(key) ?? { desc: r.description || "", items: [] };
      entry.items.push(r);
      entry.desc ||= r.description || "";
      byCode.set(key, entry);
    }
    const out: Summary[] = [];
    byCode.forEach((v, k) => {
      const vals = v.items
        .map(i => Number(i.negotiated_rate))
        .filter(n => Number.isFinite(n))
        .sort((a,b)=>a-b);
      if (!vals.length) return;
      const top3 = [...v.items]
        .filter(i => Number.isFinite(i.negotiated_rate))
        .sort((a,b)=> Number(a.negotiated_rate) - Number(b.negotiated_rate))
        .slice(0,3)
        .map(i => ({ provider_name: i.provider_name, negotiated_rate: Number(i.negotiated_rate) }));
      out.push({
        code: k,
        description: v.desc,
        count: vals.length,
        min: vals[0],
        median: median(vals),
        max: vals[vals.length - 1],
        p25: percentile(vals, 25),
        p75: percentile(vals, 75),
        top3,
      });
    });
    return out.sort((a,b)=> a.code.localeCompare(b.code));
  }, [rows]);

  // export CSV (righe grezze) ------------------------------
  function exportRowsCSV() {
    const header = ["provider_name","code_type","code","description","rate_type","negotiated_rate","geo","last_updated"];
    const csv = [header.join(",")]
      .concat(rows.map(r => header.map(h => (r as any)[h] ?? "").join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "costvista_rows.csv";
    a.click();
  }
  // export CSV summary -------------------------------------
  function exportSummaryCSV() {
    const header = ["code","description","count","min","median","p25","p75","max","top1","top2","top3"];
    const csv = [header.join(",")]
      .concat(summary.map(s => {
        const tops = s.top3.map(t => `${t.provider_name} ($${t.negotiated_rate.toFixed(2)})`);
        return [
          s.code, `"${(s.description||"").replace(/"/g,'""')}"`, s.count,
          s.min, s.median, s.p25, s.p75, s.max,
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

  // helpers UI ---------------------------------------------
  function useSampleCSV() {
    setUrl("/data/sample_hospital_mrf.csv");
  }
  function useSampleJSON() {
    setUrl("/data/sample_hospital_mrf.json");
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Costvista – MVP</h1>

        <form onSubmit={parseMRF} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            placeholder="URL .csv or .json (es: /data/sample_hospital_mrf.csv)"
            value={url}
            onChange={e=>setUrl(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Codes (comma-separated)"
            value={codes}
            onChange={e=>setCodes(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded bg-blue-600 text-white" type="submit">
              {loading ? "Parsing…" : "Parse"}
            </button>
            <button type="button" onClick={useSampleCSV} className="px-3 py-2 rounded border">Use sample CSV</button>
            <button type="button" onClick={useSampleJSON} className="px-3 py-2 rounded border">Use sample JSON</button>
            <button type="button" onClick={exportRowsCSV} disabled={!rows.length} className="px-3 py-2 rounded border">Export rows CSV</button>
            <button type="button" onClick={exportSummaryCSV} disabled={!summary.length} className="px-3 py-2 rounded border">Export summary CSV</button>
          </div>
        </form>

        {error && <p className="text-red-600">{error}</p>}

        {!!summary.length && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Executive summary</h2>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Count</th>
                    <th className="p-2 text-right">Min</th>
                    <th className="p-2 text-right">Median</th>
                    <th className="p-2 text-right">P25</th>
                    <th className="p-2 text-right">P75</th>
                    <th className="p-2 text-right">Max</th>
                    <th className="p-2 text-left">Top 3 cheapest</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.code} className="border-t align-top">
                      <td className="p-2">{s.code}</td>
                      <td className="p-2">{s.description}</td>
                      <td className="p-2 text-right">{s.count}</td>
                      <td className="p-2 text-right">${s.min.toFixed(2)}</td>
                      <td className="p-2 text-right">${s.median.toFixed(2)}</td>
                      <td className="p-2 text-right">${s.p25.toFixed(2)}</td>
                      <td className="p-2 text-right">${s.p75.toFixed(2)}</td>
                      <td className="p-2 text-right">${s.max.toFixed(2)}</td>
                      <td className="p-2">
                        <ul className="space-y-1">
                          {s.top3.map((t,i)=>(
                            <li key={i} className="text-slate-700">
                              <span className="font-medium">{t.provider_name}</span> — ${t.negotiated_rate.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!!rows.length && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Rows</h2>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">Provider</th>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.provider_name}</td>
                      <td className="p-2">{r.code}</td>
                      <td className="p-2">{r.description}</td>
                      <td className="p-2">{r.rate_type}</td>
                      <td className="p-2 text-right">${Number(r.negotiated_rate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
