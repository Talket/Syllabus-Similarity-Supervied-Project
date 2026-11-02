"""Mine candidate unit pairs from validated real courses, split by SUBJECT GROUP.

Why groups: if MIT-ML is in train and NPTEL-ML in test, the model has already seen the subject.
Courses are clustered by subject (mean unit embedding); a whole cluster goes to ONE split.

    python src/data/mine_pairs.py --n 2000 --force_test_inst LPU
Outputs:
  data/splits/course_splits.csv           course -> group -> split
  data/labeled/candidates_v2.csv          full info, for us
  data/labeled/label_batches_v2/batch_XX.csv 50 pairs each, for the labeling Claudes (no scores/buckets/splits)
"""
import argparse, json, hashlib, sys
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import AgglomerativeClustering

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.data.text_clean import clean_unit_text

SPLIT_W = {"train": 0.60, "val": 0.12, "test": 0.18, "test_ood": 0.10}
BUCKET_W = {"nn": 0.45, "mid": 0.25, "lexhard": 0.15, "random": 0.15}


def load_units(path):
    courses = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
    rows = []
    for c in courses:
        for u in c["units"]:
            rows.append(dict(course_id=c["course_id"], course_title=c["title"], domain=c["domain"],
                             unit_id=f'{c["course_id"]}::U{u["order"]}', unit_title=u["title"],
                             text=clean_unit_text(u["text"])))
    return courses, pd.DataFrame(rows)


def vectors(texts, kind):
    """L2-normalised dense vectors, one row per text."""
    if kind == "tfidf":
        return TfidfVectorizer(stop_words="english", sublinear_tf=True).fit_transform(texts).toarray()
    from sentence_transformers import SentenceTransformer
    name = {"minilm": "sentence-transformers/all-MiniLM-L6-v2"}.get(kind, kind)
    return SentenceTransformer(name).encode(list(texts), normalize_embeddings=True, batch_size=64)


def group_courses(ids, units, V, thr):
    cv = []
    for c in ids:
        v = V[units.index[units.course_id == c].values].mean(axis=0)
        cv.append(v / (np.linalg.norm(v) + 1e-9))
    if len(ids) < 2:
        return {c: 0 for c in ids}
    lab = AgglomerativeClustering(n_clusters=None, metric="cosine", linkage="average",
                                  distance_threshold=thr).fit_predict(np.vstack(cv))
    return dict(zip(ids, lab))


def assign_splits(courses, units, V, ood_domains, force_inst, thr, seed, group_split=True):
    rng = np.random.RandomState(seed)
    info = {c["course_id"]: c for c in courses}
    smap = {cid: "test_ood" for cid, c in info.items() if c["domain"] in ood_domains}
    rest = [cid for cid in info if cid not in smap]
    g = group_courses(rest, units, V, thr) if group_split else {cid: i for i, cid in enumerate(rest)}
    groups = {}
    for cid, gi in g.items():
        groups.setdefault(gi, []).append(cid)
    forced = {gi for gi, members in groups.items() if any(info[c]["institution"] in force_inst for c in members)}
    cnt = {"train": 0, "val": 0, "test": 0}
    n = len(rest)
    t_target, v_target = round(0.15 * n), round(0.15 * n)
    for gi in forced:
        for c in groups[gi]:
            smap[c] = "test"
        cnt["test"] += len(groups[gi])
    keys = [k for k in groups if k not in forced]
    for k in rng.permutation(len(keys)):
        gi = keys[k]
        s = "test" if cnt["test"] < t_target else "val" if cnt["val"] < v_target else "train"
        for c in groups[gi]:
            smap[c] = s
        cnt[s] += len(groups[gi])
    return smap, g, info


def mine_split(df, V, quota, rng):
    n = len(df)
    if n < 4:
        return []
    S = V @ V.T
    X = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit_transform(df.text)
    T = (X @ X.T).toarray()
    cid = np.asarray(df.course_id.tolist(), dtype=object)
    txt = np.asarray(df.text.tolist(), dtype=object)
    iu, ju = np.triu_indices(n, k=1)
    keep = (cid[iu] != cid[ju]) & (txt[iu] != txt[ju])
    iu, ju = iu[keep], ju[keep]
    if len(iu) == 0:
        return []
    s, t = S[iu, ju], T[iu, ju]
    q = np.quantile
    # nn: each unit's 2 nearest units in OTHER courses (where real overlap shows up)
    Sm = S.copy()
    Sm[cid[:, None] == cid[None, :]] = -np.inf
    Sm[txt[:, None] == txt[None, :]] = -np.inf
    top = np.argsort(-Sm, axis=1)[:, :2]
    M = np.zeros((n, n), dtype=bool)
    for k in range(top.shape[1]):
        ok = np.isfinite(Sm[np.arange(n), top[:, k]])
        M[np.arange(n)[ok], top[ok, k]] = True
    M = M | M.T
    pools = {
        "nn": np.where(M[iu, ju])[0],
        "mid": np.where((s >= q(s, 0.85)) & ~M[iu, ju])[0],
        "lexhard": np.where((t >= q(t, 0.90)) & (s < q(s, 0.85)))[0],
        "random": np.arange(len(s)),
    }
    chosen, used = [], set()
    for b, w in BUCKET_W.items():
        pool = [p for p in pools[b] if p not in used]
        k = min(int(round(quota * w)), len(pool))
        for p in (rng.choice(pool, size=k, replace=False) if k else []):
            used.add(p)
            chosen.append((b, iu[p], ju[p], s[p], t[p]))
    out = []
    for b, i, j, sc, tc in chosen:
        if rng.rand() < 0.5:
            i, j = j, i
        A, B = df.iloc[i], df.iloc[j]
        out.append(dict(bucket=b, text_a=A.text, text_b=B.text, course_a=A.course_id, course_b=B.course_id,
                        unit_id_a=A.unit_id, unit_id_b=B.unit_id, unit_title_a=A.unit_title, unit_title_b=B.unit_title,
                        course_title_a=A.course_title, course_title_b=B.course_title,
                        emb_score=round(float(sc), 4), tfidf_score=round(float(tc), 4)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--courses", default="data/processed/courses_merged.jsonl")
    ap.add_argument("--n", type=int, default=2000)
    ap.add_argument("--embedder", default="minilm")
    ap.add_argument("--ood", nargs="*", default=["Business", "Humanities"])
    ap.add_argument("--force_test_inst", nargs="*", default=[], help="institutions whose subject groups must go to test")
    ap.add_argument("--group_thr", type=float, default=0.35, help="cosine distance for merging courses into a subject group")
    ap.add_argument("--no_group_split", action="store_true", help="split by single course instead of subject group")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="data/labeled/candidates_v2.csv")
    ap.add_argument("--splits_out", default="data/splits/course_splits.csv")
    ap.add_argument("--batch_size", type=int, default=50)
    a = ap.parse_args()
    rng = np.random.RandomState(a.seed)

    courses, units = load_units(a.courses)
    V = vectors(units.text.tolist(), a.embedder)
    smap, g, info = assign_splits(courses, units, V, set(a.ood), set(a.force_test_inst), a.group_thr,
                                  a.seed, not a.no_group_split)
    units["split"] = units.course_id.map(smap)

    sp = pd.DataFrame([dict(course_id=c, title=info[c]["title"], institution=info[c]["institution"],
                            domain=info[c]["domain"], group=g.get(c, -1), split=smap[c]) for c in info])
    Path(a.splits_out).parent.mkdir(parents=True, exist_ok=True)
    sp.sort_values(["group", "course_id"]).to_csv(a.splits_out, index=False)
    print("\nSUBJECT GROUPS with 2+ courses (check these look right):")
    for gi, d in sp[sp.group >= 0].groupby("group"):
        if len(d) > 1:
            print(f"  [{d.split.iloc[0]}] " + " | ".join(d.title.str[:32] + " (" + d.institution + ")"))
    print("courses per split:", sp.split.value_counts().to_dict())

    present = {s: w for s, w in SPLIT_W.items() if (units.split == s).any()}
    tot = sum(present.values())
    rows = []
    for s, w in present.items():
        idx = units.index[units.split == s].values
        part = units.loc[idx].reset_index(drop=True)
        for r in mine_split(part, V[idx], int(a.n * w / tot), rng):
            r["split"] = s
            rows.append(r)
    df = pd.DataFrame(rows)
    df["pair_id"] = [hashlib.md5((x + y).encode()).hexdigest()[:10] for x, y in zip(df.unit_id_a, df.unit_id_b)]
    df = df.drop_duplicates("pair_id").sample(frac=1, random_state=a.seed).reset_index(drop=True)
    df["label"] = ""
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(a.out, index=False)

    c2s = pd.concat([df[["course_a", "split"]].set_axis(["c", "split"], axis=1),
                     df[["course_b", "split"]].set_axis(["c", "split"], axis=1)]).drop_duplicates()
    assert c2s.c.is_unique, "course leaked across splits!"

    bdir = Path(a.out).parent / ("label_batches_" + Path(a.out).stem.split("_")[-1])
    bdir.mkdir(exist_ok=True)
    cols = ["pair_id", "course_title_a", "unit_title_a", "text_a", "course_title_b", "unit_title_b", "text_b"]
    k = 0
    for k, i in enumerate(range(0, len(df), a.batch_size), 1):
        df.iloc[i:i + a.batch_size][cols].to_csv(bdir / f"batch_{k:02d}.csv", index=False)
    print(f"\n{len(df)} candidate pairs -> {a.out}; {k} label batches -> {bdir}")
    print(pd.crosstab(df.split, df.bucket).to_string())


if __name__ == "__main__":
    main()
