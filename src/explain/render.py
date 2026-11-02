"""Small HTML helpers for the UI (kept free of Streamlit so they can be tested)."""
import html, re

STATUS_ICON = {"NOVEL": "🟥 NOVEL", "partly covered": "🟨 partly covered", "covered": "🟩 covered"}
BAND_ICON = {"strong": "🟩 strong", "partial": "🟨 partial", "none": "⬜ none"}


def highlight(text, phrases, color="#fff3a3"):
    """HTML-escape `text` and wrap occurrences of any phrase (case-insensitive) in <mark>."""
    esc = html.escape(text)
    ps = sorted({html.escape(p) for p in phrases if p and p.strip()}, key=len, reverse=True)
    if not ps:
        return esc.replace("$", "&#36;")
    pat = re.compile("|".join(re.escape(p) for p in ps), re.I)
    out = pat.sub(lambda m: f'<mark style="background:{color}">{m.group(0)}</mark>', esc)
    return out.replace("$", "&#36;")   # keep Streamlit from treating $...$ as LaTeX
