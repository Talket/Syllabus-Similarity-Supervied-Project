# Syllabus Similarity & Curriculum Novelty Detection

A curriculum-analysis project that compares course syllabi at both the unit and topic level. It combines document parsing, text embeddings, course-library retrieval, overlap explanations and a React-based visual comparison experience.

> **Important:** Similarity and novelty values are model-derived estimates, not accreditation decisions or ground-truth measures of curriculum quality. Review the source passages and evaluation notes before interpreting a score.

## What it does

- Accepts PDF and DOCX syllabi and extracts structured course units.
- Compares two syllabi directly or compares one proposal against a configured course library.
- Embeds unit text and ranks related units/courses using cosine similarity.
- Breaks units into topic phrases and identifies potential overlap and novel material.
- Explains results with coverage summaries, matched passages, a unit matrix and a machine-readable JSON report.
- Lets users edit detected units and rerun comparison.
- Provides an interactive React interface with a three-dimensional embedding visualization and presenter mode.
- Includes a Streamlit analysis interface and a FastAPI service.

## Project architecture

| Area | Path | Responsibility |
|---|---|---|
| Document parsing | `src/structure/`, `src/ingest/` | Extract course structure and text from PDF/DOCX inputs |
| Embeddings | `src/embed/` | Sentence-transformer and TF-IDF embedding backends |
| Comparison | `src/compare/` | Unit alignment, topic matching, coverage and novelty estimates |
| Explainability | `src/explain/` | Render human-readable match explanations |
| API | `src/api/` | FastAPI endpoints for parsing and comparison |
| Training | `src/train/` | Fine-tune a sentence-embedding bi-encoder |
| Evaluation | `src/evaluate/`, `tests/` | Metrics and automated checks |
| Analysis UI | `app/streamlit_app.py` | Streamlit workflow for inspecting comparisons |
| Web UI | `frontend/` | React, TypeScript and Three.js experience |
| Configuration | `configs/` | Calibration thresholds and comparison settings |
| Data | `data/` | Labeled pairs, course splits and processed data placeholders |

## Main comparison modes

### Pairwise comparison

Upload two syllabi. The parser extracts course units; the comparison engine aligns units, scores semantic similarity and presents overlapping, partially covered and potentially novel topics.

### Proposal vs. course library

Upload a proposed syllabus and retrieve the closest courses from the configured library. The UI can show ranked candidates and topic-level coverage.

### Editable extraction

Correct parser output before comparison. The frontend can submit the edited unit structure to the JSON comparison endpoint without re-uploading the source files.

## Run locally

### 1. Create a Python environment

Use Python 3.10 or newer. Install PyTorch separately using the instructions at https://pytorch.org/get-started/locally/ so the build matches your OS and hardware.

```bash
git clone https://github.com/Talket/syllabus-similarity.git
cd syllabus-similarity
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt
pip install python-multipart
```

### 2. Configure model and library inputs

The FastAPI service reads the following environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `MODEL` | `models/real_only_s1` | Sentence-transformer model directory or supported model identifier |
| `LIB` | `data/processed/courses_merged.jsonl` | Course-library JSONL file |
| `CAL` | `configs/calibration.json` | Similarity and topic calibration settings |

Model weights and processed library files are not guaranteed to be present in a fresh clone. Prepare them using the scripts and data notes in the repository before starting the live comparison service.

### 3. Start the FastAPI backend

From the repository root:

```bash
uvicorn src.api.server:app --host 127.0.0.1 --port 8000 --reload
```

API documentation is available at `http://127.0.0.1:8000/docs`.

### 4. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:8000`.

To build the frontend for the backend's static hosting:

```bash
cd frontend
npm run build
```

The backend serves `frontend/dist` from its root when that build directory exists.

### 5. Streamlit analysis interface

From the repository root, with the Python environment prepared:

```bash
streamlit run app/streamlit_app.py
```

## Frontend experience

The React frontend includes an animated comparison sequence, a unit coverage dashboard, side-by-side document views, a pairwise similarity heatmap, a topic catalogue, report export, and keyboard-driven presenter mode. See `frontend/README.md` for its controls and detailed UI behavior.

## Methodology and evaluation caveats

- Unit-level overlap is derived from calibrated embedding similarity and heuristic coverage calculations; it is not a direct human estimate of the percentage of content shared.
- Topic phrases are matched using embedding similarity and phrase-containment rules.
- The training code supports fine-tuning a sentence-transformer bi-encoder on labeled unit pairs.
- The frontend's methodology notes state that the label consensus was generated by three AI reviewers, not faculty experts. Treat those labels as a limitation, not human ground truth.
- The frontend documents approximate sensitivity and calibration behavior; those figures should not be presented as universal model performance. Validate against an independently labeled, course-separated test set.
- The training script explicitly warns that a random pair split leaks course information; use the course-level splits for meaningful evaluation.

## Data integrity

The project includes real-labeled, synthetic, validation, test and out-of-distribution data folders. Keep these sets separate. Do not allow synthetic or test pairs to leak into training or use a random pair split when courses are shared across splits.

## Current limitations

- Results depend on parser quality, embedding model, course-library coverage and calibration thresholds.
- Semantic similarity is not proof that two topics teach the same learning outcomes.
- Novelty is relative to the configured library; a topic may be flagged as novel simply because the relevant course is absent from the library.
- Local model weights and the processed 90-course library may need to be generated or supplied separately.

## License and attribution

Add the applicable licenses and source attributions for any third-party datasets, syllabus documents, model weights and external assets before redistributing the project.