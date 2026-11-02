"""Validate and merge course JSONL files produced by data-collection runs.

Usage:
    python src/data/validate_courses.py data/processed/courses/*.jsonl

Each line = one course:
{"course_id","title","institution","department","level","source_url",
 "domain","units":[{"order":1,"title":"...","text":"..."}]}
Writes data/processed/courses_merged.jsonl and prints a report.
"""
import json, sys, glob, re
from pathlib import Path
from collections import Counter

REQ = ["course_id", "title", "institution", "department", "source_url", "domain", "units"]
OUT = Path("data/processed/courses_merged.jsonl")


def check(c):
    errs = []
    for k in REQ:
        if not c.get(k):
            errs.append(f"missing {k}")
    if not re.match(r"^(https?|local)://", str(c.get("source_url", ""))):
        errs.append("source_url not a URL")
    units = c.get("units") or []
    if not 3 <= len(units) <= 20:
        errs.append(f"{len(units)} units (need 3-20)")
    for i, u in enumerate(units):
        n = len(str(u.get("text", "")).split())
        if n < 5:
            errs.append(f"unit {i+1} text too short ({n} words)")
        if n > 200:
            errs.append(f"unit {i+1} text too long ({n} words)")
        if not u.get("title"):
            errs.append(f"unit {i+1} no title")
    texts = [u.get("text", "").strip().lower() for u in units]
    if len(set(texts)) < len(texts):
        errs.append("duplicate unit texts")
    return errs


def main(paths):
    files = [f for p in paths for f in glob.glob(p)]
    seen, good, bad = set(), [], []
    for f in files:
        for ln, line in enumerate(open(f, encoding="utf-8"), 1):
            line = line.strip()
            if not line:
                continue
            try:
                c = json.loads(line)
            except json.JSONDecodeError as e:
                bad.append((f, ln, [f"bad JSON: {e}"]))
                continue
            errs = check(c)
            if c.get("course_id") in seen:
                errs.append("duplicate course_id")
            if errs:
                bad.append((f, ln, errs))
            else:
                seen.add(c["course_id"])
                good.append(c)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        for c in good:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"valid courses: {len(good)} | rejected: {len(bad)} | units: {sum(len(c['units']) for c in good)}")
    print("by domain:", dict(Counter(c["domain"] for c in good)))
    for f, ln, e in bad[:20]:
        print(f"  REJECT {Path(f).name}:{ln} -> {'; '.join(e)}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["data/processed/courses/*.jsonl"])
