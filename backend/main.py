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
        try:
            row["negotiated_rate"] = float(row.get("negotiated_rate") or 0)
        except Exception:
            row["negotiated_rate"] = 0.0
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

# --- PATCH: upload endpoint per CSV/JSON (50MB, 30s timeout) ---
from fastapi import File, UploadFile, Form
import asyncio, uuid

MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50MB
ALLOWED_TYPES = {"text/csv", "application/json"}

def _sanitize_filename(name: str) -> str:
    base = name.split("/")[-1].split("\\")[-1]
    return "".join(ch for ch in base if ch.isalnum() or ch in ("-", "_", ".", " ")).strip()[:128]

def _parse_csv_bytes(data: bytes, codes: List[str]) -> Dict[str, Any]:
    text = data.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows: List[Dict[str, Any]] = []
    for row in reader:
        # coerci negotiated_rate a float, ma non esplodere se vuoto
        try:
            row["negotiated_rate"] = float(row.get("negotiated_rate") or 0)
        except Exception:
            row["negotiated_rate"] = 0.0
        rows.append(row)

    if codes:
        code_set = set(map(str, codes))
        # prova a trovare una colonna plausibile
        # se non c'è 'code', prova 'cpt' o 'drg'
        if rows:
            keys = {k.lower(): k for k in rows[0].keys()}
            code_key = keys.get("code") or keys.get("cpt") or keys.get("drg")
        else:
            code_key = None
        if code_key:
            rows = [r for r in rows if str(r.get(code_key)) in code_set]

    return {
        "detectedType": "csv",
        "rowCount": len(rows),
        "sample": rows[:5],
    }

def _parse_json_bytes(data: bytes, codes: List[str]) -> Dict[str, Any]:
    try:
        obj = json.loads(data.decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON non valido")

    # accettiamo array puro o { data: [...] }
    if isinstance(obj, dict) and isinstance(obj.get("data"), list):
        rows = obj["data"]
    elif isinstance(obj, list):
        rows = obj
    else:
        raise HTTPException(status_code=400, detail="Atteso array di oggetti o { data: [...] }")

    # filtra se richiesto su chiave 'code'/'cpt'/'drg'
    if codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, codes))
        def _match(r: Dict[str, Any]) -> bool:
            for k in ("code", "cpt", "drg"):
                if k in r and str(r.get(k)) in code_set:
                    return True
            return False
        rows = [r for r in rows if _match(r)]

    # coerci negotiated_rate se presente
    for r in rows:
        if isinstance(r, dict):
            try:
                r["negotiated_rate"] = float(r.get("negotiated_rate") or 0)
            except Exception:
                r["negotiated_rate"] = 0.0

    return {
        "detectedType": "json",
        "rowCount": len(rows),
        "sample": rows[:5] if isinstance(rows, list) else [],
    }

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    codes: List[str] = Form(default=[])
):
    """
    Multipart upload:
      - field "file": CSV o JSON (max 50MB)
      - field ripetibile "codes": opzionale (CPT/DRG)
    Output: { fileId, originalName, detectedType, rowCount, sample }
    """
    async def _handle():
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=415, detail=f"Content-Type non supportato: {file.content_type}")

        # leggi in chunk per rispettare MAX_SIZE_BYTES
        total = 0
        chunks: List[bytes] = []
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_SIZE_BYTES:
                raise HTTPException(status_code=413, detail="File troppo grande (limite 50MB)")
            chunks.append(chunk)
        data = b"".join(chunks)

        safe_name = _sanitize_filename(file.filename or "upload")
        file_id = f"tmp_{uuid.uuid4().hex}"

        if file.content_type == "text/csv":
            result = _parse_csv_bytes(data, codes)
        else:
            result = _parse_json_bytes(data, codes)

        return {
            "fileId": file_id,
            "originalName": safe_name,
            **result
        }

    try:
        # timeout end-to-end 30s
        return await asyncio.wait_for(_handle(), timeout=30.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Timeout parsing (30s)")
