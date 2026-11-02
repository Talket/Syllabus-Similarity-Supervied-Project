"""Mine candidate unit pairs from the merged courses and cut them into labeling batches.

    python scripts/mine_pairs.py --method tfidf                # no downloads
    python scripts/mine_pairs.py --method emb --model sentence-transformers/all-MiniLM-L6-v2
    options: --n 2000 --batch 40 --k 3
Output: data/labeled/candidates.csv, data/labeled/to_label/batch_XX.json
"""
import sys, json, argparse
from pathlib import Path
import numpy as np, pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ap = argparse.ArgumentParser()
ap.add_argument("--courses", default="data/processed/courses_merged.jsonl")
ap.add_argument("--method", choices=["tfidf", "emb"], default="emb")
ap.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2")
ap.add_argument("--n", type=int, default=2000)
ap.add_argument("--batch", type=int, default=40)
ap.add_argument("--k", type=int, default=3, help="nearest neighbours per unit")
ap.add_argument("--seed", type=int, default=42)
args = ap.parse_args()
rng = np.random.RandomState(args.seed)

# ---- load units
rows = []
for line in open(args.courses, encoding="utf-8"):
    c = json.loads(line)
    for u in c["units"]:
        rows.append(dict(unit_id=f"{c['course_id']}::U{u['order']}", course_id=c["course_id"],
                         domain=c["domain"], text=f"{u['title']}: {u['text']}"))
U = pd.DataFrame(rows)
print(f"{len(U)} units from {U.course_id.nunique()} courses")

# ---- similarity matrix
if args.method == "tfidf":
    from sklearn.feature_extraction.text import TfidfVectorizer
    X = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit_transform(U.text)
    S = (X @ X.T).toarray()
else:
    from sentence_transformers import SentenceTransformer
    E = SentenceTransformer(args.model).encode(U.text.tolist(), normalize_embeddings=True, show_progress_bar=True)
    S = E @ E.T

course = U.course_id.to_numpy(dtype=object)
domain = U.domain.to_numpy(dtype=object)
S = S.copy()
S[course[:, None] == course[None, :]] = -1          # never pair a course with itself
np.fill_diagonal(S, -1)

pairs = {}
def add(i, j, stratum):
    key = (min(i, j), max(i, j))
    if key not in pairs:
        pairs[key] = stratum

n = len(U)
for i in range(n):                                  # 1) close neighbours
    for j in np.argsort(-S[i])[: args.k]:
        if S[i, j] > 0:
            add(i, j, "neighbour")
for i in range(n):                                  # 2) hard negatives: same domain, mid-rank
    cand = [j for j in np.argsort(-S[i])[args.k: args.k + 12] if S[i, j] > 0 and domain[j] == domain[i]]
    if cand:
        add(i, int(rng.choice(cand)), "hard_negative")
n_easy = int(0.12 * args.n)                         # 3) easy negatives
while sum(v == "easy" for v in pairs.values()) < n_easy:
    i, j = rng.randint(n), rng.randint(n)
    if course[i] != course[j]:
        add(i, j, "easy")

keys = list(pairs)
if len(keys) > args.n:                              # keep all easy, subsample the rest
    easy = [k for k in keys if pairs[k] == "easy"]
    rest = [k for k in keys if pairs[k] != "easy"]
    rng.shuffle(rest)
    keys = easy + rest[: max(args.n - len(easy), 0)]
rng.shuffle(keys)

out = pd.DataFrame([dict(
    pair_id=f"R{idx:05d}", text_a=U.text[i], text_b=U.text[j],
    course_a=U.course_id[i], course_b=U.course_id[j],
    unit_id_a=U.unit_id[i], unit_id_b=U.unit_id[j],
    sim=round(float(S[i, j]), 4), stratum=pairs[(i, j)]) for idx, (i, j) in enumerate(keys)])

Path("data/labeled/to_label").mkdir(parents=True, exist_ok=True)
out.to_csv("data/labeled/candidates.csv", index=False)
for b in range(0, len(out), args.batch):            # labeler sees ONLY id + texts (no sim score)
    chunk = out.iloc[b: b + args.batch][["pair_id", "text_a", "text_b"]]
    json.dump(chunk.to_dict("records"), open(f"data/labeled/to_label/batch_{b // args.batch:02d}.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
print(f"{len(out)} candidate pairs -> data/labeled/candidates.csv")
print(out.stratum.value_counts().to_string())
print(f"{-(-len(out) // args.batch)} batches in data/labeled/to_label/")
