"""Embedders share one interface: .encode(list[str]) -> L2-normalised ndarray (n, d)."""
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


class STEmbedder:
    def __init__(self, path, max_len=192):
        from sentence_transformers import SentenceTransformer
        self.m = SentenceTransformer(path)
        self.m.max_seq_length = max_len

    def encode(self, texts):
        return self.m.encode(list(texts), batch_size=64, normalize_embeddings=True, show_progress_bar=False)


class TfidfEmbedder:
    """Keyword baseline. Used for tests and as a fallback."""
    def __init__(self, corpus):
        self.v = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit(list(corpus))

    def encode(self, texts):
        return self.v.transform(list(texts)).toarray()


def get_embedder(spec, corpus=None):
    if spec == "tfidf":
        return TfidfEmbedder(corpus)
    return STEmbedder(spec[len("zeroshot:"):] if spec.startswith("zeroshot:") else spec)
