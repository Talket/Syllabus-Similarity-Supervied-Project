"""Build final train/val/test/ood CSVs from candidates + Claude label files.

    python src/data/build_dataset.py
Reads : data/labeled/candidates_v2.csv, data/labeled/label_outputs/<batch>_c<N>.txt (train/val/ood),
        data/labeled/consensus/test_*.csv (test = majority of 3 labelers)
Writes: data/splits/{train,val,test,ood}.csv   (columns: pair_id,text_a,text_b,label,origin,split,course_a,course_b,bucket,n_agree)
"""
import re, glob, argparse
from collections import Counter
from pathlib import Path
import pandas as pd

NAME = {"H": "highly_similar", "P": "partially_similar", "U": "unrelated"}
LINE = re.compile(r"^\s*([0-9a-fA-F]{10})\s*,\s*([HPUhpu])\s*$")
OUTFILE = {"train": "train", "val": "val", "test": "test", "test_ood": "ood"}

ap = argparse.ArgumentParser()
ap.add_argument("--cands", default="data/labeled/candidates_v2.csv")
ap.add_argument("--labels", default="data/labeled/label_outputs")
ap.add_argument("--consensus", default="data/labeled/consensus")
ap.add_argument("--out", default="data/splits")
a = ap.parse_args()

cand = pd.read_csv(a.cands)
lab = {}
for f in sorted(glob.glob(f"{a.labels}/*.txt")):
    name = Path(f).stem
    if name.startswith("test_"):
        continue                                   # test comes from consensus files
    votes = {}
    for l in open(f, encoding="utf-8-sig"):
        m = LINE.match(l)
        if m:
            votes[m.group(1).lower()] = m.group(2).upper()
    for pid, v in votes.items():
        lab.setdefault(pid, []).append(v)
labels = {p: Counter(v).most_common(1)[0][0] for p, v in lab.items()}
nagree = {p: 1 for p in labels}

for f in sorted(glob.glob(f"{a.consensus}/test_*.csv")):
    c = pd.read_csv(f)
    c = c[c.consensus.isin(NAME)]
    for pid, l, n in zip(c.pair_id, c.consensus, c.n_agree):
        labels[pid], nagree[pid] = l, int(n)

cand["label_code"] = cand.pair_id.map(labels)
cand["n_agree"] = cand.pair_id.map(nagree)
print("LABEL COVERAGE per split (labeled / candidates):")
for sp, d in cand.groupby("split"):
    print(f"  {sp:9s}: {d.label_code.notna().sum():4d} / {len(d):4d}   " +
          str(dict(Counter(d.label_code.dropna()))))
df = cand.dropna(subset=["label_code"]).copy()
df["label"] = df.label_code.map(NAME)
df["origin"] = "real"

# leakage checks
by = {sp: d for sp, d in df.groupby("split")}
courses = {sp: set(d.course_a) | set(d.course_b) for sp, d in by.items()}
for x in courses:
    for y in courses:
        if x < y and courses[x] & courses[y]:
            raise SystemExit(f"LEAK: courses shared between {x} and {y}: {courses[x] & courses[y]}")
texts = {sp: set(d.text_a) | set(d.text_b) for sp, d in by.items()}
if "train" in texts:
    for sp in texts:
        if sp != "train":
            print(f"identical unit texts shared train/{sp}: {len(texts['train'] & texts[sp])}")

out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
cols = ["pair_id", "text_a", "text_b", "label", "origin", "split", "course_a", "course_b", "bucket", "n_agree"]
for sp, fn in OUTFILE.items():
    d = df[df.split == sp][cols]
    d.to_csv(out / f"{fn}.csv", index=False)
    print(f"wrote {out / (fn + '.csv')}: {len(d)} pairs")
