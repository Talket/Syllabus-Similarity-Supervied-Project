"""Fine-tune a sentence-embedding model (bi-encoder) on labeled unit pairs.

Loss: MSE between cosine(emb_a, emb_b) and a target score  (U=0.0, P=0.5, H=1.0).
Plain PyTorch loop (no Trainer/accelerate needed). Runs on a 4 GB GPU with the default small models.

SMOKE TEST (checks everything runs; numbers are NOT meaningful because the random split leaks):
  python src/train/finetune_biencoder.py --train data/labeled/synthetic_pairs.csv --val_frac 0.2 --epochs 1 --max_steps 30 --out models/smoke
REAL RUN (later):
  python src/train/finetune_biencoder.py --train data/splits/train.csv data/labeled/synthetic_pairs.csv --val data/splits/val.csv --epochs 4 --out models/minilm_v1
"""
import sys, argparse, random, time
from pathlib import Path
import numpy as np, pandas as pd, torch
from scipy.stats import spearmanr
from sklearn.metrics import roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.data.text_clean import clean_unit_text

TARGET = {"unrelated": 0.0, "partially_similar": 0.5, "highly_similar": 1.0, "U": 0.0, "P": 0.5, "H": 1.0}
ID = {0.0: 0, 0.5: 1, 1.0: 2}


def load(paths):
    df = pd.concat([pd.read_csv(p) for p in paths], ignore_index=True)
    df["text_a"] = df.text_a.astype(str).map(clean_unit_text)
    df["text_b"] = df.text_b.astype(str).map(clean_unit_text)
    df["target"] = df.label.map(TARGET)
    assert df.target.notna().all(), "unknown label value found"
    return df[["text_a", "text_b", "target"]]


def encode(model, texts, bs=64):
    return model.encode(list(texts), batch_size=bs, convert_to_numpy=True, normalize_embeddings=True,
                        show_progress_bar=False)


def evaluate(model, df):
    ea, eb = encode(model, df.text_a), encode(model, df.text_b)
    s = (ea * eb).sum(axis=1)
    y = df.target.values
    out = {"spearman": spearmanr(s, y).correlation}
    if len(set(y > 0)) == 2:
        out["auc_U_vs_rest"] = roc_auc_score(y > 0, s)
    if len(set(y == 1.0)) == 2:
        out["auc_H_vs_rest"] = roc_auc_score(y == 1.0, s)
    return {k: round(float(v), 3) for k, v in out.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", nargs="+", required=True)
    ap.add_argument("--val", nargs="*", default=[])
    ap.add_argument("--val_frac", type=float, default=0.0, help="smoke-test only: hold out a random fraction of train")
    ap.add_argument("--base", default="sentence-transformers/all-MiniLM-L6-v2")
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--bs", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--max_len", type=int, default=192)
    ap.add_argument("--w_p", type=float, default=2.0, help="loss weight for partial pairs")
    ap.add_argument("--w_h", type=float, default=1.5, help="loss weight for highly-similar pairs")
    ap.add_argument("--max_steps", type=int, default=0, help="stop after N steps (smoke test)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    random.seed(a.seed); np.random.seed(a.seed); torch.manual_seed(a.seed)
    from sentence_transformers import SentenceTransformer
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print("device:", dev, torch.cuda.get_device_name(0) if dev == "cuda" else "")

    train = load(a.train)
    if a.val:
        val = load(a.val)
    elif a.val_frac > 0:
        print("WARNING: random split of train for validation -> leakage, smoke test only")
        idx = np.random.permutation(len(train)); k = int(len(train) * a.val_frac)
        val, train = train.iloc[idx[:k]].reset_index(drop=True), train.iloc[idx[k:]].reset_index(drop=True)
    else:
        raise SystemExit("give --val files (or --val_frac for a smoke test)")
    print(f"train pairs: {len(train)} | val pairs: {len(val)} | train target mix: {train.target.value_counts().to_dict()}")

    model = SentenceTransformer(a.base, device=dev)
    model.max_seq_length = a.max_len
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.01)
    steps_per_epoch = (len(train) + a.bs - 1) // a.bs
    total = a.max_steps or steps_per_epoch * a.epochs
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / max(1, int(0.1 * total))) * max(0.0, (total - s) / total))
    w_of = {0.0: 1.0, 0.5: a.w_p, 1.0: a.w_h}

    best, step, log = -9, 0, []
    m0 = evaluate(model, val); print("epoch 0 (no training):", m0)
    log.append({"epoch": 0, **m0})
    t0 = time.time()
    for ep in range(1, a.epochs + 1):
        model.train()
        order = np.random.permutation(len(train))
        run = 0.0
        for i in range(0, len(order), a.bs):
            b = train.iloc[order[i:i + a.bs]]
            fa = {k: (v.to(dev) if torch.is_tensor(v) else v) for k, v in model.tokenize(b.text_a.tolist()).items()}
            fb = {k: (v.to(dev) if torch.is_tensor(v) else v) for k, v in model.tokenize(b.text_b.tolist()).items()}
            ea, eb = model(fa)["sentence_embedding"], model(fb)["sentence_embedding"]
            cos = torch.nn.functional.cosine_similarity(ea, eb)
            y = torch.tensor(b.target.values, dtype=torch.float32, device=dev)
            w = torch.tensor([w_of[t] for t in b.target.values], dtype=torch.float32, device=dev)
            loss = (w * (cos - y) ** 2).mean()
            opt.zero_grad(); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); step += 1; run += loss.item()
            if step % 20 == 0:
                print(f"  step {step}/{total} loss {run / 20:.4f}"); run = 0.0
            if a.max_steps and step >= a.max_steps:
                break
        m = evaluate(model, val)
        print(f"epoch {ep} ({time.time() - t0:.0f}s):", m)
        log.append({"epoch": ep, **m})
        if m["spearman"] > best:
            best = m["spearman"]; model.save(a.out); print(f"  saved best -> {a.out}")
        if a.max_steps and step >= a.max_steps:
            break
    Path("results").mkdir(exist_ok=True)
    pd.DataFrame(log).to_csv(f"results/train_log_{Path(a.out).name}.csv", index=False)
    print("done. best val spearman:", best)


if __name__ == "__main__":
    main()
