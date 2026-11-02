# Syllabus Lens — Frontend

> **"Find what is actually new."**
> A cinematic, offline-first curriculum comparison showpiece. Demonstrates how a fine-tuned NLP model finds semantic topic overlaps between course syllabi, projects concepts into 3D meaning-space, connects matching points, and reports novel curriculum expansions.

---

## 🚀 Quick Start (The One Command)

To run the production build offline immediately without needing the backend:

```bash
# Inside frontend/
npx vite preview --port 4173
```
Then open: **`http://localhost:4173/?fixture=1`**

### Running with the Live Python NLP Backend:
When the FastAPI backend is running:
```bash
# From the project root:
uvicorn src.api.server:app --port 8000
```
The backend automatically serves `frontend/dist` at the root: **`http://localhost:8000/`**.

---

## 🎬 Presenter Mode (Live Audience Demo)

Press **`P`** at any time to activate **Presenter Mode**:
* **Chrome & cursor hidden** for distraction-free auditorium projection.
* **Large editorial type & high-contrast elements** calibrated for readability from the back of a presentation room.
* **60-second automated cinematic playback** across all 5 scenes:
  * **Scene 0 (Hero)**: Display headline & drifting paper sheet.
  * **Scene 1 (Read 1.0)**: Scan beam pass & sheet split into Proposal vs Comparison.
  * **Scene 2 (Split 2.0)**: Modular decomposition into curricular unit blocks and topic chips.
  * **Scene 3 (Embed 3.0)**: Three.js WebGL rotating meaning-space disc with real PCA/SVD points.
  * **Scene 4 (Match 4.0)**: Constellation beams and marker-pen highlight sweeps with cosine similarity scores.
  * **Scene 5 (Verdict 5.0)**: Unmatched points turn coral and drift away; counter lands on **51 novel topics** (71% novelty).

### Presenter Keyboard Controls:
| Key | Action |
|---|---|
| **`P`** | Toggle Presenter Mode |
| **`Space`** | Pause / Resume Timeline |
| **`→` / `←`** | Step forward / backward in sequence |
| **`F`** | Toggle Fullscreen |
| **`Esc`** | Exit Presenter Mode |

---

## 🔬 Core Capabilities

### 1. Dual Upload & Time-Driven Processing Sequence
* **Drag-and-Drop Dropzone**: Supports two PDF or DOCX files ($\le 15$ MB each).
* **"⚡ Load Sample Pair" Button**: Instantly loads real offline curriculum samples (`CSE275: Optimization in ML` vs `INT255: Mathematics Behind ML`).
* **Time-Driven Animation**: While the API evaluates embeddings, scenes 1–3 play automatically, seamlessly transitioning to scenes 4 & 5 when the response arrives.
* **Skip Animation**: An always-visible "Skip to Results" button instantly lands on the dashboard.

### 2. Interactive Results Dashboard
* **(Synthesis 6.0) Novelty Gauge**: Radial SVG arc meter indicating 71% novelty score (+10pt calibrated), Net Novel topics (51), Overlap topics (3), and Curricular Units (6).
* **(Calibration 6.5) Topic Matching Strictness Slider ($t_{\text{phrase}}$)**:
  * Range: `0.40` to `0.95` (default `0.75`).
  * Raising filters topics instantly in memory.
  * Lowering re-evaluates embeddings via the API (debounced on release with loading spinner).
* **(Structure 6.1) Unit Coverage Breakdown Table**: Status chips (`NOVEL`, `PARTLY COVERED`, `COVERED`), similarity progress bars, and click-to-sync alignment.
* **(Matrix 6.2) Pairwise Cosine Affinity Heatmap**: $6 \times 6$ cross-unit affinity grid with hover inspector card.
* **(Verification 6.3) Side-by-Side Document Panes**: Aligned curriculum text comparison with multi-line safe highlighter sweeps (`box-decoration-break: clone`), and interactive filter chips for Shared Matches, Covered Elsewhere, and Novel Topics.
* **(Granularity 6.4) Granular Topic Catalog**: Searchable and filterable topic list (`All`, `Novel`, `Covered`).
* **Download Report (.json)**: Exports the full machine-readable report JSON.

### 3. One Syllabus vs. 90-Course Library Mode (`/api/compare/library`)
* Upload a single syllabus to identify the closest curriculum matches across the entire 90-course institutional library.
* Ranked **Closest Courses View** showing top matches (e.g. `INT255`, `CS7015: Deep Learning (IIT Madras)`, `CS60045: AI Search (IIT Kharagpur)`), similarity scores, proposal coverage bars, and automatic duplicate detection.

### 4. Editable Units Refinement (`/api/compare/json`)
* Click **`[ ✎ Edit Detected Units ]`** in Section 6.1 to open the curriculum editor.
* Edit module titles, modify text passages, or add/remove units to correct any parsing ambiguities.
* Click **`[ ⟳ Re-run NLP Alignment ]`** to send the structured payload to `POST /api/compare/json` and recompute vector embeddings on the fly.

### 5. Resilient Error Handling
* **Server Detail Messages**: Plain-words rendering of backend error responses (e.g. `HTTP 413: File larger than 15 MB`).
* **Backend Unreachable State**: When `http://localhost:8000` is offline, an alert banner appears with a one-click **`[⚡ Switch to Fixture Mode]`** button so the presentation never stalls.

---

## 🎨 Visual System & Performance

* **Color Ground**: Strictly near-black `#0c0c0c` (Forge Automotive inspired) with soft `#f2f1ed` editorial type.
* **Highlighter Pen Metaphor**: Signature marker sweeps in `#ffd93d` (matches), `#ff6b6b` (novel), and `#8b7cff` (violet covered elsewhere). Multi-line safe using inline spans with `box-decoration-break: clone`.
* **Zero Audio**: Strictly no sound effects or audio elements.
* **Offline Typography**: 100% self-hosted via `@fontsource` (`Fraunces` display serif, `Outfit` clean sans, `JetBrains Mono` tabular figures). Zero external CDN calls.
* **Hardware Acceleration**: Three.js WebGL rotating point cloud capped at `devicePixelRatio: 2` targeting 60 fps on integrated laptop GPUs.
* **Accessibility**: Full keyboard navigation, visible focus rings, ARIA roles, and native support for `prefers-reduced-motion` (automatically presents the dashboard immediately).

---

## ⚖️ Honesty & Transparency (Methodology)

1. **AI Reviewer Ground Truth**: Labels used to train and test the model originated from three independent AI reviewers in consensus, not human professors.
2. **Model Sensitivity**: The NLP model detects approximately 60%–80% of true semantic overlaps and demonstrates high precision when declaring topic matches.
3. **Novelty Score Calibration**: Novelty percentage metrics typically calibrate ~10 points high and are best utilized as a relative index for curriculum ranking.
4. **Data Integrity**: Every figure, label, coordinate, and highlighted passage on screen is directly bound to the NLP model output or the golden recorded fixture (`fixtures/pair_response.json`). Zero invented numbers.
