"""Merge LLM-labeled batches into the canonical pair file and make the human verification set.

Save each Claude reply (a JSON list) as data/labeled/labels_raw/<anything>.json, then:
    python scripts/ingest_labels.py --verify 200
Outputs: data/labeled/real_pairs_llm.csv, data/labeled/verify_me.csv
"""
import sys, json, glob, argparse
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.schemas import LABELS

ap = argparse.ArgumentParser()
ap.add_argument("--verify", type=int, default=200)
ap.add_argument("--seed", type=int, default=42)
args = ap.parse_args()

cand = pd.read_csv("data/labeled/candidates.csv").set_index("pair_id")
got, problems = {}, []
for f in sorted(glob.glob("data/labeled/labels_raw/*.json")):
    txt = open(f, encoding="utf-8").read().strip()
    txt = txt.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        items = json.loads(txt)
    except json.JSONDecodeError as e:
        problems.append(f"{Path(f).name}: bad JSON ({e})"); continue
    for it in items:
        pid, lab = it.get("pair_id"), it.get("label")
        if pid not in cand.index: problems.append(f"{Path(f).name}: unknown pair_id {pid}")
        elif lab not in LABELS:   problems.append(f"{Path(f).name}: bad label {lab} for {pid}")
        else: got[pid] = lab

df = cand.loc[list(got)].copy()
df["label"] = pd.Series(got)
df["origin"], df["annotator_1"], df["annotator_2"] = "real", "llm", ""
df = df.reset_index()
df.to_csv("data/labeled/real_pairs_llm.csv", index=False)
print(f"labeled pairs: {len(df)} / {len(cand)}  | problems: {len(problems)}")
print(df.label.value_counts().to_string())
print(pd.crosstab(df.stratum, df.label).to_string())
for p in problems[:15]: print("  PROBLEM", p)

if args.verify and len(df):                          # stratified by LLM label so rare classes get checked
    per = max(args.verify // 3, 1)
    v = df.groupby("label", group_keys=False).apply(lambda g: g.sample(min(len(g), per), random_state=args.seed))
    v = v.sample(frac=1, random_state=args.seed)[["pair_id", "text_a", "text_b"]].assign(human_label="")
    v.to_csv("data/labeled/verify_me.csv", index=False)
    print(f"verification set ({len(v)} pairs, LLM labels hidden) -> data/labeled/verify_me.csv")
