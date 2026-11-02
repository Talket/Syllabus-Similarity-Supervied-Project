"""Run baselines on the synthetic pairs (SANITY CHECK ONLY, not a final result).

    python scripts/run_baselines.py                 # TF-IDF only
    python scripts/run_baselines.py --emb all-MiniLM-L6-v2 BAAI/bge-small-en-v1.5
"""
import sys, argparse
from pathlib import Path
import numpy as np, pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.embed.baselines import tfidf_scores, embedding_scores
from src.evaluate.metrics import labels_to_ids, evaluate_scores

ap = argparse.ArgumentParser()
ap.add_argument("--emb", nargs="*", default=[])
args = ap.parse_args()

df = pd.read_csv("data/labeled/synthetic_pairs.csv")
y = labels_to_ids(df.label)
rng = np.random.RandomState(42)
idx = rng.permutation(len(df))
fit_idx, eval_idx = idx[: len(df) // 2], idx[len(df) // 2:]

results = {"tfidf": evaluate_scores(tfidf_scores(df.text_a, df.text_b), y, fit_idx, eval_idx)}
for name in args.emb:
    full = name if "/" in name else f"sentence-transformers/{name}"
    results[name] = evaluate_scores(embedding_scores(df.text_a, df.text_b, full), y, fit_idx, eval_idx)

out = pd.DataFrame(results).T
print(out.to_string())
Path("results").mkdir(exist_ok=True)
out.to_csv("results/baselines_synthetic.csv")
