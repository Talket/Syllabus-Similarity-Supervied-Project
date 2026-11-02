"""Set the thresholds used by the engine from labeled data -> configs/calibration.json

  t_low    : best-F1 threshold for 'related' (P or H) on pooled real val+test+ood pairs
  t_high   : 75th percentile of the scores of those related pairs ('strong overlap' band; a presentation
             choice, NOT validated against H labels because real H pairs are too rare)
  t_full   : 90th percentile of those related scores (a unit at/above this counts as fully covered)
  t_phrase : lowest threshold giving >= --precision (default 85%) for 'highly_similar' vs rest on the synthetic topic-level
             pairs, computed with the PHRASE model (general MiniLM; never trained on synthetic data)
  python scripts/calibrate.py --model models/real_only_s1
"""
import sys, json, argparse
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.metrics import precision_recall_curve

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.embed.embedder import get_embedder
from src.data.text_clean import clean_unit_text


def best_thr(s, pos):
    p, r, t = precision_recall_curve(pos, s)
    f1 = 2 * p * r / np.maximum(p + r, 1e-9)
    return float(t[int(np.argmax(f1[:-1]))])


ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--phrase_model", default="sentence-transformers/all-MiniLM-L6-v2")
ap.add_argument("--precision", type=float, default=0.85)
ap.add_argument("--t_phrase", type=float, default=0.75,
                help="topic-matching threshold actually used (default from a manual topic-level check on one syllabus pair)")
ap.add_argument("--real", nargs="+", default=["data/splits/val.csv", "data/splits/test.csv", "data/splits/ood.csv"])
ap.add_argument("--synthetic", default="data/labeled/synthetic_pairs.csv")
ap.add_argument("--train", default="data/splits/train.csv")
ap.add_argument("--out", default="configs/calibration.json")
a = ap.parse_args()

tr = pd.read_csv(a.train)
emb = get_embedder(a.model, corpus=pd.concat([tr.text_a, tr.text_b]).map(clean_unit_text))


def thr_precision(s, pos, target):
    p, r, t = precision_recall_curve(pos, s)
    ok = np.where(p[:-1] >= target)[0]
    return float(t[ok[0]]) if len(ok) else float(t[-1])


def score(d, e):
    A = e.encode(d.text_a.astype(str).map(clean_unit_text)); B = e.encode(d.text_b.astype(str).map(clean_unit_text))
    return (A * B).sum(1)


real = pd.concat([pd.read_csv(p) for p in a.real]); s = score(real, emb); pos = (real.label != "unrelated").values
t_low = best_thr(s, pos); t_high = float(np.percentile(s[pos], 75))
pemb = emb if a.phrase_model == a.model or a.model == "tfidf" else get_embedder(a.phrase_model)
pemb_name = a.model if pemb is emb else a.phrase_model
syn = pd.read_csv(a.synthetic); ss = score(syn, pemb)
t_phrase = thr_precision(ss, (syn.label == "highly_similar").values, a.precision)
by_prec = {str(q): round(thr_precision(ss, (syn.label == "highly_similar").values, q), 3) for q in (0.8, 0.85, 0.9, 0.95)}
t_full = float(np.percentile(s[pos], 90))
cal = {"t_low": round(t_low, 3), "t_high": round(t_high, 3), "t_full": round(t_full, 3),
       "t_phrase": a.t_phrase, "t_phrase_synthetic": round(t_phrase, 3), "model": a.model, "phrase_model": pemb_name, "t_phrase_by_precision": by_prec,
       "n_real_pairs": int(len(real)), "n_real_positive": int(pos.sum()), "n_synthetic_pairs": int(len(syn))}
Path(a.out).parent.mkdir(exist_ok=True); Path(a.out).write_text(json.dumps(cal, indent=2))
print(json.dumps(cal, indent=2))
print("score percentiles  unrelated:", np.percentile(s[~pos], [50, 90, 99]).round(3),
      "| related:", np.percentile(s[pos], [10, 50, 90]).round(3))
