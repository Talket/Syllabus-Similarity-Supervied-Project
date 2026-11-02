"""Convert the raw synthetic CSV into the canonical, leak-free pair format.

Drops: topic_family_*, domain_*, rationale, difficulty, batch_id
(they leak the label or are unavailable for real data).
"""
import sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.schemas import LABELS, LabeledPair

RAW = Path("data/raw/synthetic_v1_original.csv")
OUT = Path("data/labeled/synthetic_pairs.csv")


def prepare(raw=RAW, out=OUT) -> pd.DataFrame:
    df = pd.read_csv(raw)
    for c in ("text_a", "text_b"):
        df[c] = df[c].astype(str).str.strip()
    df = df[(df.text_a != "") & (df.text_b != "")]
    df = df[df.label.isin(LABELS)]
    df = df.drop_duplicates(subset=["text_a", "text_b"])
    rows = [
        LabeledPair(
            pair_id=r.pair_id, text_a=r.text_a, text_b=r.text_b, label=r.label,
            origin="synthetic", course_a=r.course_a, course_b=r.course_b,
            unit_id_a=f"{r.course_a}::{r.unit_a}", unit_id_b=f"{r.course_b}::{r.unit_b}",
        ).to_dict()
        for r in df.itertuples()
    ]
    clean = pd.DataFrame(rows)
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    clean.to_csv(out, index=False)
    return clean


if __name__ == "__main__":
    c = prepare()
    print(f"saved {len(c)} pairs -> {OUT}")
    print(c.label.value_counts().to_string())
