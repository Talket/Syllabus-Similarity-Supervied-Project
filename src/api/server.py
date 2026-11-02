"""HTTP API.  Run from the project root:
    pip install fastapi uvicorn python-multipart
    uvicorn src.api.server:app --port 8000          (add --reload while developing)
Docs UI:  http://localhost:8000/docs
Optional: put a built front-end in frontend/dist and it is served at http://localhost:8000/
"""
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.api.service import Service

svc: Optional[Service] = None
MAX_BYTES = 15 * 1024 * 1024


@asynccontextmanager
async def lifespan(app):
    global svc
    svc = Service(os.getenv("MODEL", "models/real_only_s1"), os.getenv("LIB", "data/processed/courses_merged.jsonl"),
                  os.getenv("CAL", "configs/calibration.json"))
    yield


app = FastAPI(title="Syllabus Lens API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def read(f: UploadFile):
    data = f.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File larger than 15 MB")
    return data


def parsed(f: UploadFile):
    try:
        return svc.parse(f.filename, read(f))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/health")
def health():
    return {"ok": True, "courses": len(svc.courses), "calibration": svc.cal}


@app.get("/api/library")
def library():
    return svc.library()


@app.post("/api/parse")
def parse(file: UploadFile = File(...)):
    return parsed(file)


@app.post("/api/compare/pair")
def compare_pair(file_a: UploadFile = File(...), file_b: UploadFile = File(...), t_phrase: Optional[float] = Form(None)):
    a, b = parsed(file_a), parsed(file_b)
    out = svc.compare_pair(a, b, t_phrase)
    out["parsed"] = {"a": a, "b": b}
    return out


@app.post("/api/compare/library")
def compare_library(file: UploadFile = File(...), top_k: int = Form(3), t_phrase: Optional[float] = Form(None)):
    a = parsed(file)
    out = svc.compare_library(a["title"], a["units"], top_k, None, t_phrase)
    out["parsed"] = a
    return out


class Doc(BaseModel):
    title: str
    units: List[dict]


class JsonReq(BaseModel):
    mode: str = "pair"                    # "pair" or "library"
    a: Doc
    b: Optional[Doc] = None
    top_k: int = 3
    t_phrase: Optional[float] = None
    exclude: List[str] = []


@app.post("/api/compare/json")           # used after the user edits the parsed units in the UI
def compare_json(req: JsonReq):
    if req.mode == "pair":
        if not req.b:
            raise HTTPException(400, "mode 'pair' needs b")
        return svc.compare_pair(req.a.dict(), req.b.dict(), req.t_phrase)
    return svc.compare_library(req.a.title, req.a.units, req.top_k, req.exclude, req.t_phrase)


if os.path.isdir("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="web")
