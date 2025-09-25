from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from pathlib import Path
import os, csv, io, json, httpx, asyncio

app = FastAPI(title="Costvista API")

# ---------------- CORS ----------------
# Consente localhost in dev e *.vercel.app in prod/preview.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],  # usiamo la regex sotto
    allow_origin_regex=r"^(https?:\/\/localhost(:\d+)?|https:\/\/.*\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------- Health ---------------
@app.get("/health")
def health():
    return {"ok": True}

# ------------- Helpers ---------------
async def read_text(url_or_path: str) -> str:
    """Legge un file remoto (http/https) o locale da ./public"""
    if url_or_path.lower().startswith(("http://", "https://")):
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.get(url_or_path)
            r.raise_for_status()
            return r.text
    rel = url_or_path.lstrip("/")
    base = Path(__file__).resolve().parent / "public"
    fp = base / rel
    if not fp.exists():
        raise HTTPException(404, f"Local file not found: {fp}")
    return fp.read_text(encoding="utf-8")

def _coerce_float(val) -> float:
    try:
        if isinstance(val, str):
            v = val.replace("$", "").replace(",", "").strip()
            if v == "" or v.lower() == "nan":
                return 0.0
            return float(v)
        return float(val or 0)
    except Exception:
        return 0.0

def _pick_key(d: Dict[str, Any], candidates) -> Optional[str]:
    low = {k.lower(): k for k in d.keys()}
    for c in candidates:
        k = low.get(c.lower())
        if k:
            return k
    return None

def parse_csv(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    rows: List[Dict[str, Any]] = []
    for row in reader:
        # negotiated_rate
        rate_key = _pick_key(row, [
            "negotiated_rate", "allowed_amount", "allowed",
            "price", "rate", "amount", "ALLOWED_AMOUNT", "ALLOWED"
        ])
        row["negotiated_rate"] = _coerce_float(row.get(rate_key)) if rate_key else 0.0

        # code
        code_key = _pick_key(row, ["code", "cpt", "drg", "billing_code", "hcpcs", "cpt_code", "BILLING_CODE", "HCPCS"])
        if code_key:
            row["code"] = str(row.get(code_key))

        # description
        desc_key = _pick_key(row, ["description", "name", "procedure", "DESCRIPTION", "NAME", "PROCEDURE"])
        if desc_key:
            row["description"] = str(row.get(desc_key))

        # provider name
        prov_key = _pick_key(row, ["provider_name", "reporting_entity_name", "PROVIDER_NAME", "REPORTING_ENTITY_NAME"])
        if prov_key:
            row["provider_name"] = str(row.get(prov_key))

        # rate type
        type_key = _pick_key(row, ["rate_type", "billing_class", "RATE_TYPE", "BILLING_CLASS"])
        if type_key:
            row["rate_type"] = str(row.get(type_key))

        rows.append(row)
    return rows

def _coerce_negotiated_rate(rows: List[Dict[str, Any]]) -> None:
    for r in rows:
        if isinstance(r, dict):
            r["negotiated_rate"] = _coerce_float(r.get("negotiated_rate"))

def _find_first_array_of_objects(obj: Any) -> Optional[List[Dict[str, Any]]]:
    """
    Accetta:
      - array puro [ {...}, ... ]
      - { data: [ {...} ] }
      - qualunque oggetto che contenga come PRIMO valore una lista di oggetti
      - NDJSON (una riga = un oggetto JSON)
    """
    if isinstance(obj, list) and (len(obj) == 0 or isinstance(obj[0], dict)):
        return obj

    if isinstance(obj, dict):
        if isinstance(obj.get("data"), list) and (len(obj["data"]) == 0 or isinstance(obj["data"][0], dict)):
            return obj["data"]
        for _, v in obj.items():
            if isinstance(v, list) and (len(v) == 0 or isinstance(v[0], dict)):
                return v

    if isinstance(obj, str):
        lines = [ln.strip() for ln in obj.splitlines() if ln.strip()]
        try:
            rows = [json.loads(ln) for ln in lines]
            if rows and isinstance(rows[0], dict):
                return rows
        except Exception:
            pass

    return None

def _median(nums: List[float]) -> float:
    if not nums: return 0.0
    s = sorted(nums); n = len(s); m = n // 2
    return float(s[m]) if n % 2 else (s[m-1] + s[m]) / 2.0

def _percentile(nums: List[float], p: float) -> float:
    if not nums: return 0.0
    s = sorted(nums)
    if len(s) == 1: return float(s[0])
    k = (len(s) - 1) * (p / 100.0)
    f = int(k); c = min(f + 1, len(s) - 1)
    if f == c: return float(s[int(k)])
    return float(s[f] + (s[c] - s[f]) * (k - f))

def _summarize(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_code: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        code = str(r.get("code", "")).strip()
        if not code: continue
        by_code.setdefault(code, []).append(r)

    out = []
    for code, items in by_code.items():
        vals = [float(i.get("negotiated_rate") or 0) for i in items]
        if not vals: continue
        desc = next((str(i.get("description") or "").strip() for i in items if str(i.get("description") or "")), "")
        top3 = sorted(
            [{"provider_name": str(i.get("provider_name") or ""), "negotiated_rate": float(i.get("negotiated_rate") or 0)} for i in items],
            key=lambda x: x["negotiated_rate"]
        )[:3]
        out.append({
            "code": code, "description": desc, "count": len(vals),
            "min": float(min(vals)), "median": _median(vals),
            "p25": _percentile(vals, 25), "p75": _percentile(vals, 75),
            "max": float(max(vals)), "top3": top3
        })
    out.sort(key=lambda s: s["code"])
    return {"summary": out, "rows": rows, "count": len(rows)}

# --------------- Schemi ---------------
class ParseReq(BaseModel):
    url: str
    codes: List[str] = []

class SummaryReq(BaseModel):
    url: str
    codes: List[str] = []
    include_rows: bool = True

# --------------- Routes ---------------
@app.post("/api/parse")
async def parse(req: ParseReq):
    text = await read_text(req.url)
    if req.url.endswith(".csv") or ".csv" in req.url:
        rows = parse_csv(text)
    elif req.url.endswith(".json") or ".json" in req.url:
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            rows = _find_first_array_of_objects(text) or []
            if not rows:
                raise HTTPException(400, "Invalid JSON.")
        else:
            rows = _find_first_array_of_objects(obj) or []
            if not rows:
                raise HTTPException(400, "Expected an array of objects or { data: [...] }.")
    else:
        raise HTTPException(400, "Unsupported file type. Use .csv or .json")

    if req.codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

    _coerce_negotiated_rate(rows)
    return {"count": len(rows), "rows": rows}

@app.post("/api/summary")
async def summary(req: SummaryReq):
    text = await read_text(req.url)
    if req.url.endswith(".csv") or ".csv" in req.url:
        rows = parse_csv(text)
    elif req.url.endswith(".json") or ".json" in req.url:
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            rows = _find_first_array_of_objects(text) or []
            if not rows:
                raise HTTPException(400, "Invalid JSON.")
        else:
            rows = _find_first_array_of_objects(obj) or []
            if not rows:
                raise HTTPException(400, "Expected an array of objects or { data: [...] }.")
    else:
        raise HTTPException(400, "Unsupported file type. Use .csv or .json")

    if req.codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

    _coerce_negotiated_rate(rows)
    res = _summarize(rows)
    if not req.include_rows:
        res.pop("rows", None)
    return res

# -------- Upload (50MB) --------
MAX_SIZE_BYTES = 50 * 1024 * 1024

@app.post("/api/summary_upload")
async def summary_upload(
    file: UploadFile = File(...),
    codes: List[str] = Form(default=[]),
    include_rows: bool = Form(default=True),
):
    total = 0
    chunks: List[bytes] = []
    while True:
        chunk = await file.read(1024 * 1024)  # 1MB
        if not chunk: break
        total += len(chunk)
        if total > MAX_SIZE_BYTES:
            raise HTTPException(413, "File too large (limit 50MB).")
        chunks.append(chunk)
    data = b"".join(chunks)
    text = data.decode("utf-8", errors="replace")
    name = (file.filename or "").lower()

    # parse
    if file.content_type == "text/csv" or name.endswith(".csv"):
        rows = parse_csv(text)
    else:
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            rows = _find_first_array_of_objects(text) or []
            if not rows:
                raise HTTPException(400, "Invalid JSON.")
        else:
            rows = _find_first_array_of_objects(obj) or []
            if not rows:
                raise HTTPException(
                    400,
                    "Expected an array, { data: [...] }, any object with a first array of objects, or NDJSON."
                )

    if codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, codes))
        def _match(r: Dict[str, Any]) -> bool:
            for k in ("code", "cpt", "drg", "billing_code", "hcpcs", "cpt_code"):
                if k in r and str(r.get(k)) in code_set:
                    return True
            return False
        rows = [r for r in rows if _match(r)]

    _coerce_negotiated_rate(rows)
    res = _summarize(rows)
    if not include_rows:
        res.pop("rows", None)
    return res
