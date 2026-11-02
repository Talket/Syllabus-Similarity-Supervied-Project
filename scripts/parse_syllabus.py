"""Parse syllabus files into the project's course JSONL format.

    python scripts/parse_syllabus.py file1.pdf file2.docx --institution LPU --domain CS/AI \
        --out data/processed/courses/local_lpu.jsonl
"""
import sys, json, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.structure.parse import parse_file, to_course_record

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="+")
ap.add_argument("--institution", required=True)
ap.add_argument("--domain", required=True, help="CS/AI | Math/Stats | Engineering | Business | Humanities")
ap.add_argument("--department", default="")
ap.add_argument("--level", default="UG")
ap.add_argument("--weeks_per_unit", type=int, default=2)
ap.add_argument("--out", default=None)
a = ap.parse_args()

records = []
for f in a.files:
    p = parse_file(f, weeks_per_unit=a.weeks_per_unit)
    print(f"\n== {Path(f).name}: [{p['format']}] {p['code']} {p['title']} | credits={p['credits']} | "
          f"{len(p['units'])} units | {len(p['outcomes'])} outcomes")
    for u in p["units"]:
        print(f"   U{u['order']}: {u['title'][:60]}  ({len(u['text'].split())} words)")
    for w in p["warnings"]:
        print("   WARNING:", w)
    records.append(to_course_record(p, a.institution, a.domain, a.department, a.level))
if a.out:
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nwrote {len(records)} courses -> {a.out}")
