"""Re-batch candidate pairs BY SPLIT (so labeling progress and test-set handling are clear).

    python scripts/make_batches.py
Writes data/labeled/batches/{train,val,test,ood}_NN.csv  (for the labeling Claudes; no scores/buckets)
and    data/labeled/batches/human_test_NN.csv            (same test pairs + empty 'label' column, for YOU)
"""
import argparse
from pathlib import Path
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument("--cands", default="data/labeled/candidates_v2.csv")
ap.add_argument("--out", default="data/labeled/batches")
ap.add_argument("--size", type=int, default=50)
a = ap.parse_args()

df = pd.read_csv(a.cands)
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
cols = ["pair_id", "course_title_a", "unit_title_a", "text_a", "course_title_b", "unit_title_b", "text_b"]
names = {"train": "train", "val": "val", "test": "test", "test_ood": "ood"}
for split, name in names.items():
    d = df[df.split == split].reset_index(drop=True)
    nb = 0
    for nb, i in enumerate(range(0, len(d), a.size), 1):
        part = d.iloc[i:i + a.size][cols]
        part.to_csv(out / f"{name}_{nb:02d}.csv", index=False)
        if name == "test":
            h = part.copy(); h["label"] = ""
            h.to_csv(out / f"human_test_{nb:02d}.csv", index=False, encoding="utf-8-sig")
    print(f"{name:6s}: {len(d):4d} pairs -> {nb} batches")
