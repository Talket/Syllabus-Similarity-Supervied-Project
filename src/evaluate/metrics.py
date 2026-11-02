"""Shared metrics for similarity scoring against 3 ordinal labels."""
import itertools
import numpy as np
from scipy.stats import spearmanr
from sklearn.metrics import roc_auc_score, f1_score

from src.schemas import LABEL2ID


def labels_to_ids(labels):
    return np.array([LABEL2ID[l] for l in labels])


def fit_thresholds(scores, y, grid=60):
    """Find (t1, t2) maximizing macro-F1: score<t1 -> 0, <t2 -> 1, else 2."""
    qs = np.quantile(scores, np.linspace(0.02, 0.98, grid))
    best, best_f = (qs[0], qs[-1]), -1
    for t1, t2 in itertools.combinations(qs, 2):
        pred = np.where(scores < t1, 0, np.where(scores < t2, 1, 2))
        f = f1_score(y, pred, average="macro")
        if f > best_f:
            best, best_f = (t1, t2), f
    return best


def predict(scores, th):
    return np.where(scores < th[0], 0, np.where(scores < th[1], 1, 2))


def evaluate_scores(scores, y, fit_idx, eval_idx):
    """Thresholds fitted on fit_idx only; all metrics reported on eval_idx."""
    scores, y = np.asarray(scores), np.asarray(y)
    th = fit_thresholds(scores[fit_idx], y[fit_idx])
    s, t = scores[eval_idx], y[eval_idx]
    pred = predict(s, th)
    return {
        "spearman": round(spearmanr(s, t).correlation, 3),
        "auc_unrelated_vs_rest": round(roc_auc_score(t > 0, s), 3),
        "auc_high_vs_rest": round(roc_auc_score(t == 2, s), 3),
        "macro_f1": round(f1_score(t, pred, average="macro"), 3),
    }
