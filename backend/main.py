from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, AnyHttpUrl
from typing import List, Dict, Any
import csv, io, json, httpx, os
from pathlib import Path

app = FastAPI(title="Costvista API")

# CORS: consenti la tua app Next su localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ParseReq(BaseModel):
    url: str  # accetta sia http(s) sia path locale tipo /data/...
    codes: List[str] = []

async def read_text(url_or_path: str) -> str:
    # http/https → fetch
    if url_or_path.lower().startswith(("http://","https://")):
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(url_or_path)
            r.raise_for_status()
            return r.text
    # locale → leggi da ./public come nel frontend
    rel = url_or_path.lstrip("/")
    base = Path(__file__).resolve().parent / "public"
    fp = base / rel
    if not fp.exists():
        raise HTTPException(404, f"Local file not found: {fp}")
    return fp.read_text(encoding="utf-8")

def parse_csv(text: str) -> List[Dict[str, Any]]:
    lines = text.strip().splitlines()
    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    rows = []
    for row in reader:
        row["negotiated_rate"] = float(row.get("negotiated_rate") or 0)
        rows.append(row)
    return rows

@app.post("/api/parse")
async def parse(req: ParseReq):
    text = await read_text(req.url)
    rows: List[Dict[str, Any]] = []
    if req.url.endswith(".csv") or ".csv" in req.url:
        rows = parse_csv(text)
    elif req.url.endswith(".json") or ".json" in req.url:
        data = json.loads(text)
        if not isinstance(data, list):
            raise HTTPException(400, "JSON must be an array for MVP.")
        rows = data
    else:
        raise HTTPException(400, "Unsupported file type. Use .csv or .json")

    if req.codes:
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]
    return {"count": len(rows), "rows": rows}

class SummaryReq(BaseModel):
    url: str               # http(s) o path locale /data/...
    codes: List[str] = []  # opzionale: filtra i codici
    include_rows: bool = True  # se vuoi tornare anche le righe grezze

def _median(nums: List[float]) -> float:
    if not nums: return 0.0
    s = sorted(nums)
    n = len(s); m = n // 2
    return float(s[m]) if n % 2 else (s[m-1] + s[m]) / 2.0

def _percentile(nums: List[float], p: float) -> float:
    if not nums: return 0.0
    s = sorted(nums)
    if len(s) == 1: return float(s[0])
    # interpolazione semplice
    k = (len(s) - 1) * (p / 100.0)
    f = int(k); c = min(f + 1, len(s) - 1)
    if f == c: return float(s[int(k)])
    return float(s[f] + (s[c] - s[f]) * (k - f))

@app.post("/api/summary")
async def summary(req: SummaryReq):
    # 1) leggi e parse come in /api/parse
    text = await read_text(req.url)
    if req.url.endswith(".csv") or ".csv" in req.url:
        rows = parse_csv(text)
    elif req.url.endswith(".json") or ".json" in req.url:
        data = json.loads(text)
        if not isinstance(data, list):
            raise HTTPException(400, "JSON must be an array for MVP.")
        rows = data
    else:
        raise HTTPException(400, "Unsupported file type. Use .csv or .json")

    # 2) filtra codici (se forniti)
    if req.codes:
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

    # 3) raggruppa per code e calcola stats
    by_code: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        code = str(r.get("code", ""))
        if not code: 
            # salta righe senza code
            continue
        by_code.setdefault(code, []).append(r)

    summary_out = []
    for code, items in by_code.items():
        vals = [float(i.get("negotiated_rate") or 0) for i in items if i.get("negotiated_rate") is not None]
        if not vals: 
            continue
        # descrizione: prendi la più frequente o la prima non vuota
        desc = ""
        for i in items:
            d = str(i.get("description") or "").strip()
            if d: 
                desc = d; break

        # top-3 provider più economici
        top3 = sorted(
            [
                {
                    "provider_name": str(i.get("provider_name") or ""),
                    "negotiated_rate": float(i.get("negotiated_rate") or 0),
                }
                for i in items
                if i.get("negotiated_rate") is not None
            ],
            key=lambda x: x["negotiated_rate"],
        )[:3]

        summary_out.append({
            "code": code,
            "description": desc,
            "count": len(vals),
            "min": float(min(vals)),
            "median": _median(vals),
            "p25": _percentile(vals, 25),
            "p75": _percentile(vals, 75),
            "max": float(max(vals)),
            "top3": top3,
        })

    # ordina per code
    summary_out.sort(key=lambda s: s["code"])

    resp = {"summary": summary_out}
    if req.include_rows:
        resp["rows"] = rows
        resp["count"] = len(rows)
    return resp