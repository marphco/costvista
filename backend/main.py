from fastapi import FastAPI, HTTPException, UploadFile, File, Form  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore
from typing import List, Dict, Any, Optional
from pathlib import Path
import csv, io, json, httpx, re  # type: ignore

app = FastAPI(title="Costvista API")

# ---------------- CORS ----------------
# Consenti esplicitamente il front in dev e *.vercel.app in preview/prod.
# Niente credenziali: non usiamo cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=False,
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


_number_re = re.compile(r"[^\d\.\-]")  # tieni solo 0-9 . -

def _coerce_float(val) -> float:
    try:
        if val is None:
            return 0.0
        s = str(val).strip()
        if not s or s.lower() == "nan":
            return 0.0
        s = _number_re.sub("", s)
        if s in ("", ".", "-"):
            return 0.0
        return float(s)
    except Exception:
        return 0.0

# ========= Header normalization (ibrida: regole + hook AI) =========

# Vocabolario di sinonimi: header sorgente -> campo canonico
CANON_FIELDS = {
    "code": [
        "code","cpt","hcpcs","drg","billing_code","cpt_code","hcpcs_code",
        "cpt/hcpcs","cpt / hcpcs","procedure code","billing code",
    ],
    "description": [
        "description","procedure","service","name","procedure description",
    ],
    "provider_name": [
        "provider_name","reporting_entity_name","payer","third-party","reporting entity name",
    ],
    "rate_type": [
        "rate_type","billing_class","network","billing class",
    ],
    "negotiated_rate": [
        "negotiated_rate","allowed_amount","allowed","price","rate","amount",
        "allowed amount","allowed amount ($)","plan allowed amount","plan allowed",
        "allowed_amt","allowedamount","negotiated amount","negotiated_price",
        "negotiated charge","plan rate","rate ($)","price ($)",
    ],
}

def _norm(s: Any) -> str:
    return str(s or "").strip().lower()

def _build_mapping(headers: List[str]) -> Dict[str, str]:
    """
    Ritorna un mapping {header_sorgente -> canonico} usando:
    1) match esatto case-insensitive
    2) match "contains" se >=3 colonne
    3) hook AI opzionale per i residui (se abilitato)
    """
    mapping: Dict[str, str] = {}

    # 1) exact match
    for canon, syns in CANON_FIELDS.items():
        syn_norm = set(_norm(x) for x in syns)
        for h in headers:
            if h is None:
                continue
            if _norm(h) in syn_norm:
                mapping[h] = canon

    # 2) contains (solo se ha senso)
    if len([h for h in headers if h is not None]) >= 3:
        for canon, syns in CANON_FIELDS.items():
            for h in headers:
                if h is None or h in mapping:
                    continue
                hn = _norm(h)
                if any(_norm(s) in hn for s in syns):
                    mapping[h] = canon

    # 3) hook AI per i residui (opzionale)
    residui = [h for h in headers if h is not None and h not in mapping]
    if residui:
        ai_map = _ai_suggest_mapping(residui)
        for h, cand in ai_map.items():
            if cand in CANON_FIELDS and h not in mapping:
                mapping[h] = cand

    return mapping

def _apply_mapping_to_row(row: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
    """Applica il mapping alla riga producendo chiavi canoniche; preserva tutto il resto."""
    out = dict(row)
    for src_key, canon in mapping.items():
        if src_key in row and canon not in out:
            out[canon] = row.get(src_key)
    return out

def normalize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalizza tutte le righe allo schema: code, description, provider_name, rate_type, negotiated_rate (+ resto)."""
    if not rows:
        return rows
    headers = list(rows[0].keys())
    mapping = _build_mapping(headers)
    normed = [_apply_mapping_to_row(r, mapping) for r in rows]
    for r in normed:
        r["negotiated_rate"] = _coerce_float(r.get("negotiated_rate"))
        for k in ("code", "description", "provider_name", "rate_type"):
            if k in r:
                r[k] = str(r.get(k) or "").strip()
    return normed

# Hook AI opzionale (disattivo di default)
USE_LLM_SCHEMA = False
def _ai_suggest_mapping(headers_unknown: List[str]) -> Dict[str, str]:
    if not USE_LLM_SCHEMA:
        return {}
    # Qui potrai chiamare il tuo LLM e restituire, ad es.: {"Allowed Amount ($)": "negotiated_rate"}
    return {}

# ---------------- CSV parsing ----------------
def parse_csv(text: str) -> List[Dict[str, Any]]:
    """CSV robust parser con sniff + fallback e normalizzazione header a batch."""
    # rimuovi BOM
    raw = text.lstrip("\ufeff")
    src = io.StringIO(raw)

    # prova a sniffare il dialetto; fallback su delimitatori comuni
    sample = raw[:4096]
    reader: csv.DictReader
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
        reader = csv.DictReader(src, dialect=dialect, restkey="_extra", restval="")
    except Exception:
        reader = None  # type: ignore
        for delim in [";", "\t", "|", ","]:
            src.seek(0)
            tmp = csv.DictReader(src, delimiter=delim, restkey="_extra", restval="")
            if tmp.fieldnames and len([h for h in tmp.fieldnames if h is not None]) > 1:
                reader = tmp  # type: ignore
                break
        if reader is None:  # estremo fallback
            src.seek(0)
            reader = csv.DictReader(src, restkey="_extra", restval="")

    # ---- costruisci il mapping UNA VOLTA usando i fieldnames ----
    fieldnames = [h for h in (getattr(reader, "fieldnames", None) or [])]
    mapping = _build_mapping(fieldnames)

    rows: List[Dict[str, Any]] = []
    for row in reader:
        row.pop(None, None)  # safety
        # applica mapping a livello di riga
        row = _apply_mapping_to_row(row, mapping)

        # coerzioni "soft" (non rompono se mancanti)
        row["negotiated_rate"] = _coerce_float(row.get("negotiated_rate"))
        for k in ("code", "description", "provider_name", "rate_type"):
            if k in row:
                row[k] = str(row.get(k) or "").strip()

        rows.append(row)

    return rows

# --------------- Stat helpers ---------------
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

    # Normalizzazione comune
    rows = normalize_rows(rows)

    if req.codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

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

    rows = normalize_rows(rows)

    if req.codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

    res = _summarize(rows)
    if not req.include_rows:
        res.pop("rows", None)
    return res

# -------- Upload (50MB) --------
MAX_SIZE_BYTES = 50 * 1024 * 1024

def _find_first_array_of_objects(obj: Any) -> Optional[List[Dict[str, Any]]]:
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
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_SIZE_BYTES:
            raise HTTPException(413, "File too large (limit 50MB).")
        chunks.append(chunk)

    data = b"".join(chunks)
    text = data.decode("utf-8", errors="replace")

    # 1) prova JSON puro
    rows: List[Dict[str, Any]] = []
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        # 2) NDJSON
        rows = _find_first_array_of_objects(text) or []
        if not rows:
            # 3) CSV (auto-detect)
            rows = parse_csv(text)
    else:
        rows = _find_first_array_of_objects(obj) or []
        if not rows:
            raise HTTPException(
                400,
                "Expected an array, { data: [...] }, any object with a first array of objects, or NDJSON."
            )

    rows = normalize_rows(rows)

    if codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, codes))
        def _match(r: Dict[str, Any]) -> bool:
            for k in ("code", "cpt", "drg", "billing_code", "hcpcs", "cpt_code"):
                if k in r and str(r.get(k)) in code_set:
                    return True
            return False
        rows = [r for r in rows if _match(r)]

    res = _summarize(rows)
    if not include_rows:
        res.pop("rows", None)
    return res
