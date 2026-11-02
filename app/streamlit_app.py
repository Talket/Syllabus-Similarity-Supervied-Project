"""Streamlit app: upload a syllabus, review the parsed units, compare with the course library.

Run from the project root:   streamlit run app/streamlit_app.py
"""
import sys, json, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd
import streamlit as st

from src.structure.parse import parse_file
from src.embed.embedder import get_embedder
from src.compare.engine import Library, load_cal, report_to_markdown
from src.explain.render import highlight, STATUS_ICON, BAND_ICON

st.set_page_config(page_title="Syllabus Similarity", layout="wide")
st.title("Syllabus Similarity & Curriculum Novelty")
st.caption("Compare a proposed course with the existing library: how much overlaps, the evidence, and what is new.")

# ------------------------------------------------------------------ sidebar
with st.sidebar:
    st.header("Settings")
    model = st.text_input("Model", "models/real_only_s1")
    lib_path = st.text_input("Course library", "data/processed/courses_merged.jsonl")
    cal_path = st.text_input("Calibration file", "configs/calibration.json")
    top_k = st.slider("Closest courses to show", 1, 8, 3)
    cal0 = load_cal(cal_path)
    t_phrase = st.slider("Topic matching strictness", 0.40, 0.95,
                         float(min(max(cal0["t_phrase"], 0.40), 0.95)), 0.01,
                         help="Lower = more shared topics are found, but more false matches. Higher = stricter.")


@st.cache_resource(show_spinner="Loading the model and indexing the library ...")
def load_library(model, lib_path, cal_path):
    courses = [json.loads(l) for l in open(lib_path, encoding="utf-8") if l.strip()]
    cal = load_cal(cal_path)
    corpus = [u["text"] for c in courses for u in c["units"]]
    emb = get_embedder(model, corpus=corpus)
    pm = cal.get("phrase_model")
    pemb = get_embedder(pm, corpus=corpus) if pm and pm != model else None
    return Library(courses, emb, cal, phrase_embedder=pemb), courses


try:
    lib, courses = load_library(model, lib_path, cal_path)
except Exception as e:
    st.error(f"Could not load the model or library: {e}")
    st.stop()
st.sidebar.success(f"{len(courses)} courses / {len(lib.texts)} units indexed")

# ------------------------------------------------------------------ input
def read_upload(label, prefix):
    """File uploader + parsed-units editor. Returns {'title','units','key'} or None."""
    f = st.file_uploader(label, type=["pdf", "docx", "txt"], key=f"{prefix}_file")
    if f is None:
        return None
    key = f"{prefix}-{f.name}-{f.size}"
    if st.session_state.get(f"{prefix}_key") != key:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(f.name).suffix) as tmp:
            tmp.write(f.getbuffer())
            tmp_path = tmp.name
        try:
            st.session_state[f"{prefix}_parsed"] = parse_file(tmp_path)
        except Exception as e:
            st.session_state[f"{prefix}_parsed"] = None
            st.error(f"Could not read this file: {e}")
        st.session_state[f"{prefix}_key"] = key
    parsed = st.session_state.get(f"{prefix}_parsed")
    if not parsed:
        return None
    for w in parsed["warnings"]:
        st.warning(w)
    title = st.text_input("Course title", parsed["title"], key=f"{key}_title")
    with st.expander(f"Detected units ({len(parsed['units'])}): review and edit if the parser got it wrong",
                     expanded=(prefix == "single")):
        df = pd.DataFrame([{"title": u["title"], "text": u["text"]} for u in parsed["units"]])
        edited = st.data_editor(df, num_rows="dynamic", key=f"{key}_editor")
    units = []
    for r in edited.itertuples():
        if isinstance(r.text, str) and r.text.strip():
            units.append({"order": len(units) + 1,
                          "title": r.title if isinstance(r.title, str) and r.title else f"Unit {len(units) + 1}",
                          "text": r.text})
    return {"title": title, "units": units, "key": key}


mode = st.radio("What do you want to do?",
                ["One syllabus vs the whole library", "Two syllabi, directly", "Demo: a library course vs the others"],
                horizontal=True)
proposal = None
labels = {f"{c['course_id']} | {c['title']} ({c.get('institution', '')})": c["course_id"] for c in courses}

if mode == "One syllabus vs the whole library":
    up = read_upload("Upload the proposed syllabus", "single")
    if up:
        copies = lib.find_copies(up["units"])
        if copies:
            st.info("This file is identical to library course(s) " + ", ".join(copies) + ". They are excluded below, "
                    "otherwise the proposal would just match itself. Remove them from the list to see the exact-duplicate result.")
        default = [k for k, v in labels.items() if v in copies]
        excl = st.multiselect("Library courses to leave out of this comparison", list(labels), default=default,
                              key=f"excl_{up['key']}")
        proposal = {"title": up["title"], "units": up["units"], "exclude": [labels[k] for k in excl], "against": None}

elif mode == "Two syllabi, directly":
    ca, cb = st.columns(2)
    with ca:
        st.markdown("**Syllabus A (the proposal)**")
        a_up = read_upload("Upload syllabus A", "a")
    with cb:
        st.markdown("**Syllabus B (to compare against)**")
        b_up = read_upload("Upload syllabus B", "b")
    if a_up and b_up:
        proposal = {"title": a_up["title"], "units": a_up["units"], "exclude": [],
                    "against": {"course_id": "UPLOADED-B", "title": b_up["title"], "institution": "uploaded file",
                                "units": b_up["units"]}}

else:
    choice = st.selectbox("Pick a course", list(labels))
    c = next(x for x in courses if x["course_id"] == labels[choice])
    st.caption("The chosen course is compared against all OTHER courses in the library.")
    proposal = {"title": c["title"], "units": c["units"], "exclude": [c["course_id"]], "against": None}

# ------------------------------------------------------------------ compare
if proposal and proposal["units"]:
    if st.button("Compare", type="primary"):
        cal_now = {**lib.cal, "t_phrase": t_phrase}
        with st.spinner("Comparing ..."):
            if proposal["against"]:
                target = Library([proposal["against"]], lib.emb, cal_now, phrase_embedder=lib.pemb)
                k = 1
            else:
                lib.cal = cal_now
                target, k = lib, top_k
            st.session_state["report"] = target.compare({"title": proposal["title"], "units": proposal["units"]},
                                                        top_k=k, exclude=proposal["exclude"])


def show_report(rep):
    st.divider()
    st.subheader(rep["title"])
    best = rep["courses"][0] if rep["courses"] else None
    tp = rep.get("topics", {"total": 0, "new": 0, "covered": 0, "items": []})
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Unit-level novelty", f"{rep['novelty']:.0%}",
              help="Share of the proposal's units not covered by ANY existing course (heuristic index).")
    c2.metric("New topics", f"{tp['new']} of {tp['total']}",
              help="Topic phrases of the proposal found in no unit of any existing course.")
    if best:
        c3.metric("Closest course covers", f"{best['coverage_new']:.0%}")
        c3.caption(f"{best['title']} ({best['institution']})")
    n_novel = sum(u["status"] == "NOVEL" for u in rep["units"])
    c4.metric("Novel units", f"{n_novel} of {rep['n_units']}")

    st.markdown("#### Unit-by-unit: is it new?")
    st.dataframe(pd.DataFrame([{
        "Unit": u["order"], "Title": u["title"], "Status": STATUS_ICON[u["status"]], "Score": u["best_score"],
        "Best match in library": f"{u['best_course_title']} / {u['best_unit_title']}"} for u in rep["units"]]))

    if tp["total"]:
        st.markdown("#### Topic-level view: what is new, what is already taught")
        st.caption("Every topic phrase of the proposal is searched in ALL units of the library, not just the best-matching "
                   "unit. Use the strictness slider in the sidebar to control how close a match must be.")
        view = st.radio("Show", ["New topics only", "Already covered", "All"], horizontal=True, key="topic_view")
        rows = []
        for x in tp["items"]:
            if (view == "New topics only" and x["covered"]) or (view == "Already covered" and not x["covered"]):
                continue
            rows.append({"Unit": x["unit"], "Topic": x["topic"],
                         "Status": "🟩 covered" if x["covered"] else "🟥 new",
                         "Found in": f"{x['course_title']} (unit {x['match_unit']})" if x["covered"] else "",
                         "Matching phrase": x["match"], "Match score": x["score"]})
        if rows:
            st.dataframe(pd.DataFrame(rows))
        else:
            st.write("Nothing to show for this filter.")

    st.markdown("#### Closest existing courses")
    for n, c in enumerate(rep["courses"]):
        head = (f"{c['title']} ({c['institution']}) — covers {c['coverage_new']:.0%} of the proposal "
                f"({c['topics_covered']} of {c['topics_total']} topics); the proposal covers {c['coverage_existing']:.0%} of it")
        with st.expander(head, expanded=(n == 0)):
            if not c["matches"]:
                st.write("No unit of the proposal has a meaningful counterpart in this course.")
            for m in c["matches"]:
                st.markdown(f"**Proposal unit {m['new_order']} ↔ {m['old_title']}** &nbsp; "
                            f"{BAND_ICON[m['band']]} (score {m['score']})")
                a, b = st.columns(2)
                a.markdown('<div style="font-size:0.9rem"><b>Proposal</b><br>' +
                           highlight(m["new_text"], [s["new"] for s in m["shared_topics"]]) + "</div>", unsafe_allow_html=True)
                b.markdown('<div style="font-size:0.9rem"><b>Existing course</b><br>' +
                           highlight(m["old_text"], [s["existing"] for s in m["shared_topics"]]) + "</div>", unsafe_allow_html=True)
                if m["shared_topics"]:
                    st.caption("Shared topics: " + "; ".join(f"{s['new']} ≈ {s['existing']}" for s in m["shared_topics"]))
                if m.get("covered_elsewhere"):
                    st.caption("Also covered elsewhere in this course: " + "; ".join(
                        f"{e['topic']} ≈ {e['match']} (unit {e['match_unit']})" for e in m["covered_elsewhere"]))
                if m["only_in_new"]:
                    st.caption("Only in the proposal: " + "; ".join(m["only_in_new"][:12]))
                if m["only_in_existing"]:
                    st.caption("Only in the existing course: " + "; ".join(m["only_in_existing"][:12]))
            if c["unmatched_new_units"]:
                st.caption("No counterpart in this course for proposal units: " +
                           ", ".join(str(u["order"]) for u in c["unmatched_new_units"]))

    d1, d2 = st.columns(2)
    d1.download_button("Download report (Markdown)", report_to_markdown(rep), file_name="similarity_report.md")
    d2.download_button("Download full report (JSON)", json.dumps(rep, indent=2, ensure_ascii=False),
                       file_name="similarity_report.json")

    with st.expander("How to read this report (limits)"):
        st.markdown(
            "- Unit scores are cosine similarities from a fine-tuned MiniLM model. On held-out real unit pairs it separated "
            "overlapping from unrelated units with AUC ≈ 0.95 (only 22 positive test pairs; labels are LLM consensus).\n"
            "- **Coverage and novelty percentages are heuristic indices.** Trust the ranking of courses and the unit-level "
            "evidence more than the exact percentages.\n"
            "- Known failure modes: units that share a word but not a topic can score as partial overlap, and the "
            "'strong' band is generous. Please check the highlighted evidence.\n"
            "- Topic matching strictness (sidebar) trades missed shared topics against false ones.")


rep = st.session_state.get("report")
if rep:
    show_report(rep)
