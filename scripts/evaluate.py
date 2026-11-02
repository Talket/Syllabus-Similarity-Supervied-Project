"""Compare scoring methods on labeled real pairs.

Model spec:  tfidf | zeroshot:<hf model name> | <path to a fine-tuned model dir>
Protocol: decision threshold is chosen on VAL (best F1 for 'related' = P or H), then applied to the other sets.
Metrics (positive = P or H; real data has almost no H, so we evaluate related-vs-unrelated + ranking):
  AUC, AP (average precision), Spearman (vs U/P/H = 0/1/2), F1/precision/recall at the val threshold.
Bootstrap 95% CIs for AUC and AP.

  python scripts/evaluate.py --models tfidf zeroshot:sentence-transformers/all-MiniLM-L6-v2 models/real_only_s1
"""
import sys, re, argparse
from pathlib import Path
import numpy as np, pandas as pd
from scipy.stats import spearmanr
from sklearn.metrics import roc_auc_score, average_precision_score, precision_recall_curve
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.data.text_clean import clean_unit_text

LEVEL = {"unrelated": 0, "partially_similar": 1, "highly_similar": 2}


def load(p):
    d = pd.read_csv(p)
    d["text_a"] = d.text_a.astype(str).map(clean_unit_text)
    d["text_b"] = d.text_b.astype(str).map(clean_unit_text)
    d["y"] = d.label.map(LEVEL)
    return d


def scorer(spec, train_texts):
    if spec.startswith("tfidf"):
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit(train_texts)
        def f(a, b):
            A, B = vec.transform(a), vec.transform(b)
            return np.asarray(A.multiply(B).sum(axis=1)).ravel()
        return f
    from sentence_transformers import SentenceTransformer
    m = SentenceTransformer(spec.split(":", 1)[1] if spec.startswith("zeroshot:") else spec)
    m.max_seq_length = 192
    def f(a, b):
        ea = m.encode(list(a), batch_size=64, normalize_embeddings=True, show_progress_bar=False)
        eb = m.encode(list(b), batch_size=64, normalize_embeddings=True, show_progress_bar=False)
        return (ea * eb).sum(axis=1)
    return f


def best_threshold(s, pos):
    p, r, t = precision_recall_curve(pos, s)
    f1 = 2 * p * r / np.maximum(p + r, 1e-9)
    return t[int(np.argmax(f1[:-1]))]


def ci(fn, s, pos, n=500, seed=0):
    rng = np.random.RandomState(seed); vals = []
    for _ in range(n):
        i = rng.randint(0, len(s), len(s))
        if 0 < pos[i].sum() < len(i):
            vals.append(fn(pos[i], s[i]))
    return np.percentile(vals, [2.5, 97.5]) if vals else (np.nan, np.nan)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--train", default="data/splits/train.csv")
    ap.add_argument("--val", default="data/splits/val.csv")
    ap.add_argument("--sets", nargs="+", default=["data/splits/test.csv", "data/splits/ood.csv"])
    ap.add_argument("--out", default="results/eval_all.csv")
    a = ap.parse_args()

    tr, va = load(a.train), load(a.val)
    sets = {Path(p).stem: load(p) for p in a.sets}
    rows = []
    for spec in a.models:
        name = spec.split(":", 1)[-1].replace("\\", "/").rstrip("/").split("/")[-1] if not spec.startswith("tfidf") else spec
        print("scoring:", name, flush=True)
        f = scorer(spec, pd.concat([tr.text_a, tr.text_b]))
        sv = f(va.text_a, va.text_b); thr = best_threshold(sv, (va.y > 0).values)
        for sname, d in sets.items():
            s = f(d.text_a, d.text_b); pos = (d.y > 0).values
            lo, hi = ci(roc_auc_score, s, pos); lo2, hi2 = ci(average_precision_score, s, pos)
            pred = s >= thr
            tp = (pred & pos).sum()
            rows.append(dict(model=name, set=sname, n=len(d), pos=int(pos.sum()),
                             AUC=roc_auc_score(pos, s), AUC_lo=lo, AUC_hi=hi,
                             AP=average_precision_score(pos, s), AP_lo=lo2, AP_hi=hi2,
                             spearman=spearmanr(s, d.y).correlation,
                             F1=2 * tp / max(1, pred.sum() + pos.sum()), precision=tp / max(1, pred.sum()),
                             recall=tp / max(1, pos.sum())))
    df = pd.DataFrame(rows)
    Path(a.out).parent.mkdir(exist_ok=True); df.to_csv(a.out, index=False)
    pd.set_option("display.width", 200)
    for sname in sets:
        d = df[df.set == sname]
        print(f"\n=== {sname}: n={d.n.iloc[0]}, positives={d.pos.iloc[0]} ===")
        show = d.assign(**{"AUC [95% CI]": d.apply(lambda r: f"{r.AUC:.3f} [{r.AUC_lo:.2f},{r.AUC_hi:.2f}]", axis=1),
                           "AP [95% CI]": d.apply(lambda r: f"{r.AP:.3f} [{r.AP_lo:.2f},{r.AP_hi:.2f}]", axis=1)})
        print(show[["model", "AUC [95% CI]", "AP [95% CI]", "spearman", "F1", "precision", "recall"]]
              .round(3).to_string(index=False))
    df["group"] = df.model.str.replace(r"_s\d+$", "", regex=True)
    g = df.groupby(["set", "group"])[["AUC", "AP", "F1"]].agg(["mean", "std"]).round(3)
    if (df.groupby(["set", "group"]).size() > 1).any():
        print("\n=== mean/std over seeds ==="); print(g.to_string())
    print(f"\nsaved {a.out}")


if __name__ == "__main__":
    main()
