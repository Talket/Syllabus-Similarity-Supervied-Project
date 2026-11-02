"""Train the 3 configurations x several seeds, then evaluate everything against the baselines.

    python scripts/run_experiments.py                # ~7 runs, a few minutes each on a GTX 1050 Ti
    python scripts/run_experiments.py --seeds 1 2 3 --base sentence-transformers/all-MiniLM-L6-v2 --tag minilm
Resumable: skips a run whose model folder already exists.
"""
import sys, subprocess, argparse
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--seeds", nargs="+", type=int, default=[1, 2, 3])
ap.add_argument("--base", default="sentence-transformers/all-MiniLM-L6-v2")
ap.add_argument("--tag", default="")
ap.add_argument("--epochs", default="4")
a = ap.parse_args()

SYN, TR, VA = "data/labeled/synthetic_pairs.csv", "data/splits/train.csv", "data/splits/val.csv"
configs = {"real_only": [TR], "real_plus_synth": [TR, SYN], "synth_only": [SYN]}
pre = (a.tag + "_") if a.tag else ""
trained = []
for cfg, train_files in configs.items():
    for seed in (a.seeds if cfg != "synth_only" else a.seeds[:1]):
        out = f"models/{pre}{cfg}_s{seed}"
        trained.append(out)
        if Path(out).exists():
            print("skip (exists):", out); continue
        print(f"\n##### TRAIN {out}", flush=True)
        r = subprocess.run([sys.executable, "src/train/finetune_biencoder.py", "--train", *train_files, "--val", VA,
                            "--base", a.base, "--epochs", a.epochs, "--seed", str(seed), "--out", out])
        if r.returncode != 0:
            sys.exit(f"training failed for {out}")
print("\n##### EVALUATE", flush=True)
models = ["tfidf", f"zeroshot:{a.base}", *trained]
if not a.tag:
    models.insert(2, "zeroshot:BAAI/bge-small-en-v1.5")
subprocess.run([sys.executable, "scripts/evaluate.py", "--models", *models, "--out", f"results/eval_{a.tag or 'minilm'}.csv"])
