"""Check format + agreement between labeler outputs for given batches, and write consensus labels.

    python scripts/check_agreement.py --batches test_01
    python scripts/check_agreement.py --batches test_01 test_02 test_03 test_04 --show 25
Expects data/labeled/label_outputs/<batch>_c1.txt, _c2.txt, _c3.txt (lines: pair_id,H|P|U)
Writes data/labeled/consensus/<batch>.csv  (pair_id, c1, c2, c3, consensus, n_agree)
"""
import re, argparse, itertools
from collections import Counter
from pathlib import Path
import pandas as pd

LINE = re.compile(r"^\s*([0-9a-fA-F]{10})\s*,\s*([HPUhpu])\s*$")


def read_labels(path):
    labels, bad = {}, 0
    for l in open(path, encoding="utf-8-sig"):
        if not l.strip():
            continue
        m = LINE.match(l)
        if m:
            labels[m.group(1).lower()] = m.group(2).upper()
        else:
            bad += 1
    return labels, bad


def kappa(a, b):
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    pe = sum(ca[k] / n * cb[k] / n for k in set(ca) | set(cb))
    return (po - pe) / (1 - pe) if pe < 1 else 1.0


ap = argparse.ArgumentParser()
ap.add_argument("--batches", nargs="+", required=True)
ap.add_argument("--dir", default="data/labeled/label_outputs")
ap.add_argument("--batch_dir", default="data/labeled/batches")
ap.add_argument("--show", type=int, default=15, help="how many disagreements to print")
a = ap.parse_args()

rows = []
for b in a.batches:
    cand = pd.read_csv(Path(a.batch_dir) / f"{b}.csv").set_index("pair_id")
    labs = {}
    for c in (1, 2, 3):
        p = Path(a.dir) / f"{b}_c{c}.txt"
        if not p.exists():
            print(f"[{b}] MISSING file {p.name}"); continue
        labs[c], bad = read_labels(p)
        miss = set(cand.index) - set(labs[c]); extra = set(labs[c]) - set(cand.index)
        print(f"[{b}] c{c}: {len(labs[c])} labels | malformed lines: {bad} | missing pairs: {len(miss)} | unknown ids: {len(extra)}")
    for pid in cand.index:
        r = {"batch": b, "pair_id": pid}
        for c in labs:
            r[f"c{c}"] = labs[c].get(pid)
        rows.append(r)
df = pd.DataFrame(rows)
cs = [c for c in ("c1", "c2", "c3") if c in df]
full = df.dropna(subset=cs).copy()
print(f"\npairs labeled by all {len(cs)} Claudes: {len(full)} / {len(df)}")
if len(full) == 0:
    raise SystemExit("nothing to compare yet")

print("\nLabel distribution:")
for c in cs:
    print(f"  {c}: " + ", ".join(f"{k}={v}" for k, v in sorted(Counter(full[c]).items())))
print("\nPairwise agreement:")
for x, y in itertools.combinations(cs, 2):
    ag = (full[x] == full[y]).mean()
    print(f"  {x} vs {y}: {ag:.0%} agree | Cohen's kappa = {kappa(full[x], full[y]):.2f}")

def consensus(r):
    cnt = Counter(r[c] for c in cs).most_common()
    return (cnt[0][0], cnt[0][1]) if cnt[0][1] >= 2 else ("NONE", 1)
full[["consensus", "n_agree"]] = full.apply(lambda r: pd.Series(consensus(r)), axis=1)
print(f"\nunanimous: {(full.n_agree == len(cs)).sum()} | majority only: {((full.n_agree >= 2) & (full.n_agree < len(cs))).sum()} | no majority: {(full.consensus == 'NONE').sum()}")
print("consensus distribution:", dict(Counter(full.consensus)))

out = Path("data/labeled/consensus"); out.mkdir(parents=True, exist_ok=True)
for b, d in full.groupby("batch"):
    d.drop(columns="batch").to_csv(out / f"{b}.csv", index=False)

dis = full[full.n_agree < len(cs)]
if len(dis):
    print(f"\nDISAGREEMENTS (showing {min(a.show, len(dis))} of {len(dis)}):")
    for _, r in dis.head(a.show).iterrows():
        c = pd.read_csv(Path(a.batch_dir) / f"{r.batch}.csv").set_index("pair_id").loc[r.pair_id]
        print(f"\n {r.pair_id}  " + "  ".join(f"{k}={r[k]}" for k in cs))
        print(f"   A [{c.unit_title_a[:40]}]: {c.text_a[:150]}")
        print(f"   B [{c.unit_title_b[:40]}]: {c.text_b[:150]}")
