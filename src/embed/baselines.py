"""Zero-training baselines: TF-IDF cosine and pretrained sentence embeddings."""
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


def tfidf_scores(texts_a, texts_b, fit_texts=None):
    vec = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    vec.fit(fit_texts if fit_texts is not None else list(texts_a) + list(texts_b))
    A, B = vec.transform(texts_a), vec.transform(texts_b)
    return np.asarray(A.multiply(B).sum(axis=1)).ravel()  # rows are L2-normalized


def embedding_scores(texts_a, texts_b, model_name="sentence-transformers/all-MiniLM-L6-v2", batch_size=32):
    from sentence_transformers import SentenceTransformer  # lazy: heavy import
    model = SentenceTransformer(model_name)
    ea = model.encode(list(texts_a), batch_size=batch_size, normalize_embeddings=True, show_progress_bar=True)
    eb = model.encode(list(texts_b), batch_size=batch_size, normalize_embeddings=True, show_progress_bar=True)
    return (ea * eb).sum(axis=1)
