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
