"""Service layer behind the HTTP API (no web framework here, so it can be tested directly)."""
import json, os, tempfile, threading
from pathlib import Path
import numpy as np

from src.structure.parse import parse_file
from src.embed.embedder import get_embedder
from src.compare.engine import Library, load_cal, topic_phrases
from src.data.text_clean import clean_unit_text


def norm_units(units):
    return [{"order": i + 1, "title": str(u.get("title") or f"Unit {i + 1}"), "text": str(u.get("text", ""))}
            for i, u in enumerate(units) if str(u.get("text", "")).strip()]


class Service:
    def __init__(self, model="models/real_only_s1", lib_path="data/processed/courses_merged.jsonl",
                 cal_path="configs/calibration.json"):
        self.courses = [json.loads(l) for l in open(lib_path, encoding="utf-8") if l.strip()]
        self.cal = load_cal(cal_path)
        corpus = [u["text"] for c in self.courses for u in c["units"]]
        emb = get_embedder(model, corpus=corpus)
        pm = self.cal.get("phrase_model")
        pemb = get_embedder(pm, corpus=corpus) if pm and pm != model else None
        self.lib = Library(self.courses, emb, self.cal, phrase_embedder=pemb)
        self.lock = threading.Lock()

    def library(self):
        return [{"course_id": c["course_id"], "title": c["title"], "institution": c.get("institution", ""),
                 "domain": c.get("domain", ""), "units": len(c["units"])} for c in self.courses]

    def parse(self, filename, data):
        suffix = Path(filename or "").suffix.lower()
        if suffix not in (".pdf", ".docx", ".txt"):
            raise ValueError("Unsupported file type. Use PDF, DOCX or TXT.")
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as t:
            t.write(data); path = t.name
        try:
            p = parse_file(path)
        finally:
            os.unlink(path)
        return {"title": p["title"], "code": p["code"], "credits": p["credits"], "format": p["format"],
                "units": p["units"], "outcomes": p["outcomes"], "warnings": p["warnings"]}

    def compare_library(self, title, units, top_k=3, exclude=None, t_phrase=None, skip_copies=True):
        units = norm_units(units)
        ex = set(exclude or [])
        if skip_copies:
            ex |= set(self.lib.find_copies(units))
        with self.lock:
            self.lib.cal = {**self.lib.cal, **({"t_phrase": t_phrase} if t_phrase else {})}
            rep = self.lib.compare({"title": title, "units": units}, top_k=top_k, exclude=sorted(ex))
        rep["excluded_as_identical"] = sorted(ex)
        return {"report": rep}

    def compare_pair(self, a, b, t_phrase=None):
        a_units, b_units = norm_units(a["units"]), norm_units(b["units"])
        cal = {**self.lib.cal, **({"t_phrase": t_phrase} if t_phrase else {})}
        cb = {"course_id": "B", "title": b["title"], "institution": "uploaded", "units": b_units}
        with self.lock:
            tmp = Library([cb], self.lib.emb, cal, phrase_embedder=self.lib.pemb)
            rep = tmp.compare({"title": a["title"], "units": a_units}, top_k=1)
            viz = self._viz(tmp, a_units, b_units, rep)
        return {"report": rep, "viz": viz}

    @staticmethod
    def _viz(tmp, a_units, b_units, rep):
        """Real coordinates (2-D PCA of the topic embeddings) + links, for the front-end animation."""
        ph = lambda us: [(u["order"], p) for u in us for p in topic_phrases(clean_unit_text(u["text"]))]
        pa, pb = ph(a_units), ph(b_units)
        texts = [p for _, p in pa] + [p for _, p in pb]
        if len(texts) < 3:
            return {"points": [], "links": [], "unit_matrix": {}}
        X = tmp.pemb.encode(texts); X = X - X.mean(0)
        XY = X @ np.linalg.svd(X, full_matrices=False)[2][:2].T
        XY = XY / (np.abs(XY).max() + 1e-9)
        items = {(r["unit"], r["topic"]): r for r in rep["topics"]["items"]}
        pts = []
        for i, (o, p) in enumerate(pa):
            r = items.get((o, p), {})
            pts.append({"id": i, "side": "A", "unit": o, "text": p, "x": round(float(XY[i, 0]), 4),
                        "y": round(float(XY[i, 1]), 4), "covered": bool(r.get("covered"))})
        for j, (o, p) in enumerate(pb):
            k = len(pa) + j
            pts.append({"id": k, "side": "B", "unit": o, "text": p, "x": round(float(XY[k, 0]), 4),
                        "y": round(float(XY[k, 1]), 4), "covered": False})
        links = []
        for pt in pts[:len(pa)]:
            r = items.get((pt["unit"], pt["text"]), {})
            if r.get("covered"):
                js = [q["id"] for q in pts[len(pa):] if q["text"] == r["match"]]
                if js:
                    links.append({"a": pt["id"], "b": js[0], "score": r["score"]})
        S = tmp.emb.encode([clean_unit_text(u["text"]) for u in a_units]) @ tmp.V.T
        return {"points": pts, "links": links,
                "unit_matrix": {"a_titles": [u["title"] for u in a_units], "b_titles": [u["title"] for u in b_units],
                                "sim": np.round(S, 3).tolist()}}
