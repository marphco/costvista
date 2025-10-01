from fastapi import FastAPI, HTTPException, UploadFile, File, Form  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import csv, io, json, httpx, re  # type: ignore
from datetime import datetime, timezone
import re as _re
import gzip, zipfile
from contextvars import ContextVar

ACCEPTED_INNER_EXTS = (".json", ".csv", ".ndjson", ".jsonl", ".txt", ".gz")
MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024  # guardrail anti zip-bomb (~200MB)
SOURCE_INNER: ContextVar[Optional[str]] = ContextVar("SOURCE_INNER", default=None)



app = FastAPI(title="Costvista API")

# ---------------- CORS ----------------
# Consenti esplicitamente il front in dev e *.vercel.app in preview/prod.
# Niente credenziali: non usiamo cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://costvista.com",
        "https://www.costvista.com",
    ],
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
def _text_from_zip_bytes(data: bytes) -> tuple[str, Optional[str]]:
    """Ritorna (text, inner_name) dal contenuto ZIP in bytes.
       Estrae il primo file 'utile'. Se è .gz, lo scompatta."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            # scegli il primo membro rilevante
            candidates = [
                n for n in zf.namelist()
                if not n.endswith("/") and any(n.lower().endswith(ext) for ext in ACCEPTED_INNER_EXTS)
            ]
            if not candidates:
                raise HTTPException(415, "ZIP does not contain a .json/.csv/.ndjson file.")
            inner = candidates[0]
            with zf.open(inner, "r") as f:
                payload = f.read(MAX_DECOMPRESSED_BYTES + 1)
            if len(payload) > MAX_DECOMPRESSED_BYTES:
                raise HTTPException(413, "Decompressed ZIP content too large.")
            # se l'interno è gz, scompatta
            if inner.lower().endswith(".gz"):
                try:
                    payload = gzip.decompress(payload)
                except Exception:
                    raise HTTPException(400, "Inner GZ in ZIP is invalid.")
            return payload.decode("utf-8", errors="replace"), inner
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Invalid ZIP file.")


async def read_text(url_or_path: str) -> str:
    """Legge file remoto (http/https) o locale ./public.
       Supporta .gz e .zip; per .zip ritorna il testo del primo file utile."""
    # reset info 'inner' per questa richiesta
    SOURCE_INNER.set(None)

    # ---- remoto ----
    if url_or_path.lower().startswith(("http://", "https://")):
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.get(url_or_path)
            r.raise_for_status()
            url_l = url_or_path.lower()
            content_enc = (r.headers.get("Content-Encoding") or "").lower()
            content_type = (r.headers.get("Content-Type") or "").lower()

            # URL o header indicano ZIP
            if url_l.endswith(".zip") or "zip" in content_type:
                text, inner = _text_from_zip_bytes(r.content)
                SOURCE_INNER.set(inner)
                return text

            # URL .gz esplicito -> prova a gunzip, altrimenti usa r.text
            if url_l.endswith(".gz"):
                try:
                    raw = gzip.decompress(r.content)
                    return raw.decode("utf-8", errors="replace")
                except Exception:
                    return r.text

            # altrimenti usa r.text (HTTPX di solito ha già gestito Content-Encoding)
            return r.text


    # ---- locale (./public) ----
    rel = url_or_path.lstrip("/")
    base = Path(__file__).resolve().parent / "public"
    fp = base / rel
    if not fp.exists():
        raise HTTPException(404, f"Local file not found: {fp}")

    p = rel.lower()
    if p.endswith(".zip"):
        text, inner = _text_from_zip_bytes(fp.read_bytes())
        SOURCE_INNER.set(inner)
        return text
    if p.endswith(".gz"):
        return gzip.decompress(fp.read_bytes()).decode("utf-8", errors="replace")
    return fp.read_text(encoding="utf-8")



# --- CMS index detection (Cigna/BCBS/etc.) -----------------------------------
from typing import Iterable

def _raise_index_suggestions(urls: List[str]):
    # 409 per "conflict/mismatch" fra ciò che ci si aspettava (tariffe) e ciò che è arrivato (index)
    raise HTTPException(
        status_code=409,
        detail={
            "error": "index_detected",
            "message": "The provided URL is a CMS Table of Contents (index). Pick an in-network rates file instead.",
            "suggestions": urls[:10],  # mostra fino a 10 link
        },
    )

def _extract_in_network_urls(obj: Any) -> List[str]:
    """
    Se 'obj' è un Table of Contents (index) CMS, estrae gli URL dei file in_network.
    Restituisce [] se non è un index.
    """
    urls: List[str] = []

    def _push_from(seq: Iterable[Dict[str, Any]]):
        for item in seq:
            if not isinstance(item, dict):
                continue
            loc = item.get("location") or item.get("url") or item.get("link")
            if isinstance(loc, str) and loc.strip():
                urls.append(loc.strip())

    if isinstance(obj, dict):
        # Struttura piatta: { in_network_files: [...] }
        if isinstance(obj.get("in_network_files"), list):
            _push_from(obj["in_network_files"])

        # Struttura annidata: { reporting_structure: [{ in_network_files: [...]}, ...] }
        if isinstance(obj.get("reporting_structure"), list):
            for rs in obj["reporting_structure"]:
                if isinstance(rs, dict) and isinstance(rs.get("in_network_files"), list):
                    _push_from(rs["in_network_files"])

        # Alcuni index hanno "files": [{type: "in_network", location: "..."}]
        if isinstance(obj.get("files"), list):
            in_net = [f for f in obj["files"] if isinstance(f, dict) and str(f.get("type","")).lower().startswith("in")]
            _push_from(in_net)

    return list(dict.fromkeys(urls))  # dedup, preserva ordine


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
    
def _infer_index_month(url_or_name: str) -> Optional[str]:
    # es. .../2025-02-01_uhc_index.json -> 2025-02
    m = _re.search(r'(\d{4}-\d{2})-\d{2}', url_or_name)
    return m.group(1) if m else None

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

# Estrai tutti i candidati utili da uno ZIP
def _zip_candidates(data: bytes) -> list[zipfile.ZipInfo]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = [m for m in zf.infolist()
                 if not m.is_dir() and any(m.filename.lower().endswith(ext) for ext in ACCEPTED_INNER_EXTS)]
    return infos

def _read_inner_from_zip(data: bytes, inner_name: str) -> bytes:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        try:
            with zf.open(inner_name, "r") as f:
                payload = f.read(MAX_DECOMPRESSED_BYTES + 1)
        except KeyError:
            raise HTTPException(404, f"Inner file not found in ZIP: {inner_name}")
    if len(payload) > MAX_DECOMPRESSED_BYTES:
        raise HTTPException(413, "Decompressed ZIP content too large.")
    if inner_name.lower().endswith(".gz"):
        try:
            payload = gzip.decompress(payload)
        except Exception:
            raise HTTPException(400, "Inner GZ in ZIP is invalid.")
    return payload

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
    inner = SOURCE_INNER.get()

    # --- parsing generalista + index-detection ---
    try:
        obj = json.loads(text)
        suggestions = _extract_in_network_urls(obj)
        if suggestions:
            _raise_index_suggestions(suggestions)
        rows = _find_first_array_of_objects(obj) or []
        if not rows:
            raise HTTPException(400, "Expected an array of objects or { data: [...] }.")
    except json.JSONDecodeError:
        rows = _find_first_array_of_objects(text) or []
        if not rows:
            rows = parse_csv(text)

    # Normalizzazione + filtro
    rows = normalize_rows(rows)
    if req.codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

    return {"count": len(rows), "rows": rows, "meta": {"source": req.url, "source_inner": inner}}

@app.post("/api/summary")
async def summary(req: SummaryReq):
    text = await read_text(req.url)
    inner = SOURCE_INNER.get()

    # --- parsing generalista + index-detection ---
    try:
        obj = json.loads(text)
        suggestions = _extract_in_network_urls(obj)
        if suggestions:
            _raise_index_suggestions(suggestions)
        rows = _find_first_array_of_objects(obj) or []
        if not rows:
            raise HTTPException(400, "Expected an array of objects or { data: [...] }.")
    except json.JSONDecodeError:
        rows = _find_first_array_of_objects(text) or []
        if not rows:
            rows = parse_csv(text)

    rows = normalize_rows(rows)

    if req.codes and rows and isinstance(rows[0], dict):
        code_set = set(map(str, req.codes))
        rows = [r for r in rows if str(r.get("code")) in code_set]

    res = _summarize(rows)
    if not req.include_rows:
        res.pop("rows", None)

    res["meta"] = {
        "source": req.url,
        "source_inner": inner,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "index_month_hint": _infer_index_month(req.url) or _infer_index_month(inner or ""),
        "include_rows": req.include_rows,
    }
    return res

#     # ---- META (DENTRO la funzione) ----
#     meta = {
#     "source": req.url,
#     "source_inner": inner,  # <-- nuovo
#     "fetched_at": datetime.now(timezone.utc).isoformat(),
#     "index_month_hint": _infer_index_month(req.url) or _infer_index_month(inner or ""),
#     "include_rows": req.include_rows,
# }
#     res["meta"] = meta
#     return res


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

def _text_from_upload(filename: str, data: bytes) -> tuple[str, Optional[str]]:
    """
    Ritorna (text, inner_name).
    - Se filename .gz -> gunzip.
    - Se filename .zip -> estrae il primo file 'utile' (json/csv/ndjson/jsonl/txt o .gz),
      con guardrail su dimensione decompressa. Se l'inner è .gz, lo scompatta.
    - Altrimenti decodifica UTF-8.
    """
    name = (filename or "").lower()

    # .gz "esterno"
    if name.endswith(".gz"):
        try:
            raw = gzip.decompress(data)
        except Exception:
            raise HTTPException(400, "Invalid GZ file.")
        return raw.decode("utf-8", errors="replace"), None

    # .zip "esterno"
    if name.endswith(".zip"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                # prendi il primo membro "utile"
                candidates = [
                    n for n in zf.namelist()
                    if not n.endswith("/") and any(n.lower().endswith(ext) for ext in ACCEPTED_INNER_EXTS)
                ]
                if not candidates:
                    raise HTTPException(415, "ZIP does not contain a .json/.csv/.ndjson file.")
                inner = candidates[0]
                with zf.open(inner, "r") as f:
                    payload = f.read(MAX_DECOMPRESSED_BYTES + 1)
                if len(payload) > MAX_DECOMPRESSED_BYTES:
                    raise HTTPException(413, "Decompressed ZIP content too large.")
                # Se l'interno è a sua volta .gz, scompatta
                if inner.lower().endswith(".gz"):
                    try:
                        payload = gzip.decompress(payload)
                    except Exception:
                        raise HTTPException(400, "Inner GZ in ZIP is invalid.")
                return payload.decode("utf-8", errors="replace"), inner
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, "Invalid ZIP file.")

    # fallback: file testo "normale"
    return data.decode("utf-8", errors="replace"), None

def _text_from_upload_with_choice(filename: str, data: bytes, inner_name: Optional[str]) -> Tuple[str, Optional[str], Optional[list[str]]]:
    """
    Ritorna (text, chosen_inner, inner_list_if_multiple)
    - Se .zip e inner_name è fornito -> apre quello
    - Se .zip e più candidati ma inner_name mancante -> non legge nulla e ritorna la lista
    - Altri formati come prima
    """
    name = (filename or "").lower()

    # .gz esterno
    if name.endswith(".gz"):
        try:
            raw = gzip.decompress(data)
        except Exception:
            raise HTTPException(400, "Invalid GZ file.")
        return raw.decode("utf-8", errors="replace"), None, None

    # .zip esterno
    if name.endswith(".zip"):
        try:
            candidates = _zip_candidates(data)
            if not candidates:
                raise HTTPException(415, "ZIP does not contain a .json/.csv/.ndjson file.")
            # se inner_name non c'è e ci sono molte opzioni -> chiedi scelta
            if inner_name is None and len(candidates) > 1:
                return "", None, [c.filename for c in candidates]
            # se inner_name mancante ma 1 candidato, usa quello
            chosen = inner_name or candidates[0].filename
            payload = _read_inner_from_zip(data, chosen)
            return payload.decode("utf-8", errors="replace"), chosen, None
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, "Invalid ZIP file.")

    # flat text
    return data.decode("utf-8", errors="replace"), None, None


@app.post("/api/summary_upload")
async def summary_upload(
    file: UploadFile = File(...),
    codes: List[str] = Form(default=[]),
    include_rows: bool = Form(default=True),
    inner_name: Optional[str] = Form(default=None),   # <-- NOVITÀ
):
    # -- lettura a chunk come prima --
    total = 0
    chunks: List[bytes] = []
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_SIZE_BYTES:
            raise HTTPException(413, "File too large (limit 50MB). For larger files use streaming mode.")
        chunks.append(chunk)
    data = b"".join(chunks)

    # ► nuovo: normalizza testo tenendo conto di inner_name e molteplici candidati ZIP
    text, chosen_inner, inner_list = _text_from_upload_with_choice(getattr(file, "filename", ""), data, inner_name)

    # se ci sono più candidati e non hanno scelto -> ritorna 409 + lista
    if inner_list is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "zip_inner_required",
                "message": "This ZIP contains multiple files. Pick one.",
                "inner_files": inner_list[:50],  # safety
            },
        )

    # --- parsing generalista + index-detection come prima ---
    rows: List[Dict[str, Any]] = []
    try:
        obj = json.loads(text)
        suggestions = _extract_in_network_urls(obj)
        if suggestions:
            _raise_index_suggestions(suggestions)  # 409 + suggestions (URL)
    except json.JSONDecodeError:
        rows = _find_first_array_of_objects(text) or []
        if not rows:
            rows = parse_csv(text)
    else:
        rows = _find_first_array_of_objects(obj) or []
        if not rows:
            raise HTTPException(400, "Expected an array, { data: [...] }, any object with a first array of objects, or NDJSON.")

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

    res["meta"] = {
        "source": getattr(file, "filename", "upload"),
        "source_inner": chosen_inner,  # <-- se ZIP
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "index_month_hint": _infer_index_month(getattr(file, "filename", "")) or _infer_index_month(chosen_inner or ""),
        "include_rows": include_rows,
    }
    return res