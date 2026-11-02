"""Compare a proposed syllabus (PDF/DOCX/TXT) with the library of existing courses.

  python scripts/compare_cli.py path/to/proposal.pdf --model models/real_only_s1 --top 3
  python scripts/compare_cli.py data/raw/Syllabus_1.pdf --model models/real_only_s1 --exclude LPU-INT395
"""
import sys, json, argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.structure.parse import parse_file
from src.embed.embedder import get_embedder
from src.compare.engine import Library, load_cal, report_to_markdown

ap = argparse.ArgumentParser()
ap.add_argument("file")
ap.add_argument("--model", required=True)
ap.add_argument("--lib", default="data/processed/courses_merged.jsonl")
ap.add_argument("--cal", default="configs/calibration.json")
ap.add_argument("--phrase_model", default=None, help="defaults to the one stored in the calibration file")
ap.add_argument("--t_phrase", type=float, default=None, help="override topic-matching threshold (lower = more matches)")
ap.add_argument("--top", type=int, default=3)
ap.add_argument("--exclude", default=None, help="course_id to leave out (when the file is already in the library)")
ap.add_argument("--json", default=None, help="also save the full report as JSON")
a = ap.parse_args()

courses = [json.loads(l) for l in open(a.lib, encoding="utf-8") if l.strip()]
emb = get_embedder(a.model, corpus=[u["text"] for c in courses for u in c["units"]])
cal = load_cal(a.cal)
if a.t_phrase is not None:
    cal["t_phrase"] = a.t_phrase
pm = a.phrase_model or cal.get("phrase_model")
corpus = [u["text"] for c in courses for u in c["units"]]
pemb = get_embedder(pm, corpus=corpus) if pm and pm != a.model else None
lib = Library(courses, emb, cal, phrase_embedder=pemb)
p = parse_file(a.file)
for w in p["warnings"]:
    print("WARNING:", w)
rep = lib.compare({"title": p["title"], "units": p["units"]}, top_k=a.top, exclude=a.exclude)
print(report_to_markdown(rep))
if a.json:
    Path(a.json).write_text(json.dumps(rep, indent=2, ensure_ascii=False))
