"""Plain text -> structured syllabus (course info, units, sections, outcomes).

Handles three layouts, in this order:
  1. "Unit I / Module 2 / Chapter 3" headers          (typical university syllabus)
  2. "Week N:" lines, grouped `weeks_per_unit` at a time (NPTEL style)
  3. fallback: whole topic text as one unit (+ warning)
"""
import re
from pathlib import Path

from src.data.text_clean import clean_unit_text

# ---------- patterns ----------
ROMAN = r"(?:[IVXL]{1,6}|\d{1,2})"
UNIT_HDR = re.compile(rf"^\s*(?:unit|module|chapter|section)\s*[-–:.]?\s*({ROMAN})\b\s*[:\-–.]?\s*(.*)$", re.I)
WEEK_HDR = re.compile(r"^\s*(?:week|wk)\s*(\d+)\s*[:\-–.]\s*(.*)$", re.I)
HEAD = re.compile(r"^\s*([A-Z][^:\n]{2,90}?)\s+:\s*(\S.*)?$")        # "Heading : topics" (space before colon)
CO = re.compile(r"^\s*CO\s*(\d+)\s*(?:::|:|-|–)\s*(.*)$")
STOP = re.compile(r"List\s+of\s+Practicals?|Text\s*Books?\s*:|References?\s*:|Through\s+this\s+course|"
                  r"^\s*L:\s*\d+\s+T:\s*\d+|Course\s+Outcomes?|Reference\s+Books?", re.I | re.M)
FOOTER = re.compile(r"Session\s+\d{4}\s*-\s*\d{2,4}\s+Page:\s*\d+\s*/\s*\d+|Page\s+\d+\s+of\s+\d+", re.I)
CODE_TITLE = re.compile(r"^([A-Z]{2,6}\s?-?\d{2,4}[A-Z]?)\s*[:\-–]\s*(.+)$")
SMALL = {"and", "of", "to", "in", "for", "the", "a", "an", "on", "with", "or", "using"}


# ---------- helpers ----------
def _smart_title(s):
    if not s.isupper():
        return s.strip()
    words = s.lower().split()
    return " ".join(w if (i and w in SMALL) else w.capitalize() for i, w in enumerate(words))


def _join(lines):
    """Join wrapped lines; glue words split by a hyphen at line end (graph-\\nbased)."""
    out = ""
    for l in (x.strip() for x in lines):
        if not l:
            continue
        if out.endswith("-") and l[:1].islower():
            out += l
        else:
            out += (" " if out else "") + l
    return out


def _tidy(t):
    t = re.sub(r"\s+:\s+", ": ", t)
    t = re.sub(r",(?=[A-Za-z])", ", ", t)      # "function,Initialization"
    t = re.sub(r"\s{2,}", " ", t).strip()
    return clean_unit_text(t)


def _strip_outcomes(lines):
    """Remove 'CO1 :: ...' blocks wherever the PDF put them. Returns (lines, outcomes)."""
    out, outcomes, i = [], [], 0
    while i < len(lines):
        m = CO.match(lines[i])
        if not m:
            out.append(lines[i]); i += 1; continue
        buf, j = [m.group(2)], i
        while (not lines[j].rstrip().endswith(".") and j + 1 < len(lines) and j - i < 4
               and not CO.match(lines[j + 1]) and not UNIT_HDR.match(lines[j + 1])):
            j += 1
            buf.append(lines[j])
        outcomes.append({"id": f"CO{m.group(1)}", "text": _tidy(_join(buf))})
        i = j + 1
    return out, outcomes


def _cut_at_stop(lines):
    raw = "\n".join(lines)
    m = STOP.search(raw)
    return raw[:m.start()].split("\n") if m else lines


def _find_title(lines, fallback):
    nonempty = [l.strip() for l in lines if l.strip()]
    code, title = "", ""
    if nonempty:
        m = CODE_TITLE.match(nonempty[0])
        if m:
            code, title = m.group(1).replace(" ", ""), _smart_title(m.group(2))
        elif nonempty[0].isupper() and not re.match(r"(PROF|DR|PROFESSOR)\b", nonempty[0]):
            head = [nonempty[0]]                      # title may wrap over up to 3 caps lines
            for l in nonempty[1:3]:
                if l.isupper() and not re.match(r"(PROF|DR|PROFESSOR)\b", l) and ":" not in l:
                    head.append(l)
                else:
                    break
            title = _smart_title(" ".join(head))
    if not title:
        for l in nonempty[:40]:
            m = re.match(r"(?:course\s+title|title)\s*[:\-]\s*(.+)$", l, re.I)
            if m:
                title = m.group(1).strip(); break
    if not title:  # trailing all-caps block (NPTEL puts the title at the end sometimes)
        tail = []
        for l in reversed(nonempty):
            if l.isupper() and len(l) > 3:
                tail.insert(0, l)
            elif tail:
                break
        if tail:
            title = _smart_title(" ".join(tail))
    if not title and nonempty:
        f = nonempty[0]
        if (len(f.split()) <= 10 and ":" not in f and not UNIT_HDR.match(f) and not WEEK_HDR.match(f)
                and not re.search(r"universit|college|institut|department|school|syllabus|curriculum", f, re.I)):
            title = f
    title = title.strip()
    return code, title or fallback, not bool(title)


def _sections(body_lines):
    secs = []
    for l in body_lines:
        m = HEAD.match(l)
        if m:
            secs.append({"heading": m.group(1).strip(), "lines": [m.group(2) or ""]})
        elif secs:
            secs[-1]["lines"].append(l)
        else:
            secs.append({"heading": "", "lines": [l]})
    for s in secs:
        s["text"] = _tidy(_join(s.pop("lines")))
    out = []
    for s in secs:                       # drop empty and exact-duplicate consecutive sections
        if s["text"] and not (out and out[-1] == s):
            out.append(s)
    return out


# ---------- layouts ----------
def _parse_units(lines):
    idx = [i for i, l in enumerate(lines) if UNIT_HDR.match(l)]
    if len(idx) < 2:
        return None
    units = []
    for k, i in enumerate(idx):
        end = idx[k + 1] if k + 1 < len(idx) else len(lines)
        m = UNIT_HDR.match(lines[i])
        label, inline = m.group(1), m.group(2).strip()
        body = ([inline] if inline else []) + lines[i + 1:end]
        body = [l for l in _cut_at_stop(body) if l.strip()]
        secs = _sections(body)
        if not secs:
            continue
        text = _tidy(". ".join(((f"{s['heading']}: " if s["heading"] else "") + s["text"]).rstrip(".;, ")
                               for s in secs)) + "."
        if secs[0]["heading"]:
            title = " / ".join(s["heading"] for s in secs[:3])
        elif ":" in text.split(".")[0] and len(text.split(":")[0].split()) <= 10:
            title = text.split(":")[0]
        else:
            title = f"Unit {label}"
        u = {"order": len(units) + 1, "title": title, "text": text}
        if len(secs) > 1:
            u["sections"] = secs
        units.append(u)
    return units or None


def _parse_weeks(lines, weeks_per_unit):
    weeks, cur = [], None
    for l in lines:
        m = WEEK_HDR.match(l)
        if m:
            cur = {"n": int(m.group(1)), "lines": [m.group(2)]}
            weeks.append(cur)
        elif cur is not None:
            if (l.strip().isupper() and len(l.strip()) > 5) or STOP.search(l):
                cur = None           # reached a title block / next section
            elif l.strip():
                cur["lines"].append(l)
    if len(weeks) < 2:
        return None
    for w in weeks:
        w["text"] = _tidy(_join(w["lines"])).rstrip(".;,")
    units = []
    for i in range(0, len(weeks), weeks_per_unit):
        ch = weeks[i:i + weeks_per_unit]
        a, b = ch[0]["n"], ch[-1]["n"]
        units.append({"order": len(units) + 1, "title": f"Week {a}" if a == b else f"Weeks {a}-{b}",
                      "text": "; ".join(w["text"] for w in ch if w["text"]) + "."})
    return units


# ---------- public API ----------
def parse_syllabus(text, fallback_title="Untitled course", weeks_per_unit=2):
    warnings = []
    text = FOOTER.sub("\n", text)
    lines = [l.rstrip() for l in text.splitlines()]
    code, title, guessed = _find_title(lines, fallback_title)
    if guessed:
        warnings.append("Course title not found in the file; please edit it.")
    cred = re.search(r"Credits?\s*:\s*(\d+(?:\.\d+)?)", text, re.I)
    lines, outcomes = _strip_outcomes(lines)

    units = _parse_units(lines)
    fmt = "unit"
    if units is None:
        units, fmt = _parse_weeks(lines, weeks_per_unit), "week"
    if units is None:
        fmt = "fallback"
        m = re.search(r"(?:course\s+plan|syllabus|contents?|topics)\s*:?\s*$", text, re.I | re.M)
        body = [l for l in _cut_at_stop(text[m.end():].splitlines() if m else lines) if l.strip()]
        units = [{"order": 1, "title": "Entire syllabus", "text": _tidy(_join(body))}]
        warnings.append("No unit/week structure detected: the whole text was treated as ONE unit, "
                        "so unit-level explanations will be coarse.")
    return {"code": code, "title": title, "credits": float(cred.group(1)) if cred else None,
            "format": fmt, "units": units, "outcomes": outcomes, "warnings": warnings}


def parse_file(path, **kw):
    from src.ingest.extract import extract_text
    text, w = extract_text(path)
    out = parse_syllabus(text, fallback_title=Path(path).stem, **kw)
    out["warnings"] = w + out["warnings"]
    return out


def to_course_record(parsed, institution, domain, department="", level="", source="", course_id=None):
    cid = course_id or (f"{institution}-{parsed['code']}" if parsed["code"] else
                        f"{institution}-{re.sub(r'[^A-Za-z0-9]+', '-', parsed['title']).strip('-')}")
    return {"course_id": cid, "title": parsed["title"], "institution": institution, "department": department,
            "level": level, "source_url": source or f"local://{cid}", "domain": domain,
            "credits": parsed["credits"], "units": parsed["units"], "outcomes": parsed["outcomes"]}
