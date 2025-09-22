// frontend/src/app/api/parse/route.ts
// Runtime Node (serve per usare 'fs' senza edge runtime)
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

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

// CSV parser minimo (virgole semplici, sufficiente per i nostri sample)
function parseCSV(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()!.split(",").map(h => h.trim());
  return lines.map((line) => {
    const cols = line.split(",").map(c => c.trim());
    const obj: any = {};
    header.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    obj.negotiated_rate = parseFloat(obj.negotiated_rate || "0");
    return obj as Row;
  });
}

// Legge testo da URL esterno http/https o da file locale in /public
async function readText(urlOrPath: string): Promise<string> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.text();
  }
  // locale: path a partire da /public (es. /data/sample.csv)
  const rel = urlOrPath.replace(/^\//, ""); // rimuove slash iniziale
  const filePath = path.join(process.cwd(), "public", rel);
  return await fs.readFile(filePath, "utf8");
}

export async function POST(req: Request) {
  try {
    const { url, codes } = (await req.json()) as { url: string; codes?: string[] };

    if (!url) return NextResponse.json({ detail: "Missing 'url'" }, { status: 400 });

    const text = await readText(url);
    let rows: Row[] = [];

    if (url.endsWith(".csv") || url.includes(".csv")) {
      rows = parseCSV(text);
    } else if (url.endsWith(".json") || url.includes(".json")) {
      const data = JSON.parse(text);
      if (Array.isArray(data)) rows = data as Row[];
      else return NextResponse.json({ detail: "JSON must be an array for MVP." }, { status: 400 });
    } else {
      return NextResponse.json({ detail: "Unsupported file type. Use .csv or .json" }, { status: 400 });
    }

    const filtered = (codes && codes.length)
      ? rows.filter(r => codes.includes(String(r.code)))
      : rows;

    return NextResponse.json({ count: filtered.length, rows: filtered });
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || String(e) }, { status: 400 });
  }
}
