# Syllabus Similarity & Curriculum Novelty Detection

NLP system that compares a proposed syllabus with existing ones, scores overlap,
explains which units match, and measures novelty.

## Setup
    python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
    # Install PyTorch from https://pytorch.org (use a build that supports GTX 1050 Ti), then verify:
    python -c "import torch; print(torch.cuda.is_available())"
    pip install -r requirements.txt

## Data rules (important)
1. Test/validation sets are REAL, human-labeled syllabi only. Never synthetic.
2. Split by COURSE, never by pair.
3. Model input = text only. No topic_family / rationale / difficulty features.
