"""Core data schema shared by every component."""
from dataclasses import dataclass, asdict
from typing import Optional

LABELS = ("unrelated", "partially_similar", "highly_similar")
LABEL2ID = {l: i for i, l in enumerate(LABELS)}


@dataclass
class Course:
    course_id: str
    title: str
    institution: str
    department: str = ""
    code: str = ""
    level: str = ""            # UG / PG
    credits: Optional[float] = None
    source_url: str = ""


@dataclass
class Unit:
    unit_id: str               # e.g. "NPTEL-CS101::U3"
    course_id: str
    order: int
    title: str
    text: str                  # topics joined as plain text


@dataclass
class LabeledPair:
    pair_id: str
    text_a: str
    text_b: str
    label: str                 # one of LABELS
    origin: str                # "real" | "synthetic"
    course_a: str = ""
    course_b: str = ""
    unit_id_a: str = ""
    unit_id_b: str = ""
    annotator_1: str = ""
    annotator_2: str = ""

    def __post_init__(self):
        if self.label not in LABELS:
            raise ValueError(f"bad label: {self.label}")

    def to_dict(self):
        return asdict(self)
