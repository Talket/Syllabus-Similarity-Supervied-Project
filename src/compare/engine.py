"""Course-level comparison: retrieve, align units, explain, score novelty (unit level AND topic level).

UNIT LEVEL. Unit similarity s (cosine of the fine-tuned model) becomes an overlap degree (a heuristic, not
validated against human estimates of overlap fraction):
    degree = clip((s - t_low) / (t_full - t_low), 0, 1)
t_low  = best-F1 'related' threshold; t_full = 90th percentile of known-related pairs;
t_high = 75th percentile (only names the 'strong' band). All from configs/calibration.json.
    coverage_new      = share of the PROPOSAL covered by an existing course (length-weighted mean degree)
    coverage_existing = share of the EXISTING course covered by the proposal
    novelty           = 1 - coverage of the proposal by the WHOLE library (best match per unit)

TOPIC LEVEL. Every topic phrase of the proposal is looked up among ALL topic phrases of a course / of the whole
library (not just the best-matching unit). A phrase is 'covered' if its best match scores >= t_phrase, where the
score is embedding cosine (general MiniLM) or, for phrases whose content words are contained in the other
phrase, 0.85 + 0.15 * Jaccard (so an exact wording match always beats a containment match).
"""
import re, json
from pathlib import Path
import numpy as np

from src.data.text_clean import clean_unit_text

DEFAULT_CAL = {"t_low": 0.45, "t_high": 0.60, "t_full": 0.70, "t_phrase": 0.70}
STOPT = {"and", "of", "the", "to", "for", "in", "on", "with", "a", "an", "models", "model", "methods", "method",
         "introduction", "overview", "basics", "fundamentals", "using", "use", "vs", "or", "its", "their"}
GENERIC = {"learning", "analysis", "algorithm", "algorithms", "systems", "system", "theory", "problem", "problems",
           "techniques", "technique", "data", "networks", "network", "design", "applications", "concepts",
           "regression", "classification", "clustering", "optimization", "estimation", "probability", "tree", "trees"}
LEAD = re.compile(r"^(and|then|followed by|including|plus|with|also|as well as|along with)\s+", re.I)


def load_cal(path="configs/calibration.json"):
    p = Path(path)
    return {**DEFAULT_CAL, **(json.loads(p.read_text()) if p.exists() else {})}


def split_topics(text):
    t = re.sub(r"[()]", ",", text)
    out, seen = [], set()
    for p in re.split(r"[;,:.\n/]|\s[-–—]\s", t):
        p = LEAD.sub("", p.strip(" -–•\t"))
        k = p.lower()
        if len(p) >= 3 and k not in seen:
            seen.add(k); out.append(p)
    return out


def _toks(p):
    out = set()
    for w in re.findall(r"[a-z0-9+#]+", p.lower()):
        if w in STOPT:
            continue
        out.add(w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w)
    return frozenset(out)


def _contained(A, B):
    """Content words of one phrase are all inside the other's (e.g. 'ARIMA' in 'ARIMA models')."""
    if not A or not B or max(len(A), len(B)) > 8:
        return False
    small, big = (A, B) if len(A) <= len(B) else (B, A)
    if not small <= big:
        return False
    if len(small) == 1:
        w = next(iter(small))
        return len(w) >= 4 and w not in GENERIC
    return True


def contained(a, b):
    return _contained(_toks(a), _toks(b))


def _csim(A, B):
    return 0.85 + 0.15 * len(A & B) / len(A | B)


def topic_phrases(text):
    return [p for p in split_topics(text) if _toks(p)]


def _w(texts):
    return np.array([min(len(t.split()), 100) for t in texts], float)


class Library:
    def __init__(self, courses, embedder, cal=None, phrase_embedder=None):
        self.emb = embedder
        self.pemb = phrase_embedder or embedder      # topic-phrase matching can use a different (general) model
        self.cal = {**DEFAULT_CAL, **(cal or {})}
        self.courses = {c["course_id"]: c for c in courses}
        self.meta = [(c["course_id"], u["order"], u["title"], clean_unit_text(u["text"]))
                     for c in courses for u in c["units"]]
        self.cid = np.array([m[0] for m in self.meta], dtype=object)
        self.texts = [m[3] for m in self.meta]
        self.V = embedder.encode(self.texts)
        self.w = _w(self.texts)
        self._pidx = None

    # ---- scoring helpers ----
    def degree(self, s):
        lo, hi = self.cal["t_low"], max(self.cal["t_full"], self.cal["t_low"] + 1e-6)
        return np.clip((np.asarray(s, float) - lo) / (hi - lo), 0.0, 1.0)

    def band(self, s):
        return "none" if s < self.cal["t_low"] else "partial" if s < self.cal["t_high"] else "strong"

    # ---- topic phrases ----
    def _phrase_index(self):
        if self._pidx is None:
            items = [(cid, order, p) for cid, order, _, text in self.meta for p in topic_phrases(text)]
            E = self.pemb.encode([p for _, _, p in items]) if items else np.zeros((0, 1))
            toks = [_toks(p) for _, _, p in items]
            inv = {}
            for j, t in enumerate(toks):
                for w in t:
                    inv.setdefault(w, []).append(j)
            self._pidx = (items, E, np.array([i[0] for i in items], dtype=object), toks, inv)
        return self._pidx

    def _topic_matrix(self, phrases):
        """(n_phrases x n_library_phrases) match scores."""
        items, E, _, toks, inv = self._phrase_index()
        P = self.pemb.encode(phrases) @ E.T
        for i, ph in enumerate(phrases):
            A = _toks(ph)
            cand = set()
            for w in A:
                cand.update(inv.get(w, ()))
            for j in cand:
                if _contained(A, toks[j]):
                    P[i, j] = max(P[i, j], _csim(A, toks[j]))
        return P

    def explain_pair(self, a, b):
        pa, pb = topic_phrases(a), topic_phrases(b)
        if not pa or not pb:
            return [], pa, pb
        E = self.pemb.encode(pa + pb)
        M = E[:len(pa)] @ E[len(pa):].T
        ta, tb = [_toks(p) for p in pa], [_toks(p) for p in pb]
        for i in range(len(pa)):
            for j in range(len(pb)):
                if _contained(ta[i], tb[j]):
                    M[i, j] = max(M[i, j], _csim(ta[i], tb[j]))
        shared, ua, ub = [], set(), set()
        for flat in np.argsort(-M, axis=None):
            i, j = divmod(int(flat), M.shape[1])
            if M[i, j] < self.cal["t_phrase"]:
                break
            if i in ua or j in ub:
                continue
            ua.add(i); ub.add(j)
            shared.append({"new": pa[i], "existing": pb[j], "sim": round(float(M[i, j]), 3)})
        return shared, [p for i, p in enumerate(pa) if i not in ua], [p for j, p in enumerate(pb) if j not in ub]

    def find_copies(self, units, min_frac=0.8):
        """Library courses whose unit texts are (nearly) identical to the proposal's: probably the same file."""
        mine = [clean_unit_text(u["text"]) for u in units]
        out = []
        for cid in dict.fromkeys(self.cid):
            have = {self.texts[k] for k in np.where(self.cid == cid)[0]}
            if mine and np.mean([t in have for t in mine]) >= min_frac:
                out.append(cid)
        return out

    # ---- main entry ----
    def compare(self, new, top_k=3, exclude=None):
        units = new["units"]
        texts = [clean_unit_text(u["text"]) for u in units]
        wn = _w(texts)
        S = self.emb.encode(texts) @ self.V.T
        ex = {exclude} if isinstance(exclude, str) else set(exclude or [])
        if ex:
            S[:, np.isin(self.cid, list(ex))] = -1.0
        m = len(units)

        # ---- unit-level novelty against the WHOLE library
        bi = S.argmax(1); bs = S[np.arange(m), bi]
        novelty = float(1 - (wn * self.degree(bs)).sum() / wn.sum())
        unit_rows = []
        for i, u in enumerate(units):
            c, o, t, _ = self.meta[bi[i]]
            unit_rows.append({"order": u.get("order", i + 1), "title": u.get("title", ""),
                              "status": {"none": "NOVEL", "partial": "partly covered", "strong": "covered"}[self.band(bs[i])],
                              "best_score": round(float(bs[i]), 3), "best_course": c,
                              "best_course_title": self.courses[c]["title"], "best_unit_title": t})

        # ---- topic-level coverage (all phrases of the proposal vs ALL phrases of a course / the library)
        items = [(u.get("order", i + 1), p) for i, u in enumerate(units) for p in topic_phrases(texts[i])]
        lib_items, _, pcid, _, _ = self._phrase_index()
        P = self._topic_matrix([p for _, p in items]) if items and lib_items else np.zeros((len(items), 0))
        tp = self.cal["t_phrase"]
        allowed = np.where(~np.isin(pcid, list(ex)))[0] if len(pcid) else np.array([], int)
        topic_rows = []
        for r, (order, p) in enumerate(items):
            row = {"unit": order, "topic": p, "covered": False, "score": 0.0, "course_id": "", "course_title": "",
                   "match": "", "match_unit": None}
            if len(allowed):
                j = allowed[int(P[r, allowed].argmax())]
                sc = float(P[r, j])
                row.update(score=round(sc, 3), covered=sc >= tp)
                if sc >= tp:
                    cid, o, ph = lib_items[j]
                    row.update(course_id=cid, course_title=self.courses[cid]["title"], match=ph, match_unit=o)
            topic_rows.append(row)
        n_top = len(topic_rows)
        n_cov = sum(r["covered"] for r in topic_rows)

        # ---- per-course scores
        rows = []
        for cid in dict.fromkeys(self.cid):
            if cid in ex:
                continue
            idx = np.where(self.cid == cid)[0]
            Sc = S[:, idx]
            cn = float((wn * self.degree(Sc.max(1))).sum() / wn.sum())
            ce = float((self.w[idx] * self.degree(Sc.max(0))).sum() / self.w[idx].sum())
            rows.append((cn, ce, cid, idx, Sc))
        rows.sort(key=lambda r: -r[0])

        courses_out = []
        for cn, ce, cid, idx, Sc in rows[:top_k]:
            c = self.courses[cid]
            cols = np.where(pcid == cid)[0]
            cov = {}                     # (proposal unit, phrase) -> (matching phrase, its unit) found ANYWHERE in this course
            if len(cols) and n_top:
                sub = P[:, cols]
                jj = sub.argmax(1)
                for r, (order, ph) in enumerate(items):
                    if sub[r, jj[r]] >= tp:
                        cov[(order, ph)] = (lib_items[cols[jj[r]]][2], lib_items[cols[jj[r]]][1])
            matches, unmatched = [], []
            for i in range(m):
                j = int(Sc[i].argmax()); s = float(Sc[i, j])
                uo = units[i].get("order", i + 1)
                if s < self.cal["t_low"]:
                    unmatched.append({"order": uo, "title": units[i].get("title", "")})
                    continue
                k = idx[j]
                shared, only_new, only_old = self.explain_pair(texts[i], self.texts[k])
                elsewhere = [{"topic": ph, "match": cov[(uo, ph)][0], "match_unit": cov[(uo, ph)][1]}
                             for ph in only_new if (uo, ph) in cov]
                only_new = [ph for ph in only_new if (uo, ph) not in cov]
                matches.append({"new_order": uo, "new_title": units[i].get("title", ""),
                                "old_order": self.meta[k][1], "old_title": self.meta[k][2],
                                "score": round(s, 3), "band": self.band(s), "new_text": texts[i], "old_text": self.texts[k],
                                "shared_topics": shared, "covered_elsewhere": elsewhere,
                                "only_in_new": only_new, "only_in_existing": only_old})
            courses_out.append({"course_id": cid, "title": c["title"], "institution": c.get("institution", ""),
                                "coverage_new": round(cn, 3), "coverage_existing": round(ce, 3),
                                "similarity": round(2 * cn * ce / (cn + ce + 1e-9), 3),
                                "topics_covered": len(cov), "topics_total": n_top,
                                "matches": matches, "unmatched_new_units": unmatched})
        return {"title": new.get("title", "Proposed course"), "n_units": m, "novelty": round(novelty, 3),
                "topics": {"total": n_top, "covered": n_cov, "new": n_top - n_cov, "items": topic_rows},
                "units": unit_rows, "courses": courses_out, "calibration": self.cal}


def report_to_markdown(r, max_shared=6):
    t = r.get("topics", {"total": 0})
    L = [f"# {r['title']}", f"**Unit-level novelty: {r['novelty']:.0%}** of the proposal is not covered by any existing "
         f"course ({r['n_units']} units)."]
    if t["total"]:
        L.append(f"**Topic-level: {t['new']} of {t['total']} topics are not found in any existing course.**")
    L += ["", "## Unit-by-unit novelty"]
    for u in r["units"]:
        L.append(f"- U{u['order']} *{u['title'][:60]}* → **{u['status']}** (score {u['best_score']}) "
                 f"best match: {u['best_course_title']} / {u['best_unit_title'][:50]}")
    if t["total"]:
        L += ["", "## Topics not found in any existing course"]
        for u in dict.fromkeys(x["unit"] for x in t["items"]):
            new = [x["topic"] for x in t["items"] if x["unit"] == u and not x["covered"]]
            if new:
                L.append(f"- U{u}: " + "; ".join(new))
    for c in r["courses"]:
        L += ["", f"## Closest existing course: {c['title']} ({c['institution']})",
              f"Covers **{c['coverage_new']:.0%}** of the proposal; the proposal covers **{c['coverage_existing']:.0%}** "
              f"of this course (overall similarity {c['similarity']:.0%}). "
              f"Topic level: {c['topics_covered']} of {c['topics_total']} proposal topics appear somewhere in this course."]
        for m in c["matches"]:
            L.append(f"- Proposal U{m['new_order']} ↔ U{m['old_order']} *{m['old_title'][:50]}*: **{m['band']}** ({m['score']})")
            if m["shared_topics"]:
                L.append("    - shared: " + "; ".join(f"{s['new']} ≈ {s['existing']}" for s in m["shared_topics"][:max_shared]))
            if m.get("covered_elsewhere"):
                L.append("    - also covered elsewhere in this course: " + "; ".join(
                    f"{e['topic']} ≈ {e['match']} (unit {e['match_unit']})" for e in m["covered_elsewhere"][:max_shared]))
            if m["only_in_new"]:
                L.append("    - only in proposal: " + "; ".join(m["only_in_new"][:max_shared]))
        if c["unmatched_new_units"]:
            L.append("- No counterpart here for: " + ", ".join(f"U{u['order']}" for u in c["unmatched_new_units"]))
    return "\n".join(L)
