# Frontend brief: Syllabus Lens

Give this whole file to the person or AI building the website. The backend already exists; you only build the website.

## 1. What the product does
A curriculum committee uploads two course syllabi (PDF or DOCX). A fine-tuned language model reads both, finds topics that mean the same thing even when worded differently, marks them, and reports what the proposal adds that no existing course covers. Everything the site shows must come from the backend response, never invented.

## 2. The experience wanted (the owner's words: "shock everyone when presenting")
- Cinematic, fully animated, scroll-driven landing page that explains the idea in 30 seconds. Smooth scrolling, pinned scenes, parallax, text reveals. Use GSAP + ScrollTrigger + Lenis (or Framer Motion), and WebGL/canvas (three.js, regl or plain canvas) for the point cloud.
- A prominent upload zone for TWO PDFs (drag and drop, with file chips).
- **Processing sequence** that plays while the request runs (about 3 to 15 s), then lands on the real result:
  1. Both documents slide in as paper sheets; a scan beam passes over each.
  2. Text breaks into unit blocks, then into topic phrases (use `parsed.*.units`).
  3. Every topic phrase becomes a glowing point and flies to its real position in "meaning space" (`viz.points[].x,y`, both in -1..1). Side A and side B in different colors.
  4. Matched topics pull together and draw a beam (`viz.links`), the two phrases get a marker-pen highlight sweep, and the similarity score appears.
  5. Unmatched points of A turn red ("new"); the verdict counter counts up (`report.topics.new` of `report.topics.total`).
- **Result view** (below the animation, scroll-revealed): novelty gauge; unit-by-unit table; heat-map of `viz.unit_matrix.sim`; side-by-side document panes with matched phrases highlighted (match `report.courses[0].matches[].shared_topics` and `covered_elsewhere` against `new_text` / `old_text`); filterable topic table (new / covered / all) using `report.topics.items`; a slider "topic matching strictness" (0.40 to 0.95) that re-calls the API with `t_phrase`; download of the JSON.
- Second mode: one syllabus against the library of 90 courses (`/api/compare/library`), showing the closest courses.
- An editable "detected units" table so the user can fix parsing errors, then re-run via `/api/compare/json`.
- Keyboard focus visible, `prefers-reduced-motion` respected (skip the sequence, show results), responsive down to a tablet.
- Avoid the generic AI-site look (purple gradient on black, identical rounded cards, emoji icons). The metaphor is a highlighter pen on paper.

## 3. Honesty requirements (must appear on the site, in plain words)
- Labels used to train and test come from three AI reviewers in agreement, not from professors.
- The model finds roughly 60 to 80 percent of real overlaps and is almost always right when it says two topics match.
- Novelty percentages run about 10 points high; treat them as an index for ranking.
- The demo animation reflects the real response of this run.

## 4. Backend (already built). Run: `uvicorn src.api.server:app --port 8000`
CORS is open. Interactive docs at `http://localhost:8000/docs`. If you build into `frontend/dist`, the backend serves it at `/`.

| Method and path | Input | Returns |
|---|---|---|
| GET `/api/health` | none | `{ok, courses, calibration}` |
| GET `/api/library` | none | list of `{course_id,title,institution,domain,units}` |
| POST `/api/parse` | multipart `file` | `{title,code,credits,format,units[],outcomes[],warnings[]}` |
| POST `/api/compare/pair` | multipart `file_a`, `file_b`, optional `t_phrase` | `{report, viz, parsed:{a,b}}` |
| POST `/api/compare/library` | multipart `file`, `top_k`, optional `t_phrase` | `{report, parsed}` |
| POST `/api/compare/json` | JSON `{mode:"pair"|"library", a:{title,units}, b:{title,units}, top_k, t_phrase, exclude[]}` | like the two above |

`units[]` items are `{order, title, text}`. Errors come as `{detail}` with status 400 (bad file) or 413 (over 15 MB).

### Response shape of `/api/compare/pair` (abridged real output, NPTEL ML vs INT395)
```json
{
  "report": {
    "title": "Introduction to Machine Learning", "n_units": 7, "novelty": 0.773,
    "topics": {"total": 67, "covered": 17, "new": 50, "items": [
      {"unit": 4, "topic": "Bagging", "covered": true, "score": 1.0, "course_title": "Supervised Learning",
       "match": "Bagging", "match_unit": 3},
      {"unit": 6, "topic": "Gaussian Mixture Models", "covered": false, "score": 0.449, "match": ""}]},
    "units": [{"order": 4, "title": "Weeks 6-7", "status": "covered", "best_score": 0.536,
               "best_course_title": "Supervised Learning", "best_unit_title": "Classification with scikit-learn"}],
    "courses": [{"title": "Supervised Learning", "coverage_new": 0.227, "coverage_existing": 0.136,
                 "topics_covered": 17, "topics_total": 67,
                 "matches": [{"new_order": 4, "old_order": 2, "score": 0.536, "band": "strong",
                              "new_text": "Decision Trees, Regression Trees, ...", "old_text": "Classification with ...",
                              "shared_topics": [{"new": "Decision Trees", "existing": "Decision Tree", "sim": 1.0}],
                              "covered_elsewhere": [{"topic": "Bagging", "match": "Bagging", "match_unit": 3}],
                              "only_in_new": ["Multiway Splits"], "only_in_existing": ["k-Nearest Neighbors"]}],
                 "unmatched_new_units": [{"order": 1, "title": "Weeks 0-1"}]}]
  },
  "viz": {
    "points": [{"id": 0, "side": "A", "unit": 1, "text": "Probability Theory", "x": -0.42, "y": 0.18, "covered": false},
               {"id": 70, "side": "B", "unit": 2, "text": "Decision Tree", "x": 0.31, "y": -0.22, "covered": false}],
    "links": [{"a": 31, "b": 70, "score": 1.0}],
    "unit_matrix": {"a_titles": ["Weeks 0-1"], "b_titles": ["Introduction / Data Preprocessing"], "sim": [[0.351]]}
  }
}
```
Meaning: `status` is NOVEL / partly covered / covered; `band` is partial / strong; `covered` on a point means that topic has a counterpart; `links` connect a covered A point to its B match; scores are cosine similarities (about 0.38 and above counts as related at the unit level, 0.75 and above at the topic level).

## 5. Deliverable
A static build (`npm run build`) placed in `frontend/dist`, plus a README with the one command to start it. Provide a fixture file `fixtures/pair_response.json` so the site can be demoed without the backend.
