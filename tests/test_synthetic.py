import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.data.prepare_synthetic import prepare
from src.schemas import LABELS


def test_prepare_is_clean(tmp_path):
    df = prepare(out=tmp_path / "o.csv")
    assert len(df) == 900
    assert set(df.label) == set(LABELS)
    leaky = {"topic_family_a", "topic_family_b", "rationale", "difficulty", "batch_id"}
    assert not leaky & set(df.columns)
