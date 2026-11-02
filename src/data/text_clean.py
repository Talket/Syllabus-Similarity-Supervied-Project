"""Remove scheduling noise from unit text (Week 8, Lectures 6 to 8, taught over three sessions).
Used at mining, training AND inference so the model never sees this noise."""
import re

_SCHED = r"(?:weeks?|wk|lectures?|lecs?|sessions?|classes|class|l)"
_NUM_LIST = rf"{_SCHED}\.?\s*\d+(?:\s*(?:,|and|&|to|-|–|—)\s*(?:{_SCHED}\.?\s*)?\d+)*"
PAREN = re.compile(rf"\s*\(\s*(?:{_NUM_LIST}|\d+\s*(?:lectures?|sessions?|weeks?))\s*\)", re.I)
_RANGE = r"\d+(?:\s*(?:,|and|&|-|–|to)\s*\d+)*"
LEAD = re.compile(rf"^\s*(?:weeks?|lectures?|lecs?|sessions?|module|unit)\s*{_RANGE}\s*[:\-–.]\s*", re.I)
MID = re.compile(rf"\b(?:weeks?|wk)\s*{_RANGE}\s*(?:covers?|:)\s*", re.I)
TAUGHT = re.compile(r"[,;]?\s*(?:taught|covered|spread)\s+over\s+[^.;,]*?(?:sessions?|lectures?|weeks?|classes)\b", re.I)


def clean_unit_text(t: str) -> str:
    t = PAREN.sub("", str(t))
    t = LEAD.sub("", t)
    t = MID.sub("", t)
    t = TAUGHT.sub("", t)
    t = re.sub(r"\s+([.,;:])", r"\1", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t[:1].upper() + t[1:] if t else t
