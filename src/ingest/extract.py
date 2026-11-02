"""File -> plain text. Supports PDF, DOCX, TXT/MD. Returns (text, warnings)."""
from pathlib import Path


def _pdf(path):
    import pdfplumber
    parts = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            parts.append(p.extract_text() or "")
    return "\n".join(parts)


def _docx(path):
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    d = docx.Document(path)
    lines = []
    for child in d.element.body.iterchildren():
        if child.tag.endswith("}p"):
            lines.append(Paragraph(child, d).text)
        elif child.tag.endswith("}tbl"):
            for row in Table(child, d).rows:
                cells = []
                for c in row.cells:
                    t = c.text.strip().replace("\n", " ")
                    if t and t not in cells:      # merged cells repeat
                        cells.append(t)
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def extract_text(path):
    path = Path(path)
    ext = path.suffix.lower()
    warnings = []
    if ext == ".pdf":
        text = _pdf(path)
    elif ext == ".docx":
        text = _docx(path)
    elif ext in (".txt", ".md"):
        text = path.read_text(encoding="utf-8", errors="ignore")
    else:
        raise ValueError(f"unsupported file type: {ext}")
    if len(text.strip()) < 200:
        warnings.append("Very little text found: the file may be a scanned image (OCR not enabled yet).")
    return text, warnings
