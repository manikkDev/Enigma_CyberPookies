# Arth Saathi — Federated Learning for Cross-Institution Financial Risk Control
## Agent-Facing Architecture & Build Specification

**Track:** FinTech · **PS 2:** Federated Learning for Cross-Institution Financial Risk Control
**Audience:** an autonomous coding agent (and the human team) building this project from scratch on top of the existing `arth-saathi` repo.

---

# 0. How to use this document

This is a **build specification**, not a narrative. Every section is written so an agent can act on it directly.

**Conventions**
- `MUST` = hard requirement. `SHOULD` = strong default; deviate only with a written reason in `DECISIONS.md`. `MAY` = optional.
- Paths are relative to the repo root `arth-saathi/` unless absolute.
- Code blocks marked `# FILE: <path>` are the intended contents (or skeleton) of that file. Copy them, then fill `TODO`s.
- Code blocks marked `# CONTRACT` define JSON shapes that MUST be honoured across services.
- Each phase ends with **Acceptance criteria**. Do not proceed to the next phase until they pass.
- When a library API in this doc differs from the installed version, **the installed version wins** — verify with `python -c "import flwr; print(flwr.__version__)"` and read the docstring. Record any deviation in `DECISIONS.md`.

**Non-negotiables (read twice)**
1. Raw customer rows MUST never leave an institution's client process. Only model arrays/metrics cross the boundary.
2. Never present synthetic data as real. Real public datasets are the base; any synthetic augmentation is labeled `is_synthetic=1` and disclosed.
3. The Neo4j graph MUST only contain pseudonymised, derived intelligence — no raw cross-institution PII.
4. Every "accuracy" claim MUST be reproducible by `make experiments` and backed by a JSON artifact in `ml-fl-service/runs/`.
5. Keep the HFL core working at all times. VFL, SecAgg, GDS are escalating differentiators — they must never break the core.

---

# 1. Problem statement & locked design decisions

## 1.1 Problem (in our words)
A customer's financial life is split: a **bank** holds repayment history, an **insurer** holds claims, a **lending app** holds spending. Nobody can pool it because moving raw data across institutions breaks data-protection law (India DPDP Act 2023, RBI localization, China PIPL). So each trains on thin, siloed data → weaker fraud detection, worse credit decisions for thin-file customers, blind spots that surface only after loss.

**Objective:** collaboratively train a sharper risk model where **raw data never moves**, and prove it is private, practical and effective.

## 1.2 Locked decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | Real public datasets, **partitioned** across simulated institutions. Synthetic only as labeled augmentation. | Standard FL research methodology; fabrication is disqualifying. |
| D2 | **Horizontal FL (HFL)** is the core; **Vertical FL (VFL)+PSI** is the showcase. | HFL = robust & demoable; VFL maps literally to "different slices of one customer". |
| D3 | Framework = **Flower (`flwr`) Message API** (`ServerApp`/`ClientApp`, `ArrayRecord`). | Framework-agnostic, simulation + deployment with same code, built-in DP & SecAgg. |
| D4 | Model ladder: XGBoost/LightGBM baseline → **Residual+Attention tabular net** → FedAvg → FedProx → FedAdam → (SCAFFOLD optional). Keep what wins on validation. | Complexity for its own sake hurts; measurable wins only. |
| D5 | Privacy = **Secure Aggregation + Differential Privacy (reported ε)** + **PSI** for VFL. | Provable, not hand-wavy. |
| D6 | Neo4j graph stores **derived** risk intelligence only. | Otherwise the graph itself leaks PII. |
| D7 | Reuse existing `client/`, `chatbot-backend/`, `server/`. Add **`ml-fl-service/`** (Python) on port **8000** (already wired as `ML_API` in `client/src/config/endpoints.js`). | Fastest path; template already anticipates it. |
| D8 | Two roles: `citizen` and `analyst` (bank employee). Analyst is scoped to one `institutionId`. | PS requires both perspectives. |

## 1.3 Glossary
- **HFL** — same features, different customers per client (5 banks).
- **VFL** — same customers, different features per party (bank/insurer/lending app).
- **Client / SuperNode** — one simulated institution's training process.
- **Round** — one cycle: server → clients train locally → server aggregates.
- **Non-IID** — clients have different data distributions (realistic).
- **SecAgg(+)** — server only sees the *sum* of client updates, never individual ones.
- **DP (ε, δ)** — provable bound on what any single customer's data can change in the output.
- **PSI** — private set intersection: align shared customer IDs without revealing non-shared IDs.
- **Isolated / Local** — a client trains only on its own data (the "today" baseline).
- **Centralized** — all data pooled (illegal in reality; our theoretical upper bound).

---

# 2. Target repository layout

```
arth-saathi/
├── IMPLEMENTATION_PLAN.md            # this file
├── DECISIONS.md                      # agent logs deviations here
├── docker-compose.yml                # NEW — all services + Neo4j + Mongo
├── Makefile                          # NEW — dev shortcuts
├── README.md
│
├── client/                           # Next.js (existing) — extend
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # landing (existing, re-copy)
│       │   ├── login/  signup/       # existing; add role select
│       │   ├── citizen/              # NEW
│       │   │   ├── page.jsx          #   my risk profile
│       │   │   └── consent/page.jsx  #   consent center (DPDP rights)
│       │   ├── analyst/              # NEW
│       │   │   ├── page.jsx          #   portfolio overview
│       │   │   ├── fl/page.jsx       #   FL control panel + convergence
│       │   │   ├── graph/page.jsx    #   risk graph
│       │   │   ├── customers/[id]/page.jsx  # prediction + SHAP
│       │   │   └── fairness/page.jsx #   bias audit
│       │   └── chat/                 # existing copilot
│       ├── components/
│       │   ├── risk/                 # NEW
│       │   │   ├── RiskGauge.jsx
│       │   │   ├── ConvergenceChart.jsx
│       │   │   ├── ComparisonBars.jsx
│       │   │   ├── PrivacyBudgetMeter.jsx
│       │   │   ├── ShapWaterfall.jsx
│       │   │   ├── RiskGraphViewer.jsx   # repurposed from ThreatGraphViewer.jsx
│       │   │   ├── ConsentCenter.jsx
│       │   │   └── FLControlPanel.jsx
│       │   └── ui/                   # existing kit
│       ├── config/endpoints.js       # extend with FL endpoints
│       └── lib/api.ts                # NEW typed API client
│
├── chatbot-backend/                  # Node (existing) — copilot + FL proxy
│   └── src/
│       ├── routes/flRoutes.js        # NEW — proxies to ml-fl-service, adds auth/audit
│       ├── routes/consentRoutes.js   # NEW
│       ├── prompts/riskCopilotPrompt.js  # NEW
│       └── helpers/mlClient.js       # NEW — HTTP client to :8000
│
├── server/                           # Node (existing) — Neo4j + Socket.IO
│   └── src/
│       ├── routes/graph.js           # extend with risk-graph queries
│       ├── routes/flProgress.js      # NEW — webhook → socket emit
│       ├── models/User.js            # add role, institutionId
│       ├── models/Consent.js         # NEW
│       ├── models/AuditLog.js        # NEW
│       └── middleware/requireRole.js # NEW
│
└── ml-fl-service/                    # NEW — Python
    ├── pyproject.toml                # flwr app config + deps
    ├── requirements.txt
    ├── Dockerfile
    ├── Dockerfile.client             # for deployment-mode SuperNodes (optional)
    ├── app.py                        # FastAPI entry (uvicorn app:app --port 8000)
    ├── settings.py
    ├── arth_fl/                      # python package (flwr app lives here)
    │   ├── __init__.py
    │   ├── task.py                   # model, data loading, train/test fns (shared)
    │   ├── client_app.py             # Flower ClientApp
    │   ├── server_app.py             # Flower ServerApp
    │   ├── strategies.py             # strategy factory (fedavg/fedprox/fedadam + DP wrappers)
    │   ├── dp_accounting.py          # ε accounting
    │   └── progress.py               # per-round metrics → JSONL + webhook
    ├── data/
    │   ├── download.py
    │   ├── schema.py                 # unified schema + validation
    │   ├── features.py               # feature engineering
    │   ├── partition.py              # HFL non-IID + VFL column splits
    │   ├── augment.py                # SMOTE / CTGAN (labeled)
    │   └── raw/ processed/ partitions/   # gitignored
    ├── models/
    │   ├── tabular_resattn.py
    │   ├── baselines.py
    │   ├── losses.py
    │   ├── calibrate.py
    │   └── metrics.py
    ├── explain/shap_utils.py
    ├── graph/
    │   ├── neo4j_client.py
    │   ├── ingest.py                 # write derived nodes/edges
    │   ├── features.py               # graph features → model
    │   └── community.py              # Louvain (GDS or networkx fallback)
    ├── vertical/
    │   ├── psi.py
    │   ├── split_nn.py
    │   └── run_vfl_demo.py
    ├── experiments/
    │   ├── run_matrix.py             # isolated vs FL vs centralized vs DP
    │   └── report.py                 # → runs/summary.json + charts
    ├── jobs/manager.py               # subprocess job runner for flwr
    ├── runs/                         # gitignored artifacts (metrics.jsonl, models)
    └── tests/
```

---

# 3. Environment, dependencies, configuration

## 3.1 Python service — `ml-fl-service/requirements.txt`
```txt
# FILE: ml-fl-service/requirements.txt
flwr[simulation]>=1.20,<2.0
flwr-datasets>=0.5
torch>=2.2
numpy>=1.26
pandas>=2.2
pyarrow>=15
scikit-learn>=1.4
xgboost>=2.0
lightgbm>=4.3
imbalanced-learn>=0.12
opacus>=1.5
shap>=0.45
fastapi>=0.110
uvicorn[standard]>=0.29
pydantic>=2.6
pydantic-settings>=2.2
httpx>=0.27
neo4j>=5.19
networkx>=3.2
datasets>=2.18            # HuggingFace datasets for flwrlabs/fed-fraud-paysim-banks
kaggle>=1.6               # optional; for Give Me Some Credit / Home Credit
sdv>=1.12                 # optional; CTGAN
python-multipart
```

> Pin exact versions in `requirements.lock` after first successful install (`pip freeze > requirements.lock`).

## 3.2 Flower app config — `ml-fl-service/pyproject.toml`
```toml
# FILE: ml-fl-service/pyproject.toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "arth_fl"
version = "0.1.0"
description = "Federated financial risk model (Arth Saathi)"
dependencies = [
  "flwr[simulation]>=1.20,<2.0",
  "torch>=2.2",
  "numpy>=1.26",
  "pandas>=2.2",
  "pyarrow>=15",
  "scikit-learn>=1.4",
  "opacus>=1.5",
  "httpx>=0.27",
]

[tool.hatch.build.targets.wheel]
packages = ["arth_fl"]

[tool.flwr.app]
publisher = "arth-saathi"

[tool.flwr.app.components]
serverapp = "arth_fl.server_app:app"
clientapp = "arth_fl.client_app:app"

[tool.flwr.app.config]
# ---- experiment identity ----
run-id = "dev"
dataset = "paysim_banks"          # paysim_banks | gmsc | homecredit
task = "fraud"                    # fraud | default
# ---- federated ----
num-server-rounds = 50
fraction-train = 1.0
fraction-evaluate = 1.0
local-epochs = 3
batch-size = 512
learning-rate = 0.001
strategy = "fedprox"              # fedavg | fedprox | fedadam | fedyogi
proximal-mu = 0.01
# ---- privacy ----
dp-enabled = false
dp-noise-multiplier = 1.0
dp-clipping-norm = 1.0
dp-delta = 1e-5
secagg-enabled = false
# ---- model ----
model = "resattn"                 # resattn | mlp
hidden-dim = 256
n-blocks = 3
n-heads = 4
dropout = 0.15
# ---- io ----
partitions-dir = "data/partitions"
runs-dir = "runs"
progress-webhook = ""             # e.g. http://server:5002/api/fl/progress

[tool.flwr.federations]
default = "local-sim"

[tool.flwr.federations.local-sim]
options.num-supernodes = 5
options.backend.client-resources.num-cpus = 2
options.backend.client-resources.num-gpus = 0.0

[tool.flwr.federations.local-sim-3]
options.num-supernodes = 3
```

## 3.3 Settings — `ml-fl-service/settings.py`
```python
# FILE: ml-fl-service/settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    RUNS_DIR: str = "runs"
    PARTITIONS_DIR: str = "data/partitions"
    PROCESSED_DIR: str = "data/processed"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    PROGRESS_WEBHOOK: str = "http://localhost:5002/api/fl/progress"
    NODE_INTERNAL_TOKEN: str = "change-me"          # shared secret Node<->Python
    KAGGLE_USERNAME: str | None = None
    KAGGLE_KEY: str | None = None
    class Config:
        env_file = ".env"

settings = Settings()
```

## 3.4 Env templates
```bash
# FILE: ml-fl-service/.env.example
PORT=8000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
PROGRESS_WEBHOOK=http://localhost:5002/api/fl/progress
NODE_INTERNAL_TOKEN=change-me
# optional
KAGGLE_USERNAME=
KAGGLE_KEY=
```
```bash
# FILE: server/.env.example
PORT=5002
DB_URI=mongodb://localhost:27017/arth_saathi
JWT_SECRET=change-me
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NODE_INTERNAL_TOKEN=change-me
```
```bash
# FILE: chatbot-backend/.env.example  (extend existing)
PORT=5001
SUPABASE_URL=
SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GROQ_KEY=
ML_API_URL=http://localhost:8000
GRAPH_API_URL=http://localhost:5002
NODE_INTERNAL_TOKEN=change-me
```
```bash
# FILE: client/.env.example
NEXT_PUBLIC_MAIN_API_URL=http://localhost:5001
NEXT_PUBLIC_GRAPH_API_URL=http://localhost:5002
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
```

## 3.5 Docker Compose — `docker-compose.yml`
```yaml
# FILE: docker-compose.yml
version: "3.9"
services:
  neo4j:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["graph-data-science"]'
      NEO4J_dbms_security_procedures_unrestricted: gds.*
    ports: ["7474:7474", "7687:7687"]
    volumes: ["neo4j_data:/data"]
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "password", "RETURN 1"]
      interval: 10s
      retries: 10

  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

  ml-fl-service:
    build: ./ml-fl-service
    env_file: ./ml-fl-service/.env
    environment:
      NEO4J_URI: bolt://neo4j:7687
      PROGRESS_WEBHOOK: http://server:5002/api/fl/progress
    ports: ["8000:8000"]
    volumes:
      - ./ml-fl-service/data:/app/data
      - ./ml-fl-service/runs:/app/runs
    depends_on:
      neo4j: { condition: service_healthy }

  server:
    build: ./server
    env_file: ./server/.env
    environment:
      DB_URI: mongodb://mongo:27017/arth_saathi
      NEO4J_URI: bolt://neo4j:7687
    ports: ["5002:5002"]
    depends_on: [mongo, neo4j]

  chatbot-backend:
    build: ./chatbot-backend
    env_file: ./chatbot-backend/.env
    environment:
      ML_API_URL: http://ml-fl-service:8000
      GRAPH_API_URL: http://server:5002
    ports: ["5001:5001"]
    depends_on: [ml-fl-service, server]

  client:
    build: ./client
    environment:
      NEXT_PUBLIC_MAIN_API_URL: http://localhost:5001
      NEXT_PUBLIC_GRAPH_API_URL: http://localhost:5002
      NEXT_PUBLIC_ML_API_URL: http://localhost:8000
    ports: ["3000:3000"]
    depends_on: [chatbot-backend]

volumes:
  neo4j_data:
  mongo_data:
```

## 3.6 Python Dockerfile
```dockerfile
# FILE: ml-fl-service/Dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN pip install -e .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 3.7 Makefile
```makefile
# FILE: Makefile
.PHONY: up down data partitions baseline fl experiments test
up:            ; docker compose up -d --build
down:          ; docker compose down
data:          ; cd ml-fl-service && python -m data.download && python -m data.features
partitions:    ; cd ml-fl-service && python -m data.partition --dataset paysim_banks --clients 5 --mode hfl
baseline:      ; cd ml-fl-service && python -m models.baselines --dataset paysim_banks
fl:            ; cd ml-fl-service && flwr run . local-sim --stream
fl-dp:         ; cd ml-fl-service && flwr run . local-sim --run-config "dp-enabled=true dp-noise-multiplier=1.0" --stream
experiments:   ; cd ml-fl-service && python -m experiments.run_matrix && python -m experiments.report
test:          ; cd ml-fl-service && pytest -q
```

---

# 4. Data layer

## 4.1 Datasets (real, public)

| Key | Source | Task | Size | Partition column | Notes |
|---|---|---|---|---|---|
| `paysim_banks` | HF `flwrlabs/fed-fraud-paysim-banks` | fraud (`isFraud`) | ~6.3M rows, 5 banks | `BankID` (built in) | **Start here.** Programmatic download, pre-partitioned. PaySim is a simulator calibrated on real mobile-money logs — disclose this. |
| `gmsc` | Kaggle `GiveMeSomeCredit` (`cs-training.csv`) | credit default (`SeriousDlqin2yrs`) | 150k | synthetic split by income band (non-IID) | Real borrower data. 6.7% positives. |
| `homecredit` | Kaggle `home-credit-default-risk` | default (`TARGET`) | 307k + aux tables | split by region/income | Thin-file angle (bureau, prev apps). Heavier; Phase 6+. |
| `baf` | Kaggle `feedzai/bank-account-fraud-dataset-neurips-2022` | fraud | 1M | by `month`/`region` | Fairness variants built in. Phase 5+. |

## 4.2 Download — `ml-fl-service/data/download.py`
```python
# FILE: ml-fl-service/data/download.py
"""Fetch raw datasets into data/raw/<key>/ . Idempotent."""
import argparse, os, sys, zipfile, subprocess
from pathlib import Path

RAW = Path(__file__).parent / "raw"

def dl_paysim_banks():
    from datasets import load_dataset
    out = RAW / "paysim_banks"; out.mkdir(parents=True, exist_ok=True)
    ds = load_dataset("flwrlabs/fed-fraud-paysim-banks")
    for split in ds:
        p = out / f"{split}.parquet"
        if not p.exists():
            ds[split].to_pandas().to_parquet(p, index=False)
    print("paysim_banks ->", out)

def _kaggle(cmd: list[str], out: Path):
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        print("exists, skip", out); return
    if not (os.getenv("KAGGLE_USERNAME") and os.getenv("KAGGLE_KEY")):
        sys.exit("Set KAGGLE_USERNAME/KAGGLE_KEY or place ~/.kaggle/kaggle.json")
    subprocess.run(["kaggle", *cmd, "-p", str(out)], check=True)
    for z in out.glob("*.zip"):
        with zipfile.ZipFile(z) as zf: zf.extractall(out)
        z.unlink()

def dl_gmsc():
    _kaggle(["competitions", "download", "-c", "GiveMeSomeCredit"], RAW / "gmsc")

def dl_homecredit():
    _kaggle(["competitions", "download", "-c", "home-credit-default-risk"], RAW / "homecredit")

def dl_baf():
    _kaggle(["datasets", "download", "-d", "sgpjesus/bank-account-fraud-dataset-neurips-2022"], RAW / "baf")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=["paysim_banks", "gmsc"])
    a = ap.parse_args()
    {"paysim_banks": dl_paysim_banks, "gmsc": dl_gmsc,
     "homecredit": dl_homecredit, "baf": dl_baf}
    for k in a.only:
        globals()[f"dl_{k}"]()
```

## 4.3 Unified schema — `ml-fl-service/data/schema.py`
Every dataset is mapped into **one canonical feature frame** so the same model/FL code runs on any of them.

```python
# FILE: ml-fl-service/data/schema.py
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Schema:
    key: str
    target: str                       # binary 0/1
    id_col: str                       # pseudonymous entity id
    client_col: str                   # institution partition id (HFL)
    numeric: list[str]
    categorical: list[str]
    time_col: str | None = None
    # feature groups for VFL column split
    vfl_groups: dict[str, list[str]] = field(default_factory=dict)

PAYSIM = Schema(
    key="paysim_banks", target="isFraud", id_col="nameOrig", client_col="BankID",
    time_col="step",
    numeric=["amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest",
             # engineered:
             "amt_log", "orig_delta", "dest_delta", "orig_zero_after", "dest_zero_before",
             "amt_to_bal_ratio", "hour", "is_night", "orig_tx_count_24", "orig_amt_sum_24",
             "dest_in_degree", "dest_out_degree", "orig_pagerank"],
    categorical=["type"],
    vfl_groups={
        "bank":        ["amount", "oldbalanceOrg", "newbalanceOrig", "orig_delta", "amt_to_bal_ratio"],
        "lending_app": ["type", "hour", "is_night", "orig_tx_count_24", "orig_amt_sum_24", "amt_log"],
        "insurer":     ["oldbalanceDest", "newbalanceDest", "dest_delta", "dest_zero_before",
                        "dest_in_degree", "dest_out_degree", "orig_pagerank"],
    },
)

GMSC = Schema(
    key="gmsc", target="SeriousDlqin2yrs", id_col="row_id", client_col="institution",
    numeric=["RevolvingUtilizationOfUnsecuredLines", "age", "NumberOfTime30-59DaysPastDueNotWorse",
             "DebtRatio", "MonthlyIncome", "NumberOfOpenCreditLinesAndLoans", "NumberOfTimes90DaysLate",
             "NumberRealEstateLoansOrLines", "NumberOfTime60-89DaysPastDueNotWorse", "NumberOfDependents",
             # engineered:
             "income_log", "income_missing", "total_past_due", "util_clipped", "debt_income",
             "age_band", "dependents_per_income"],
    categorical=[],
    vfl_groups={
        "bank":        ["RevolvingUtilizationOfUnsecuredLines", "NumberOfOpenCreditLinesAndLoans",
                        "NumberRealEstateLoansOrLines", "util_clipped", "total_past_due"],
        "lending_app": ["DebtRatio", "MonthlyIncome", "income_log", "income_missing", "debt_income"],
        "insurer":     ["age", "NumberOfDependents", "age_band", "dependents_per_income"],
    },
)

SCHEMAS = {s.key: s for s in [PAYSIM, GMSC]}
```

## 4.4 Feature engineering — `ml-fl-service/data/features.py`
```python
# FILE: ml-fl-service/data/features.py
"""raw/<key> -> processed/<key>.parquet with canonical columns + engineered features.
Graph features (degree, pagerank) computed ONLY within a client partition later (see graph/features.py);
here we compute them globally only for the CENTRALIZED upper-bound experiment and mark them.
"""
import numpy as np, pandas as pd
from pathlib import Path
from .schema import SCHEMAS

RAW = Path(__file__).parent / "raw"; OUT = Path(__file__).parent / "processed"; OUT.mkdir(exist_ok=True)

def fe_paysim(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["amt_log"] = np.log1p(df["amount"])
    df["orig_delta"] = df["oldbalanceOrg"] - df["newbalanceOrig"] - df["amount"]
    df["dest_delta"] = df["newbalanceDest"] - df["oldbalanceDest"] - df["amount"]
    df["orig_zero_after"] = (df["newbalanceOrig"] == 0).astype(int)
    df["dest_zero_before"] = (df["oldbalanceDest"] == 0).astype(int)
    df["amt_to_bal_ratio"] = df["amount"] / (df["oldbalanceOrg"] + 1.0)
    df["hour"] = df["step"] % 24
    df["is_night"] = df["hour"].between(0, 5).astype(int)
    # velocity: per-originator rolling counts within 24 steps (sorted by step)
    df = df.sort_values(["nameOrig", "step"])
    g = df.groupby("nameOrig")
    df["orig_tx_count_24"] = g["step"].transform(lambda s: s.rolling(24, min_periods=1).count())
    df["orig_amt_sum_24"] = g["amount"].transform(lambda s: s.rolling(24, min_periods=1).sum())
    # graph placeholders (filled per-partition later)
    for c in ["dest_in_degree", "dest_out_degree", "orig_pagerank"]:
        df[c] = 0.0
    df["is_synthetic"] = 0
    return df

def fe_gmsc(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().rename(columns={"Unnamed: 0": "row_id"})
    if "row_id" not in df: df["row_id"] = np.arange(len(df))
    df["income_missing"] = df["MonthlyIncome"].isna().astype(int)
    df["MonthlyIncome"] = df["MonthlyIncome"].fillna(df["MonthlyIncome"].median())
    df["NumberOfDependents"] = df["NumberOfDependents"].fillna(0)
    df["income_log"] = np.log1p(df["MonthlyIncome"])
    df["total_past_due"] = (df["NumberOfTime30-59DaysPastDueNotWorse"]
                            + df["NumberOfTime60-89DaysPastDueNotWorse"] + df["NumberOfTimes90DaysLate"])
    df["util_clipped"] = df["RevolvingUtilizationOfUnsecuredLines"].clip(0, 2)
    df["debt_income"] = df["DebtRatio"] * df["MonthlyIncome"]
    df["age_band"] = pd.cut(df["age"], [0, 25, 35, 45, 55, 65, 120], labels=False).astype(float)
    df["dependents_per_income"] = df["NumberOfDependents"] / (df["MonthlyIncome"] + 1)
    # non-IID institution assignment by income quintile (5 "banks" serving different segments)
    df["institution"] = pd.qcut(df["MonthlyIncome"].rank(method="first"), 5, labels=False).astype(int)
    df["is_synthetic"] = 0
    return df

def run(key: str):
    s = SCHEMAS[key]
    if key == "paysim_banks":
        df = pd.concat([pd.read_parquet(p) for p in (RAW / key).glob("*.parquet")])
        df = fe_paysim(df)
    elif key == "gmsc":
        df = fe_gmsc(pd.read_csv(RAW / key / "cs-training.csv"))
    else:
        raise NotImplementedError(key)
    cols = [s.id_col, s.client_col, s.target, *s.numeric, *s.categorical, "is_synthetic"]
    if s.time_col: cols.append(s.time_col)
    df[list(dict.fromkeys(cols))].to_parquet(OUT / f"{key}.parquet", index=False)
    print(key, df.shape, "positive rate", df[s.target].mean())

if __name__ == "__main__":
    import sys
    for k in (sys.argv[1:] or ["paysim_banks", "gmsc"]): run(k)
```

## 4.5 Partitioning — `ml-fl-service/data/partition.py`
Produces `data/partitions/<key>/hfl_<n>/client_<i>/{train,val,test}.parquet` and a global `test.parquet` (held-out, stratified, **never augmented**) for fair evaluation.

```python
# FILE: ml-fl-service/data/partition.py
import argparse, json, numpy as np, pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from .schema import SCHEMAS

PROC = Path(__file__).parent / "processed"; PART = Path(__file__).parent / "partitions"

def dirichlet_label_skew(df, target, n_clients, alpha, seed=42):
    """Assign rows to clients with label-skew controlled by alpha (lower = more non-IID)."""
    rng = np.random.default_rng(seed); idx_by_client = [[] for _ in range(n_clients)]
    for y in df[target].unique():
        idx = df.index[df[target] == y].to_numpy(); rng.shuffle(idx)
        props = rng.dirichlet([alpha] * n_clients)
        cuts = (np.cumsum(props) * len(idx)).astype(int)[:-1]
        for c, chunk in enumerate(np.split(idx, cuts)): idx_by_client[c].extend(chunk.tolist())
    return idx_by_client

def hfl(key: str, n_clients: int, alpha: float | None, seed=42):
    s = SCHEMAS[key]; df = pd.read_parquet(PROC / f"{key}.parquet")
    # global held-out test (15%) — identical for every experiment
    df_train, df_test = train_test_split(df, test_size=0.15, stratify=df[s.target], random_state=seed)
    out = PART / key / f"hfl_{n_clients}"; out.mkdir(parents=True, exist_ok=True)
    df_test.to_parquet(out / "test.parquet", index=False)

    if alpha is None and s.client_col in df_train:      # natural partition (PaySim BankID / GMSC institution)
        groups = {i: df_train[df_train[s.client_col] == cid]
                  for i, cid in enumerate(sorted(df_train[s.client_col].unique())[:n_clients])}
    else:
        idx = dirichlet_label_skew(df_train, s.target, n_clients, alpha or 0.5, seed)
        groups = {i: df_train.loc[ix] for i, ix in enumerate(idx)}

    meta = {"key": key, "n_clients": n_clients, "alpha": alpha, "clients": {}}
    for i, g in groups.items():
        tr, va = train_test_split(g, test_size=0.15, stratify=g[s.target], random_state=seed)
        d = out / f"client_{i}"; d.mkdir(exist_ok=True)
        tr.to_parquet(d / "train.parquet", index=False); va.to_parquet(d / "val.parquet", index=False)
        meta["clients"][i] = {"n_train": len(tr), "n_val": len(va), "pos_rate": float(tr[s.target].mean())}
    (out / "meta.json").write_text(json.dumps(meta, indent=2)); print(json.dumps(meta, indent=2))

def vfl(key: str, seed=42):
    """Same customers, different feature groups per party. Emits party_<name>.parquet with id + group cols;
    label lives ONLY with the 'bank' party (active party)."""
    s = SCHEMAS[key]; df = pd.read_parquet(PROC / f"{key}.parquet").sample(frac=1, random_state=seed)
    out = PART / key / "vfl"; out.mkdir(parents=True, exist_ok=True)
    # simulate imperfect overlap: each party sees 85% of ids
    rng = np.random.default_rng(seed)
    for party, cols in s.vfl_groups.items():
        keep = df[rng.random(len(df)) < 0.85]
        c = [s.id_col, *cols] + ([s.target] if party == "bank" else [])
        keep[c].to_parquet(out / f"party_{party}.parquet", index=False)
    print("vfl parties ->", out)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="paysim_banks"); ap.add_argument("--clients", type=int, default=5)
    ap.add_argument("--mode", choices=["hfl", "vfl"], default="hfl")
    ap.add_argument("--alpha", type=float, default=None, help="Dirichlet label skew; omit to use natural partition")
    a = ap.parse_args()
    hfl(a.dataset, a.clients, a.alpha) if a.mode == "hfl" else vfl(a.dataset)
```

## 4.6 Augmentation (labeled) — `ml-fl-service/data/augment.py`
Rules: apply **only** to a client's `train.parquet`, never `val`/`test`; set `is_synthetic=1`; log counts to `meta.json`.
```python
# FILE: ml-fl-service/data/augment.py
import pandas as pd, numpy as np
from imblearn.over_sampling import SMOTE
from .schema import SCHEMAS

def smote_client(train: pd.DataFrame, key: str, target_pos_rate=0.10, seed=42) -> pd.DataFrame:
    s = SCHEMAS[key]; X = train[s.numeric].fillna(0).to_numpy(); y = train[s.target].to_numpy()
    pos = y.sum(); n_needed = int(target_pos_rate * len(y) / (1 - target_pos_rate))
    if pos >= n_needed: return train
    sm = SMOTE(sampling_strategy={1: n_needed}, random_state=seed)
    Xr, yr = sm.fit_resample(X, y)
    synth = pd.DataFrame(Xr[len(X):], columns=s.numeric); synth[s.target] = yr[len(X):]
    synth["is_synthetic"] = 1
    for c in s.categorical: synth[c] = train[c].mode()[0]
    synth[s.id_col] = [f"synth_{i}" for i in range(len(synth))]; synth[s.client_col] = train[s.client_col].iloc[0]
    return pd.concat([train, synth[train.columns.intersection(synth.columns)]], ignore_index=True)
```
> CTGAN (via `sdv`) MAY replace SMOTE for `gmsc` if time permits. Same rules apply.

## 4.7 Acceptance — Phase 1 (Data)
- `make data && make partitions` succeeds; `data/partitions/paysim_banks/hfl_5/meta.json` shows 5 clients with **different** `pos_rate`s (non-IID).
- `test.parquet` positive-rate within ±0.2pp of the full dataset.
- `pytest tests/test_data.py` asserts: no id overlap between clients; `is_synthetic==0` everywhere in `val`/`test`.

---

# 5. ML layer

## 5.1 Losses — `ml-fl-service/models/losses.py`
```python
# FILE: ml-fl-service/models/losses.py
import torch, torch.nn as nn, torch.nn.functional as F

class FocalLoss(nn.Module):
    def __init__(self, alpha=0.25, gamma=2.0, pos_weight: float | None = None):
        super().__init__(); self.alpha, self.gamma = alpha, gamma
        self.pos_weight = torch.tensor(pos_weight) if pos_weight else None
    def forward(self, logits, y):
        bce = F.binary_cross_entropy_with_logits(logits, y, pos_weight=self.pos_weight, reduction="none")
        p = torch.sigmoid(logits); pt = torch.where(y == 1, p, 1 - p)
        a = torch.where(y == 1, torch.full_like(p, self.alpha), torch.full_like(p, 1 - self.alpha))
        return (a * (1 - pt) ** self.gamma * bce).mean()
```

## 5.2 Model — `ml-fl-service/models/tabular_resattn.py`
Residual MLP blocks + multi-head self-attention over per-feature token embeddings (FT-Transformer-lite). Categorical → embeddings; numeric → per-feature linear "tokenizer".
```python
# FILE: ml-fl-service/models/tabular_resattn.py
import torch, torch.nn as nn

class NumericTokenizer(nn.Module):
    """Each numeric feature -> d_model vector: w_i * x_i + b_i."""
    def __init__(self, n_num, d):
        super().__init__(); self.w = nn.Parameter(torch.randn(n_num, d) * 0.02); self.b = nn.Parameter(torch.zeros(n_num, d))
    def forward(self, x):            # x: (B, n_num)
        return x.unsqueeze(-1) * self.w + self.b   # (B, n_num, d)

class ResBlock(nn.Module):
    def __init__(self, d, dropout):
        super().__init__()
        self.f = nn.Sequential(nn.LayerNorm(d), nn.Linear(d, 2 * d), nn.GELU(), nn.Dropout(dropout), nn.Linear(2 * d, d))
    def forward(self, x): return x + self.f(x)

class TabularResAttn(nn.Module):
    def __init__(self, n_num: int, cat_cardinalities: list[int], d_model=256, n_blocks=3, n_heads=4, dropout=0.15):
        super().__init__()
        self.num_tok = NumericTokenizer(n_num, d_model)
        self.cat_emb = nn.ModuleList([nn.Embedding(c + 1, d_model) for c in cat_cardinalities])  # +1 for unknown
        n_tokens = n_num + len(cat_cardinalities) + 1
        self.cls = nn.Parameter(torch.zeros(1, 1, d_model))
        self.pos = nn.Parameter(torch.randn(1, n_tokens, d_model) * 0.02)
        self.attn = nn.ModuleList([nn.TransformerEncoderLayer(d_model, n_heads, 2 * d_model, dropout, batch_first=True, norm_first=True)
                                   for _ in range(n_blocks)])
        self.res = nn.Sequential(*[ResBlock(d_model, dropout) for _ in range(n_blocks)])
        self.head = nn.Sequential(nn.LayerNorm(d_model), nn.Linear(d_model, 1))
    def forward(self, x_num, x_cat):
        toks = [self.num_tok(x_num)]
        if x_cat.shape[1]: toks.append(torch.stack([e(x_cat[:, i]) for i, e in enumerate(self.cat_emb)], 1))
        h = torch.cat([self.cls.expand(x_num.size(0), -1, -1), *toks], 1) + self.pos
        for layer in self.attn: h = layer(h)
        z = self.res(h[:, 0])                     # CLS token
        return self.head(z).squeeze(-1)           # logits
    def embed(self, x_num, x_cat):                # for graph "risk clusters"
        with torch.no_grad():
            toks = [self.num_tok(x_num)]
            if x_cat.shape[1]: toks.append(torch.stack([e(x_cat[:, i]) for i, e in enumerate(self.cat_emb)], 1))
            h = torch.cat([self.cls.expand(x_num.size(0), -1, -1), *toks], 1) + self.pos
            for layer in self.attn: h = layer(h)
            return self.res(h[:, 0])

class MLP(nn.Module):  # fallback / ablation
    def __init__(self, n_in, d=256, dropout=0.15):
        super().__init__()
        self.f = nn.Sequential(nn.Linear(n_in, d), nn.GELU(), nn.Dropout(dropout), nn.Linear(d, d), nn.GELU(), nn.Dropout(dropout), nn.Linear(d, 1))
    def forward(self, x_num, x_cat): return self.f(torch.cat([x_num, x_cat.float()], 1)).squeeze(-1)
```

## 5.3 Metrics — `ml-fl-service/models/metrics.py`
```python
# FILE: ml-fl-service/models/metrics.py
import numpy as np
from sklearn.metrics import roc_auc_score, average_precision_score, f1_score, precision_recall_curve, brier_score_loss

def expected_calibration_error(y, p, n_bins=15):
    bins = np.linspace(0, 1, n_bins + 1); ece = 0.0
    for lo, hi in zip(bins[:-1], bins[1:]):
        m = (p > lo) & (p <= hi)
        if m.any(): ece += m.mean() * abs(y[m].mean() - p[m].mean())
    return float(ece)

def recall_at_precision(y, p, target_precision=0.90):
    prec, rec, _ = precision_recall_curve(y, p)
    ok = rec[prec >= target_precision]
    return float(ok.max()) if len(ok) else 0.0

def all_metrics(y: np.ndarray, p: np.ndarray) -> dict:
    y = y.astype(int); thr = 0.5
    return {
        "roc_auc": float(roc_auc_score(y, p)) if len(np.unique(y)) > 1 else float("nan"),
        "pr_auc": float(average_precision_score(y, p)),
        "f1": float(f1_score(y, (p >= thr).astype(int))),
        "recall_at_p90": recall_at_precision(y, p, 0.90),
        "brier": float(brier_score_loss(y, p)),
        "ece": expected_calibration_error(y, p),
        "pos_rate": float(y.mean()), "n": int(len(y)),
    }
```

## 5.4 Calibration — `ml-fl-service/models/calibrate.py`
```python
# FILE: ml-fl-service/models/calibrate.py
import numpy as np, torch
class TemperatureScaler:
    def __init__(self): self.T = 1.0
    def fit(self, logits: np.ndarray, y: np.ndarray, iters=200, lr=0.01):
        T = torch.ones(1, requires_grad=True); l = torch.tensor(logits, dtype=torch.float32); t = torch.tensor(y, dtype=torch.float32)
        opt = torch.optim.LBFGS([T], lr=lr, max_iter=iters)
        def closure():
            opt.zero_grad(); loss = torch.nn.functional.binary_cross_entropy_with_logits(l / T, t); loss.backward(); return loss
        opt.step(closure); self.T = float(T.item()); return self
    def transform(self, logits: np.ndarray) -> np.ndarray:
        return 1 / (1 + np.exp(-logits / self.T))
```

## 5.5 Baselines — `ml-fl-service/models/baselines.py`
Produces the **centralized upper bound** and **isolated-local lower bound** with GBDTs; writes `runs/baselines_<key>.json`.
```python
# FILE: ml-fl-service/models/baselines.py
import argparse, json, pandas as pd, numpy as np
from pathlib import Path
import xgboost as xgb, lightgbm as lgb
from data.schema import SCHEMAS
from models.metrics import all_metrics

PART = Path("data/partitions"); RUNS = Path("runs"); RUNS.mkdir(exist_ok=True)

def xy(df, s):
    X = df[s.numeric + s.categorical].copy()
    for c in s.categorical: X[c] = X[c].astype("category").cat.codes
    return X.fillna(0), df[s.target].to_numpy()

def fit_xgb(Xtr, ytr, Xva, yva):
    spw = (ytr == 0).sum() / max(1, (ytr == 1).sum())
    m = xgb.XGBClassifier(n_estimators=800, learning_rate=0.05, max_depth=6, subsample=0.8, colsample_bytree=0.8,
                          scale_pos_weight=spw, tree_method="hist", eval_metric="aucpr", early_stopping_rounds=50)
    m.fit(Xtr, ytr, eval_set=[(Xva, yva)], verbose=False); return m

def run(key, n_clients):
    s = SCHEMAS[key]; root = PART / key / f"hfl_{n_clients}"; test = pd.read_parquet(root / "test.parquet"); Xte, yte = xy(test, s)
    out = {"dataset": key, "centralized": {}, "isolated": {}}
    trs, vas = [], []
    for i in range(n_clients):
        tr = pd.read_parquet(root / f"client_{i}/train.parquet"); va = pd.read_parquet(root / f"client_{i}/val.parquet")
        trs.append(tr); vas.append(va)
        m = fit_xgb(*xy(tr, s), *xy(va, s)); out["isolated"][i] = all_metrics(yte, m.predict_proba(Xte)[:, 1])
    m = fit_xgb(*xy(pd.concat(trs), s), *xy(pd.concat(vas), s)); out["centralized"] = all_metrics(yte, m.predict_proba(Xte)[:, 1])
    out["isolated_mean"] = {k: float(np.mean([v[k] for v in out["isolated"].values()])) for k in out["centralized"]}
    (RUNS / f"baselines_{key}.json").write_text(json.dumps(out, indent=2)); print(json.dumps(out["centralized"], indent=2)); print("isolated mean", out["isolated_mean"])

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--dataset", default="paysim_banks"); ap.add_argument("--clients", type=int, default=5)
    a = ap.parse_args(); run(a.dataset, a.clients)
```

## 5.6 SHAP — `ml-fl-service/explain/shap_utils.py`
```python
# FILE: ml-fl-service/explain/shap_utils.py
import numpy as np, shap, torch

def explain_torch(model, x_num_bg, x_cat_bg, x_num, x_cat, feature_names, top_k=8):
    """KernelExplainer on a small background; returns top-k signed contributions."""
    model.eval()
    def f(X):
        Xn = torch.tensor(X[:, :x_num.shape[1]], dtype=torch.float32); Xc = torch.tensor(X[:, x_num.shape[1]:], dtype=torch.long)
        with torch.no_grad(): return torch.sigmoid(model(Xn, Xc)).numpy()
    bg = np.concatenate([x_num_bg, x_cat_bg], 1)[:100]; X = np.concatenate([x_num, x_cat], 1)
    ex = shap.KernelExplainer(f, bg); sv = ex.shap_values(X, nsamples=200)
    sv = sv[0] if isinstance(sv, list) else sv
    out = []
    for row in sv:
        idx = np.argsort(-np.abs(row))[:top_k]
        out.append([{"feature": feature_names[i], "contribution": float(row[i])} for i in idx])
    return {"base_value": float(ex.expected_value if np.isscalar(ex.expected_value) else ex.expected_value[0]), "rows": out}
```

## 5.7 Acceptance — Phase 2 (Centralized ceiling)
- `make baseline` writes `runs/baselines_paysim_banks.json`.
- Centralized XGBoost PR-AUC on PaySim test ≥ 0.80; isolated mean is **strictly lower** (this gap is our story).
- For `gmsc`: centralized ROC-AUC ≥ 0.85.

---

# 6. Federated layer (Flower Message API)

## 6.1 Shared task code — `ml-fl-service/arth_fl/task.py`
```python
# FILE: ml-fl-service/arth_fl/task.py
import json, numpy as np, pandas as pd, torch
from pathlib import Path
from torch.utils.data import DataLoader, TensorDataset
from data.schema import SCHEMAS
from models.tabular_resattn import TabularResAttn, MLP
from models.losses import FocalLoss
from models.metrics import all_metrics

class Preproc:
    """Per-client standardization fitted on local train only (no cross-client stats leak).
    Categorical codes come from a FIXED vocabulary shipped in code (schema), so all clients agree on indices."""
    CAT_VOCAB = {"type": ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]}
    def __init__(self, schema): self.s = schema; self.mu = None; self.sd = None
    def fit(self, df):
        X = df[self.s.numeric].fillna(0).to_numpy(np.float32); self.mu = X.mean(0); self.sd = X.std(0) + 1e-6; return self
    def transform(self, df):
        Xn = ((df[self.s.numeric].fillna(0).to_numpy(np.float32) - self.mu) / self.sd).clip(-10, 10)
        if self.s.categorical:
            Xc = np.stack([df[c].map({v: i for i, v in enumerate(self.CAT_VOCAB[c])}).fillna(len(self.CAT_VOCAB[c])).to_numpy(np.int64)
                           for c in self.s.categorical], 1)
        else: Xc = np.zeros((len(df), 0), np.int64)
        return Xn, Xc, df[self.s.target].to_numpy(np.float32)
    def cardinalities(self): return [len(self.CAT_VOCAB[c]) for c in self.s.categorical]

def build_model(cfg: dict, schema, cards):
    if cfg.get("model", "resattn") == "mlp": return MLP(len(schema.numeric) + len(schema.categorical), cfg["hidden-dim"], cfg["dropout"])
    return TabularResAttn(len(schema.numeric), cards, cfg["hidden-dim"], cfg["n-blocks"], cfg["n-heads"], cfg["dropout"])

def load_client_data(partitions_dir: str, dataset: str, n_clients: int, cid: int, batch_size: int):
    s = SCHEMAS[dataset]; root = Path(partitions_dir) / dataset / f"hfl_{n_clients}" / f"client_{cid}"
    tr = pd.read_parquet(root / "train.parquet"); va = pd.read_parquet(root / "val.parquet")
    pp = Preproc(s).fit(tr)
    def dl(df, shuffle):
        Xn, Xc, y = pp.transform(df)
        return DataLoader(TensorDataset(torch.tensor(Xn), torch.tensor(Xc), torch.tensor(y)), batch_size=batch_size, shuffle=shuffle, drop_last=False)
    pos_w = float((tr[s.target] == 0).sum() / max(1, (tr[s.target] == 1).sum()))
    return dl(tr, True), dl(va, False), pp, pos_w

def load_global_test(partitions_dir, dataset, n_clients):
    s = SCHEMAS[dataset]; root = Path(partitions_dir) / dataset / f"hfl_{n_clients}"
    te = pd.read_parquet(root / "test.parquet")
    # server-side preproc: fit on the *union of client val sets' summary* is a leak; instead fit on test itself
    # is also a leak. Use robust constants shipped from client_0's fitted stats via ConfigRecord (see server_app).
    return te, s

def train_epochs(model, loader, epochs, lr, pos_w, device, global_params=None, proximal_mu=0.0, focal=True):
    model.to(device).train(); opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    crit = FocalLoss(pos_weight=min(pos_w, 50.0)) if focal else torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor(min(pos_w, 50.0)))
    gp = [p.detach().clone().to(device) for p in global_params] if global_params is not None else None
    tot, n = 0.0, 0
    for _ in range(epochs):
        for xn, xc, y in loader:
            xn, xc, y = xn.to(device), xc.to(device), y.to(device)
            loss = crit(model(xn, xc), y)
            if gp is not None and proximal_mu > 0:                       # FedProx proximal term
                prox = sum(((p - g) ** 2).sum() for p, g in zip(model.parameters(), gp))
                loss = loss + (proximal_mu / 2) * prox
            opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0); opt.step()
            tot += loss.item() * len(y); n += len(y)
    return tot / max(n, 1)

@torch.no_grad()
def evaluate(model, loader, device):
    model.to(device).eval(); ps, ys = [], []
    for xn, xc, y in loader:
        ps.append(torch.sigmoid(model(xn.to(device), xc.to(device))).cpu().numpy()); ys.append(y.numpy())
    p, y = np.concatenate(ps), np.concatenate(ys); m = all_metrics(y, p); m["loss"] = float(-(y * np.log(p + 1e-9) + (1 - y) * np.log(1 - p + 1e-9)).mean())
    return m
```

## 6.2 ClientApp — `ml-fl-service/arth_fl/client_app.py`
```python
# FILE: ml-fl-service/arth_fl/client_app.py
"""One simulated institution. Raw parquet never leaves this process; only ArrayRecord + MetricRecord are returned."""
import torch
from flwr.app import ArrayRecord, Context, Message, MetricRecord, RecordDict
from flwr.clientapp import ClientApp
from flwr.clientapp.mod import fixedclipping_mod   # required when server wraps with DifferentialPrivacyClientSideFixedClipping
from .task import build_model, load_client_data, train_epochs, evaluate
from data.schema import SCHEMAS

app = ClientApp()
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def _setup(context: Context):
    rc = context.run_config; cid = context.node_config["partition-id"]; n = context.node_config["num-partitions"]
    tr, va, pp, pos_w = load_client_data(rc["partitions-dir"], rc["dataset"], n, cid, rc["batch-size"])
    model = build_model(rc, SCHEMAS[rc["dataset"]], pp.cardinalities())
    return rc, cid, tr, va, model, pos_w

def _mods():
    """Mods are fixed at import time, so select them via env (set by jobs/manager.py from run config).
    fixedclipping_mod MUST be present when the server wraps the strategy with DifferentialPrivacyClientSideFixedClipping."""
    import os; mods = []
    if os.getenv("ARTH_DP_ENABLED", "false") == "true": mods.append(fixedclipping_mod)
    if os.getenv("ARTH_SECAGG_ENABLED", "false") == "true":
        from flwr.clientapp.mod import secaggplus_mod; mods.append(secaggplus_mod)   # verify name in installed flwr
    return mods

@app.train(mods=_mods())
def train(msg: Message, context: Context) -> Message:
    rc, cid, tr, va, model, pos_w = _setup(context)
    arrays: ArrayRecord = msg.content["arrays"]; model.load_state_dict(arrays.to_torch_state_dict())
    cfg = msg.content["config"] if "config" in msg.content else {}
    mu = float(cfg.get("proximal-mu", rc.get("proximal-mu", 0.0))) if rc["strategy"] == "fedprox" else 0.0
    global_params = [p.detach().clone() for p in model.parameters()]
    loss = train_epochs(model, tr, int(cfg.get("local-epochs", rc["local-epochs"])), float(cfg.get("lr", rc["learning-rate"])),
                        pos_w, DEVICE, global_params, mu)
    metrics = MetricRecord({"train_loss": loss, "num-examples": len(tr.dataset), "client_id": int(cid)})
    return Message(RecordDict({"arrays": ArrayRecord(model.state_dict()), "metrics": metrics}), reply_to=msg)

@app.evaluate()
def evaluate_fn(msg: Message, context: Context) -> Message:
    rc, cid, tr, va, model, pos_w = _setup(context)
    model.load_state_dict(msg.content["arrays"].to_torch_state_dict())
    m = evaluate(model, va, DEVICE)
    metrics = MetricRecord({"eval_loss": m["loss"], "roc_auc": m["roc_auc"], "pr_auc": m["pr_auc"], "f1": m["f1"],
                            "num-examples": len(va.dataset), "client_id": int(cid)})
    return Message(RecordDict({"metrics": metrics}), reply_to=msg)
```
> **Agent note:** Flower may expose `secaggplus_mod` under `flwr.clientapp.mod`. When `secagg-enabled=true`, append it to the mods list. Scaffold the official example with `flwr new @flwrlabs/flower-secure-aggregation` and mirror its server-side workflow. Verify against the installed version.

## 6.3 Strategy factory — `ml-fl-service/arth_fl/strategies.py`
```python
# FILE: ml-fl-service/arth_fl/strategies.py
from flwr.serverapp.strategy import FedAvg, DifferentialPrivacyClientSideFixedClipping
try:
    from flwr.serverapp.strategy import FedAdam, FedYogi, FedProx
except ImportError:            # older builds
    FedAdam = FedYogi = FedProx = None

def make_strategy(rc: dict, num_clients: int):
    name = rc["strategy"]; common = dict(fraction_train=rc["fraction-train"], fraction_evaluate=rc["fraction-evaluate"],
                                          min_available_nodes=num_clients)
    if name == "fedavg": base = FedAvg(**common)
    elif name == "fedprox":
        # We implement the proximal term client-side (task.train_epochs); server just averages.
        base = FedProx(proximal_mu=rc["proximal-mu"], **common) if FedProx else FedAvg(**common)
    elif name == "fedadam" and FedAdam: base = FedAdam(eta=rc.get("server-lr", 0.01), **common)
    elif name == "fedyogi" and FedYogi: base = FedYogi(eta=rc.get("server-lr", 0.01), **common)
    else: raise ValueError(f"unknown/unavailable strategy {name}")
    if rc["dp-enabled"]:
        base = DifferentialPrivacyClientSideFixedClipping(base, noise_multiplier=rc["dp-noise-multiplier"],
                                                          clipping_norm=rc["dp-clipping-norm"],
                                                          num_sampled_clients=max(1, int(rc["fraction-train"] * num_clients)))
    return base
```

## 6.4 DP accounting — `ml-fl-service/arth_fl/dp_accounting.py`
Client-level central DP with Gaussian noise on clipped client updates, full participation (q=1) per round.
```python
# FILE: ml-fl-service/arth_fl/dp_accounting.py
from opacus.accountants import RDPAccountant

def epsilon_after_rounds(noise_multiplier: float, rounds: int, sample_rate: float, delta: float) -> float:
    acc = RDPAccountant()
    for _ in range(rounds): acc.step(noise_multiplier=noise_multiplier, sample_rate=sample_rate)
    return float(acc.get_epsilon(delta))

def noise_for_target_epsilon(target_eps: float, rounds: int, sample_rate: float, delta: float) -> float:
    from opacus.accountants.utils import get_noise_multiplier
    return float(get_noise_multiplier(target_epsilon=target_eps, target_delta=delta, sample_rate=sample_rate, steps=rounds))
```

## 6.5 Progress publishing — `ml-fl-service/arth_fl/progress.py`
```python
# FILE: ml-fl-service/arth_fl/progress.py
import json, time, httpx
from pathlib import Path

class Progress:
    def __init__(self, runs_dir: str, run_id: str, webhook: str = "", token: str = ""):
        self.dir = Path(runs_dir) / run_id; self.dir.mkdir(parents=True, exist_ok=True)
        self.f = self.dir / "metrics.jsonl"; self.webhook = webhook; self.token = token
    def emit(self, payload: dict):
        payload = {"ts": time.time(), **payload}
        with self.f.open("a") as fh: fh.write(json.dumps(payload) + "\n")
        if self.webhook:
            try: httpx.post(self.webhook, json=payload, headers={"x-internal-token": self.token}, timeout=3)
            except Exception as e: print("[progress] webhook failed:", e)
```
```json
// CONTRACT: one line of runs/<run_id>/metrics.jsonl  (also the webhook body)
{
  "ts": 1727300000.1, "run_id": "exp_fedprox_dp1", "event": "round",   // "start" | "round" | "end" | "error"
  "round": 12, "num_rounds": 50, "strategy": "fedprox",
  "global": {"roc_auc": 0.91, "pr_auc": 0.78, "f1": 0.71, "loss": 0.21, "ece": 0.03},
  "clients": {"0": {"roc_auc": 0.88, "num-examples": 120000}, "1": {"...": "..."}},
  "privacy": {"dp_enabled": true, "epsilon": 0.84, "delta": 1e-5, "noise_multiplier": 1.0, "clipping_norm": 1.0, "secagg": false}
}
```

## 6.6 ServerApp — `ml-fl-service/arth_fl/server_app.py`
```python
# FILE: ml-fl-service/arth_fl/server_app.py
import json, numpy as np, pandas as pd, torch
from pathlib import Path
from flwr.app import ArrayRecord, ConfigRecord, Context, MetricRecord
from flwr.serverapp import Grid, ServerApp
from .strategies import make_strategy
from .task import build_model, Preproc, evaluate as eval_loader
from .dp_accounting import epsilon_after_rounds
from .progress import Progress
from data.schema import SCHEMAS
from torch.utils.data import DataLoader, TensorDataset

app = ServerApp()

@app.main()
def main(grid: Grid, context: Context) -> None:
    rc = dict(context.run_config); num_rounds = int(rc["num-server-rounds"])
    n_clients = int(context.node_config.get("num-partitions", 5)) if hasattr(context, "node_config") else 5
    s = SCHEMAS[rc["dataset"]]
    prog = Progress(rc["runs-dir"], rc["run-id"], rc.get("progress-webhook", ""))

    # ---- global test set + a preproc fitted ONLY on the public test frame's own stats (documented limitation) ----
    root = Path(rc["partitions-dir"]) / rc["dataset"] / f"hfl_{n_clients}"
    te = pd.read_parquet(root / "test.parquet"); pp = Preproc(s).fit(te)
    Xn, Xc, y = pp.transform(te); test_loader = DataLoader(TensorDataset(torch.tensor(Xn), torch.tensor(Xc), torch.tensor(y)), 2048)
    model = build_model(rc, s, pp.cardinalities()); arrays = ArrayRecord(model.state_dict())

    def global_evaluate(server_round: int, arrays: ArrayRecord, config: ConfigRecord) -> MetricRecord:
        model.load_state_dict(arrays.to_torch_state_dict()); m = eval_loader(model, test_loader, "cpu")
        eps = epsilon_after_rounds(rc["dp-noise-multiplier"], server_round, rc["fraction-train"], rc["dp-delta"]) if rc["dp-enabled"] else None
        prog.emit({"run_id": rc["run-id"], "event": "round", "round": server_round, "num_rounds": num_rounds, "strategy": rc["strategy"],
                   "global": {k: m[k] for k in ["roc_auc", "pr_auc", "f1", "loss", "ece", "recall_at_p90"]},
                   "privacy": {"dp_enabled": bool(rc["dp-enabled"]), "epsilon": eps, "delta": rc["dp-delta"],
                               "noise_multiplier": rc["dp-noise-multiplier"], "clipping_norm": rc["dp-clipping-norm"],
                               "secagg": bool(rc["secagg-enabled"])}})
        return MetricRecord({"server_roc_auc": m["roc_auc"], "server_pr_auc": m["pr_auc"], "server_loss": m["loss"]})

    prog.emit({"run_id": rc["run-id"], "event": "start", "config": {k: v for k, v in rc.items() if not k.startswith("progress")}})
    strategy = make_strategy(rc, n_clients)
    result = strategy.start(grid=grid, initial_arrays=arrays,
                            train_config=ConfigRecord({"lr": rc["learning-rate"], "local-epochs": rc["local-epochs"], "proximal-mu": rc["proximal-mu"]}),
                            num_rounds=num_rounds, evaluate_fn=global_evaluate)

    # ---- persist final model + summary ----
    out = Path(rc["runs-dir"]) / rc["run-id"]; out.mkdir(parents=True, exist_ok=True)
    torch.save(result.arrays.to_torch_state_dict(), out / "global_model.pt")
    model.load_state_dict(result.arrays.to_torch_state_dict()); final = eval_loader(model, test_loader, "cpu")
    summary = {"run_id": rc["run-id"], "config": rc, "final": final,
               "epsilon": epsilon_after_rounds(rc["dp-noise-multiplier"], num_rounds, rc["fraction-train"], rc["dp-delta"]) if rc["dp-enabled"] else None}
    (out / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
    prog.emit({"run_id": rc["run-id"], "event": "end", "final": final, "epsilon": summary["epsilon"]})
```
> **Known limitation to disclose:** server-side standardization stats. Fitting on the test frame is a mild leak of *feature scale* only (no labels). Preferred fix (Phase 3+): clients send DP-noised `(sum, sumsq, n)` in round 0 via a `MetricRecord`; server derives global mean/std with SecAgg. Implement as `robust federated standardization` if time allows.

## 6.7 Running
```bash
cd ml-fl-service
flwr run . local-sim --stream                                  # FedProx, no DP, 5 banks
flwr run . local-sim --run-config "strategy=fedavg run-id=fedavg" --stream
flwr run . local-sim --run-config "dp-enabled=true dp-noise-multiplier=1.0 run-id=fedprox_dp1" --stream
flwr run . local-sim-3 --run-config "dataset=gmsc task=default run-id=gmsc_fedprox" --stream
```

## 6.8 Experiment matrix — `ml-fl-service/experiments/run_matrix.py`
Runs and collects everything the pitch needs. Output: `runs/summary.json`.
```python
# FILE: ml-fl-service/experiments/run_matrix.py
import json, subprocess, itertools
from pathlib import Path
RUNS = Path("runs")
GRID = {
  "paysim_banks": [
     {"run-id": "ps_fedavg",      "strategy": "fedavg"},
     {"run-id": "ps_fedprox",     "strategy": "fedprox", "proximal-mu": 0.01},
     {"run-id": "ps_fedadam",     "strategy": "fedadam"},
     {"run-id": "ps_fedprox_dp3", "strategy": "fedprox", "dp-enabled": True, "dp-noise-multiplier": 0.6},   # ε≈3
     {"run-id": "ps_fedprox_dp1", "strategy": "fedprox", "dp-enabled": True, "dp-noise-multiplier": 1.0},   # ε≈1
     {"run-id": "ps_fedprox_dp05","strategy": "fedprox", "dp-enabled": True, "dp-noise-multiplier": 1.4},   # ε≈0.5
  ],
  "gmsc": [
     {"run-id": "gm_fedprox", "strategy": "fedprox", "task": "default"},
     {"run-id": "gm_fedprox_dp1", "strategy": "fedprox", "task": "default", "dp-enabled": True, "dp-noise-multiplier": 1.0},
  ],
}
def run_one(ds, cfg):
    kv = " ".join(f"{k}={str(v).lower() if isinstance(v, bool) else v}" for k, v in {**cfg, "dataset": ds}.items())
    subprocess.run(["flwr", "run", ".", "local-sim", "--run-config", kv, "--stream"], check=True)
if __name__ == "__main__":
    for ds, cfgs in GRID.items():
        for c in cfgs:
            if not (RUNS / c["run-id"] / "summary.json").exists(): run_one(ds, c)
    print("done")
```
```python
# FILE: ml-fl-service/experiments/report.py
import json; from pathlib import Path
RUNS = Path("runs"); rows = []
for d in RUNS.iterdir():
    if (d / "summary.json").exists():
        s = json.loads((d / "summary.json").read_text()); rows.append({"run": d.name, **s["final"], "epsilon": s.get("epsilon"), "strategy": s["config"]["strategy"], "dataset": s["config"]["dataset"]})
base = {p.stem.replace("baselines_", ""): json.loads(p.read_text()) for p in RUNS.glob("baselines_*.json")}
(RUNS / "summary.json").write_text(json.dumps({"federated": rows, "baselines": base}, indent=2)); print(json.dumps(rows, indent=2))
```
```json
// CONTRACT: runs/summary.json
{ "federated": [ {"run": "ps_fedprox", "dataset": "paysim_banks", "strategy": "fedprox", "roc_auc": 0.93, "pr_auc": 0.81, "f1": 0.74, "ece": 0.02, "epsilon": null}, ...],
  "baselines": { "paysim_banks": { "centralized": {...metrics}, "isolated": {"0": {...}, ...}, "isolated_mean": {...} } } }
```

## 6.9 Acceptance — Phase 3 (HFL core) & Phase 4 (Privacy)
- `make fl` completes 50 rounds; `runs/dev/metrics.jsonl` has 50 `round` lines; `global_model.pt` saved.
- **Ordering holds on the global test set:** `isolated_mean.pr_auc < fl(fedprox).pr_auc ≤ centralized.pr_auc`. FL SHOULD recover ≥ 90% of the centralized→isolated gap.
- FedProx SHOULD match or beat FedAvg under the natural non-IID split (report both).
- DP run `ps_fedprox_dp1` reports `epsilon` in (0.5, 2.0] at δ=1e-5 and retains ≥ 80% of non-DP PR-AUC. Record the full ε-vs-PR-AUC curve from the three DP runs.
- `pytest tests/test_fl_smoke.py` runs 2 rounds with 2 clients on a 5k-row sample in < 2 min.

## 6.10 Vertical FL + PSI showcase — `ml-fl-service/vertical/`
**Design:** 3 parties on shared customers. `bank` is the *active* party (holds label). Each party owns a *bottom* model over its features → 32-dim embedding. The active party concatenates embeddings → *top* model → logit. Only embeddings and gradients w.r.t. embeddings cross parties (with optional Gaussian noise for DP).

```python
# FILE: ml-fl-service/vertical/psi.py
"""Hashed Diffie–Hellman PSI (educational, correct in the semi-honest model). Parties learn only the intersection."""
import hashlib, secrets
P = 2**255 - 19  # use a proper group in production; here a large prime field for demo
def _h(x: str) -> int: return int.from_bytes(hashlib.sha256(x.encode()).digest(), "big") % P
class Party:
    def __init__(self, ids: list[str]): self.ids = ids; self.k = secrets.randbelow(P - 2) + 2
    def round1(self): return [pow(_h(i), self.k, P) for i in self.ids]                    # send to other
    def round2(self, others_round1): return [pow(v, self.k, P) for v in others_round1]     # double-mask, send back
def intersect(a: Party, b: Party) -> list[str]:
    """Returns b's ids that are also in a. Neither party learns the other's non-shared ids."""
    a1, b1 = a.round1(), b.round1()          # each masks own ids with own key
    a_double = set(b.round2(a1))             # H(a)^{ka·kb}  (b masks a's list)
    b_double = a.round2(b1)                  # H(b)^{kb·ka}  (a masks b's list) — same exponent, so equal iff same id
    return [i for i, v in zip(b.ids, b_double) if v in a_double]

def intersect_many(parties: list[Party]) -> list[str]:
    """3+ parties: iteratively intersect; active party (index 0) ends with the shared id set."""
    shared = set(parties[0].ids)
    for p in parties[1:]: shared &= set(intersect(Party(sorted(shared)), p))
    return sorted(shared)
```
> Unit test: 3 parties with known overlap; `intersect_many` MUST equal `set(a) & set(b) & set(c)`. Note the demo group (prime field, no subgroup checks) is educational; state this in `DECISIONS.md`.

```python
# FILE: ml-fl-service/vertical/split_nn.py
import torch, torch.nn as nn
class Bottom(nn.Module):
    def __init__(self, n_in, d=32): super().__init__(); self.f = nn.Sequential(nn.Linear(n_in, 64), nn.GELU(), nn.Linear(64, d))
    def forward(self, x): return self.f(x)
class Top(nn.Module):
    def __init__(self, n_parties, d=32): super().__init__(); self.f = nn.Sequential(nn.Linear(n_parties * d, 64), nn.GELU(), nn.Linear(64, 1))
    def forward(self, embs): return self.f(torch.cat(embs, 1)).squeeze(-1)

def vfl_step(bottoms, tops_opt, bottoms_opt, top, xs, y, noise_std=0.0):
    """One synchronous VFL step. Passive parties send embeddings; active party returns grads w.r.t. embeddings."""
    embs = [b(x) for b, x in zip(bottoms, xs)]
    if noise_std: embs = [e + noise_std * torch.randn_like(e) for e in embs]      # DP-style noise on activations
    embs_d = [e.detach().requires_grad_(True) for e in embs]
    loss = nn.functional.binary_cross_entropy_with_logits(top(embs_d), y)
    tops_opt.zero_grad(); loss.backward(); tops_opt.step()
    for e, ed, opt in zip(embs, embs_d, bottoms_opt):                             # send ∂L/∂emb back to each party
        opt.zero_grad(); e.backward(ed.grad); opt.step()
    return loss.item()
```
`run_vfl_demo.py` MUST: load `party_*.parquet`, run PSI to align ids, standardize per party, train 20 epochs, evaluate on aligned held-out rows, and write `runs/vfl_demo/summary.json` with `{"aligned_n", "bank_only_auc", "vfl_auc", "gain"}`. Acceptance: `vfl_auc > bank_only_auc`.

---

# 7. FastAPI service — `ml-fl-service/app.py`

## 7.1 Job manager — `ml-fl-service/jobs/manager.py`
```python
# FILE: ml-fl-service/jobs/manager.py
import subprocess, threading, uuid, json, time
from pathlib import Path
from settings import settings

class JobManager:
    def __init__(self): self.jobs: dict[str, dict] = {}
    def start(self, run_config: dict, federation="local-sim") -> str:
        run_id = run_config.get("run-id") or f"run_{uuid.uuid4().hex[:8]}"; run_config["run-id"] = run_id
        run_config.setdefault("progress-webhook", settings.PROGRESS_WEBHOOK)
        kv = " ".join(f"{k}={str(v).lower() if isinstance(v, bool) else v}" for k, v in run_config.items())
        import os; env = {**os.environ, "ARTH_DP_ENABLED": str(bool(run_config.get("dp-enabled", False))).lower(),
                          "ARTH_SECAGG_ENABLED": str(bool(run_config.get("secagg-enabled", False))).lower()}
        proc = subprocess.Popen(["flwr", "run", ".", federation, "--run-config", kv, "--stream"],
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
        self.jobs[run_id] = {"proc": proc, "status": "running", "started": time.time(), "config": run_config, "log": []}
        threading.Thread(target=self._pump, args=(run_id,), daemon=True).start(); return run_id
    def _pump(self, run_id):
        j = self.jobs[run_id]
        for line in j["proc"].stdout: j["log"].append(line.rstrip()); j["log"] = j["log"][-500:]
        j["status"] = "finished" if j["proc"].wait() == 0 else "failed"
    def status(self, run_id):
        j = self.jobs.get(run_id); f = Path(settings.RUNS_DIR) / run_id / "metrics.jsonl"
        rounds = [json.loads(l) for l in f.read_text().splitlines()] if f.exists() else []
        return {"run_id": run_id, "status": j["status"] if j else ("finished" if rounds else "unknown"),
                "config": j["config"] if j else None, "rounds": [r for r in rounds if r.get("event") == "round"],
                "final": next((r for r in rounds if r.get("event") == "end"), None), "log_tail": j["log"][-30:] if j else []}
    def stop(self, run_id):
        j = self.jobs.get(run_id)
        if j and j["proc"].poll() is None: j["proc"].terminate(); j["status"] = "stopped"
manager = JobManager()
```

## 7.2 API — `ml-fl-service/app.py`
```python
# FILE: ml-fl-service/app.py
import json, asyncio, numpy as np, pandas as pd, torch
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse   # add `sse-starlette` to requirements
from pydantic import BaseModel, Field
from settings import settings
from jobs.manager import manager
from data.schema import SCHEMAS
from arth_fl.task import build_model, Preproc
from explain.shap_utils import explain_torch

app = FastAPI(title="Arth Saathi ML/FL Service", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def internal(x_internal_token: str = Header(default="")):
    if x_internal_token != settings.NODE_INTERNAL_TOKEN: raise HTTPException(401, "bad internal token")

# ---------- schemas ----------
class FLStartReq(BaseModel):
    dataset: str = "paysim_banks"; strategy: str = "fedprox"; num_server_rounds: int = Field(30, alias="num-server-rounds")
    dp_enabled: bool = Field(False, alias="dp-enabled"); dp_noise_multiplier: float = Field(1.0, alias="dp-noise-multiplier")
    secagg_enabled: bool = Field(False, alias="secagg-enabled"); run_id: str | None = Field(None, alias="run-id")
    federation: str = "local-sim"
    class Config: populate_by_name = True
class PredictReq(BaseModel):
    run_id: str; dataset: str = "paysim_banks"; rows: list[dict]; explain: bool = False

# ---------- health ----------
@app.get("/health")
def health(): return {"ok": True, "service": "ml-fl-service"}

# ---------- datasets ----------
@app.get("/datasets")
def datasets():
    out = []
    for k, s in SCHEMAS.items():
        for part in (Path(settings.PARTITIONS_DIR) / k).glob("hfl_*"):
            meta = json.loads((part / "meta.json").read_text()) if (part / "meta.json").exists() else {}
            out.append({"dataset": k, "task": "fraud" if k.startswith("paysim") else "default", "partition": part.name, "meta": meta})
    return out

# ---------- FL control ----------
@app.post("/fl/start", dependencies=[Depends(internal)])
def fl_start(req: FLStartReq):
    cfg = {"dataset": req.dataset, "strategy": req.strategy, "num-server-rounds": req.num_server_rounds,
           "dp-enabled": req.dp_enabled, "dp-noise-multiplier": req.dp_noise_multiplier, "secagg-enabled": req.secagg_enabled}
    if req.run_id: cfg["run-id"] = req.run_id
    return {"run_id": manager.start(cfg, req.federation)}
@app.get("/fl/runs")
def fl_runs():
    root = Path(settings.RUNS_DIR); runs = []
    for d in sorted(root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if d.is_dir() and (d / "metrics.jsonl").exists():
            st = manager.status(d.name); runs.append({"run_id": d.name, "status": st["status"], "rounds_done": len(st["rounds"]), "final": st["final"], "config": st["config"]})
    return runs
@app.get("/fl/status/{run_id}")
def fl_status(run_id: str): return manager.status(run_id)
@app.post("/fl/stop/{run_id}", dependencies=[Depends(internal)])
def fl_stop(run_id: str): manager.stop(run_id); return {"ok": True}
@app.get("/fl/stream/{run_id}")
async def fl_stream(run_id: str):
    f = Path(settings.RUNS_DIR) / run_id / "metrics.jsonl"
    async def gen():
        pos = 0
        while True:
            if f.exists():
                txt = f.read_text(); new = txt[pos:]; pos = len(txt)
                for line in new.splitlines():
                    yield {"event": "progress", "data": line}
                    if '"event": "end"' in line: return
            await asyncio.sleep(1.0)
    return EventSourceResponse(gen())
@app.get("/fl/summary")
def fl_summary():
    p = Path(settings.RUNS_DIR) / "summary.json"
    if not p.exists(): raise HTTPException(404, "run `make experiments` first")
    return json.loads(p.read_text())

# ---------- inference ----------
_MODEL_CACHE: dict[str, tuple] = {}
def _load(run_id: str, dataset: str):
    if run_id in _MODEL_CACHE: return _MODEL_CACHE[run_id]
    d = Path(settings.RUNS_DIR) / run_id; s = SCHEMAS[dataset]; summ = json.loads((d / "summary.json").read_text()); rc = summ["config"]
    te = pd.read_parquet(Path(settings.PARTITIONS_DIR) / dataset / "hfl_5" / "test.parquet"); pp = Preproc(s).fit(te)
    model = build_model(rc, s, pp.cardinalities()); model.load_state_dict(torch.load(d / "global_model.pt", map_location="cpu")); model.eval()
    _MODEL_CACHE[run_id] = (model, pp, s, te.sample(200, random_state=0)); return _MODEL_CACHE[run_id]

@app.post("/predict")
def predict(req: PredictReq):
    model, pp, s, bg = _load(req.run_id, req.dataset); df = pd.DataFrame(req.rows)
    for c in s.numeric + s.categorical:
        if c not in df: df[c] = 0 if c in s.numeric else pp.CAT_VOCAB.get(c, ["UNK"])[0]
    df[s.target] = 0; Xn, Xc, _ = pp.transform(df)
    with torch.no_grad(): p = torch.sigmoid(model(torch.tensor(Xn), torch.tensor(Xc))).numpy()
    out = {"run_id": req.run_id, "scores": [float(x) for x in p], "risk_band": ["high" if x >= 0.7 else "medium" if x >= 0.3 else "low" for x in p]}
    if req.explain:
        bXn, bXc, _ = pp.transform(bg); out["explanations"] = explain_torch(model, bXn, bXc, Xn, Xc, s.numeric + s.categorical)
    return out

@app.get("/customers/{dataset}/{run_id}/sample")
def sample_customers(dataset: str, run_id: str, n: int = 50, client_id: int | None = None):
    """Analyst view: scored rows from the (public) test partition, optionally filtered to a client's natural partition."""
    model, pp, s, _ = _load(run_id, dataset)
    te = pd.read_parquet(Path(settings.PARTITIONS_DIR) / dataset / "hfl_5" / "test.parquet")
    if client_id is not None and s.client_col in te: te = te[te[s.client_col] == sorted(te[s.client_col].unique())[client_id]]
    te = te.sample(min(n, len(te)), random_state=1); Xn, Xc, y = pp.transform(te)
    with torch.no_grad(): p = torch.sigmoid(model(torch.tensor(Xn), torch.tensor(Xc))).numpy()
    rows = te[[s.id_col, *s.numeric[:6], *s.categorical]].to_dict("records")
    for r, sc, yy in zip(rows, p, y): r.update({"score": float(sc), "label": int(yy)})
    return {"rows": rows}
```
> Add `sse-starlette>=2.0` to requirements.

## 7.3 API contracts (Python service)
```
GET  /health                              -> {ok, service}
GET  /datasets                            -> [{dataset, task, partition, meta}]
POST /fl/start        (internal token)    -> {run_id}            body: FLStartReq
GET  /fl/runs                             -> [{run_id, status, rounds_done, final, config}]
GET  /fl/status/{run_id}                  -> {run_id, status, config, rounds[], final, log_tail[]}
GET  /fl/stream/{run_id}   (SSE)          -> event: progress, data: <metrics.jsonl line>
POST /fl/stop/{run_id}    (internal token)-> {ok}
GET  /fl/summary                          -> runs/summary.json
POST /predict                             -> {run_id, scores[], risk_band[], explanations?}
GET  /customers/{dataset}/{run_id}/sample -> {rows:[{id, ...features, score, label}]}
```

---

# 8. Graph intelligence layer (Neo4j)

## 8.1 Privacy rule
Nodes carry **pseudonymous ids** (`sha256(id + institution_salt)[:16]`) and **derived** attributes (score, band, cluster). No names, no raw balances. Edges carry aggregated stats only.

## 8.2 Graph model
```
(:Institution {id, name})
(:Account {pid, institution_id, risk_score, risk_band, cluster_id, degree_in, degree_out, pagerank})
(:Merchant {pid, category})
(:RiskSegment {id, label, avg_score, size})
(:Campaign {id, label, size, avg_score})          # fraud ring / community

(Account)-[:TRANSFERRED_TO {n_tx, total_amt, max_amt, frac_flagged}]->(Account)
(Account)-[:BELONGS_TO]->(Institution)
(Account)-[:IN_SEGMENT]->(RiskSegment)
(Account)-[:MEMBER_OF]->(Campaign)
```
Constraints:
```cypher
CREATE CONSTRAINT acct_pid IF NOT EXISTS FOR (a:Account) REQUIRE a.pid IS UNIQUE;
CREATE CONSTRAINT inst_id  IF NOT EXISTS FOR (i:Institution) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT camp_id  IF NOT EXISTS FOR (c:Campaign) REQUIRE c.id IS UNIQUE;
CREATE INDEX acct_score IF NOT EXISTS FOR (a:Account) ON (a.risk_score);
```

## 8.3 Ingest — `ml-fl-service/graph/ingest.py`
```python
# FILE: ml-fl-service/graph/ingest.py
import hashlib, json, pandas as pd, numpy as np, torch
from pathlib import Path
from neo4j import GraphDatabase
from settings import settings
from data.schema import SCHEMAS
from arth_fl.task import build_model, Preproc

SALT = "arth-saathi-demo-salt"
def pid(x: str) -> str: return hashlib.sha256(f"{x}:{SALT}".encode()).hexdigest()[:16]

def score_frame(run_id, dataset, df):
    s = SCHEMAS[dataset]; d = Path(settings.RUNS_DIR) / run_id; rc = json.loads((d / "summary.json").read_text())["config"]
    pp = Preproc(s).fit(df); Xn, Xc, _ = pp.transform(df); m = build_model(rc, s, pp.cardinalities())
    m.load_state_dict(torch.load(d / "global_model.pt", map_location="cpu")); m.eval()
    with torch.no_grad(): return torch.sigmoid(m(torch.tensor(Xn), torch.tensor(Xc))).numpy()

def ingest_paysim(run_id: str, max_rows=200_000):
    s = SCHEMAS["paysim_banks"]; te = pd.read_parquet(Path(settings.PARTITIONS_DIR) / "paysim_banks/hfl_5/test.parquet").head(max_rows)
    te["score"] = score_frame(run_id, "paysim_banks", te)
    edges = (te.assign(src=te.nameOrig.map(pid), dst=te.nameDest.map(pid), flagged=(te.score >= 0.7).astype(int))
               .groupby(["src", "dst"]).agg(n_tx=("amount", "size"), total_amt=("amount", "sum"), max_amt=("amount", "max"), frac_flagged=("flagged", "mean")).reset_index())
    accts = pd.concat([te.assign(p=te.nameOrig.map(pid), inst=te.BankID)[["p", "inst", "score"]],
                       te.assign(p=te.nameDest.map(pid), inst=-1)[["p", "inst", "score"]]]).groupby("p").agg(inst=("inst", "max"), score=("score", "max")).reset_index()
    accts["band"] = np.where(accts.score >= 0.7, "high", np.where(accts.score >= 0.3, "medium", "low"))
    drv = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD))
    with drv.session() as ses:
        ses.run("UNWIND range(0,4) AS i MERGE (:Institution {id:i, name:'Bank ' + toString(i)})")
        for chunk in np.array_split(accts, max(1, len(accts) // 5000)):
            ses.run("""UNWIND $rows AS r MERGE (a:Account {pid:r.p}) SET a.risk_score=r.score, a.risk_band=r.band, a.institution_id=r.inst
                       WITH a, r WHERE r.inst >= 0 MATCH (i:Institution {id:r.inst}) MERGE (a)-[:BELONGS_TO]->(i)""", rows=chunk.to_dict("records"))
        for chunk in np.array_split(edges, max(1, len(edges) // 5000)):
            ses.run("""UNWIND $rows AS r MATCH (a:Account {pid:r.src}) MATCH (b:Account {pid:r.dst})
                       MERGE (a)-[t:TRANSFERRED_TO]->(b) SET t.n_tx=r.n_tx, t.total_amt=r.total_amt, t.max_amt=r.max_amt, t.frac_flagged=r.frac_flagged""", rows=chunk.to_dict("records"))
    drv.close(); print("ingested", len(accts), "accounts", len(edges), "edges")

if __name__ == "__main__":
    import sys; ingest_paysim(sys.argv[1] if len(sys.argv) > 1 else "ps_fedprox")
```

## 8.4 Community detection — `ml-fl-service/graph/community.py`
```python
# FILE: ml-fl-service/graph/community.py
from neo4j import GraphDatabase
from settings import settings
GDS = """
CALL gds.graph.project('risk', 'Account', {TRANSFERRED_TO: {orientation: 'UNDIRECTED', properties: 'n_tx'}}) YIELD graphName;
CALL gds.louvain.write('risk', {writeProperty: 'cluster_id', relationshipWeightProperty: 'n_tx'}) YIELD communityCount;
CALL gds.pageRank.write('risk', {writeProperty: 'pagerank'}) YIELD nodePropertiesWritten;
CALL gds.degree.write('risk', {writeProperty: 'degree_out'}) YIELD nodePropertiesWritten;
CALL gds.graph.drop('risk');
"""
CAMPAIGNS = """
MATCH (a:Account) WHERE a.cluster_id IS NOT NULL
WITH a.cluster_id AS c, count(*) AS size, avg(a.risk_score) AS avg_score, sum(CASE WHEN a.risk_band='high' THEN 1 ELSE 0 END) AS n_high
WHERE size >= 5 AND avg_score >= 0.4
MERGE (k:Campaign {id:c}) SET k.size=size, k.avg_score=avg_score, k.n_high=n_high, k.label='Ring #' + toString(c)
WITH k MATCH (a:Account {cluster_id:k.id}) MERGE (a)-[:MEMBER_OF]->(k)
"""
def run():
    drv = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD))
    with drv.session() as s:
        try:
            for stmt in [x for x in GDS.split(";") if x.strip()]: s.run(stmt)
        except Exception as e:
            print("GDS unavailable, falling back to networkx:", e); _networkx_fallback(s)
        s.run(CAMPAIGNS)
    drv.close()
def _networkx_fallback(ses):
    import networkx as nx
    from networkx.algorithms.community import louvain_communities
    rows = ses.run("MATCH (a)-[t:TRANSFERRED_TO]->(b) RETURN a.pid AS s, b.pid AS d, t.n_tx AS w").data()
    G = nx.Graph(); G.add_weighted_edges_from([(r["s"], r["d"], r["w"]) for r in rows])
    comms = louvain_communities(G, weight="weight", seed=42); pr = nx.pagerank(G, weight="weight")
    upd = [{"pid": n, "c": i, "pr": pr.get(n, 0.0), "deg": G.degree(n)} for i, c in enumerate(comms) for n in c]
    ses.run("UNWIND $rows AS r MATCH (a:Account {pid:r.pid}) SET a.cluster_id=r.c, a.pagerank=r.pr, a.degree_out=r.deg", rows=upd)
if __name__ == "__main__": run()
```

## 8.5 Graph-derived features back into the model — `ml-fl-service/graph/features.py`
Computed **per client partition only** (each bank sees only its own transaction graph) to preserve the FL premise. Fill `dest_in_degree`, `dest_out_degree`, `orig_pagerank` in `client_i/train.parquet` using networkx on that client's edges. Run before `make fl` as `python -m graph.features --dataset paysim_banks`. Centralized baseline MAY use global graph features and MUST be labelled `centralized_with_global_graph` in reports.

## 8.6 Node `server` graph routes — `server/src/routes/graph.js` (extend)
```js
// FILE: server/src/routes/graph.js  (ADD these routes; keep existing driver setup)
router.get("/risk-graph/overview", async (req, res) => {
  const { minScore = 0.3, limit = 400 } = req.query; const s = driver.session();
  try {
    const r = await s.run(`
      MATCH (a:Account)-[t:TRANSFERRED_TO]->(b:Account)
      WHERE a.risk_score >= $minScore OR b.risk_score >= $minScore
      WITH a, b, t ORDER BY t.frac_flagged DESC, t.total_amt DESC LIMIT toInteger($limit)
      RETURN collect(DISTINCT {id:a.pid, score:a.risk_score, band:a.risk_band, cluster:a.cluster_id, inst:a.institution_id, pagerank:a.pagerank})
           + collect(DISTINCT {id:b.pid, score:b.risk_score, band:b.risk_band, cluster:b.cluster_id, inst:b.institution_id, pagerank:b.pagerank}) AS nodes,
             collect({source:a.pid, target:b.pid, n_tx:t.n_tx, total_amt:t.total_amt, frac_flagged:t.frac_flagged}) AS edges`,
      { minScore: Number(minScore), limit: Number(limit) });
    const rec = r.records[0]; const seen = new Set();
    const nodes = rec.get("nodes").filter(n => !seen.has(n.id) && seen.add(n.id)).map(n => ({ ...n, cluster: toNumber(n.cluster), inst: toNumber(n.inst) }));
    res.json({ nodes, edges: rec.get("edges").map(e => ({ ...e, n_tx: toNumber(e.n_tx) })) });
  } catch (e) { res.status(500).json({ error: e.message }); } finally { await s.close(); }
});

router.get("/risk-graph/campaigns", async (_req, res) => {
  const s = driver.session();
  try {
    const r = await s.run(`MATCH (k:Campaign) RETURN k.id AS id, k.label AS label, k.size AS size, k.avg_score AS avg_score, k.n_high AS n_high ORDER BY k.avg_score DESC LIMIT 25`);
    res.json(r.records.map(x => ({ id: toNumber(x.get("id")), label: x.get("label"), size: toNumber(x.get("size")), avg_score: x.get("avg_score"), n_high: toNumber(x.get("n_high")) })));
  } catch (e) { res.status(500).json({ error: e.message }); } finally { await s.close(); }
});

router.get("/risk-graph/campaign/:id", async (req, res) => {
  const s = driver.session();
  try {
    const r = await s.run(`MATCH (a:Account)-[:MEMBER_OF]->(k:Campaign {id: toInteger($id)})
      OPTIONAL MATCH (a)-[t:TRANSFERRED_TO]->(b:Account)-[:MEMBER_OF]->(k)
      RETURN collect(DISTINCT {id:a.pid, score:a.risk_score, band:a.risk_band, inst:a.institution_id}) AS nodes,
             collect(DISTINCT {source:a.pid, target:b.pid, n_tx:t.n_tx, total_amt:t.total_amt}) AS edges`, { id: req.params.id });
    const rec = r.records[0]; res.json({ nodes: rec.get("nodes"), edges: rec.get("edges").filter(e => e.target) });
  } catch (e) { res.status(500).json({ error: e.message }); } finally { await s.close(); }
});

router.get("/risk-graph/account/:pid/neighbors", async (req, res) => {
  const s = driver.session();
  try {
    const r = await s.run(`MATCH (a:Account {pid:$pid})-[t:TRANSFERRED_TO]-(b:Account)
      RETURN a.pid AS center, collect({id:b.pid, score:b.risk_score, band:b.risk_band, n_tx:t.n_tx, total_amt:t.total_amt}) AS nbrs`, { pid: req.params.pid });
    res.json(r.records[0] ? { center: r.records[0].get("center"), neighbors: r.records[0].get("nbrs") } : { center: req.params.pid, neighbors: [] });
  } catch (e) { res.status(500).json({ error: e.message }); } finally { await s.close(); }
});
```
```json
// CONTRACT: GET /api/risk-graph/overview
{ "nodes": [{"id":"9f2a...", "score":0.83, "band":"high", "cluster":17, "inst":2, "pagerank":0.0012}],
  "edges": [{"source":"9f2a...", "target":"c01b...", "n_tx":4, "total_amt":182000.5, "frac_flagged":0.75}] }
```

## 8.7 Acceptance — Phase 5 (Graph)
- `python -m graph.ingest ps_fedprox && python -m graph.community` completes; `MATCH (k:Campaign) RETURN count(k)` ≥ 3.
- `GET /api/risk-graph/overview` returns ≤ 400 nodes in < 1.5s.
- No property on any node matches a raw `nameOrig`/`nameDest` value (test: sample 50 raw ids, assert none exist as `pid`).

---

# 9. Node backends — changes

## 9.1 `server` — roles, consent, audit, FL progress webhook

```js
// FILE: server/src/models/User.js  (ADD fields to existing schema)
role:          { type: String, enum: ["citizen", "analyst", "admin"], default: "citizen" },
institutionId: { type: Number, default: null },      // analysts only; maps to Flower partition-id / BankID
customerRef:   { type: String, default: null },      // citizens: pseudonymous id used for demo scoring
```
```js
// FILE: server/src/middleware/requireRole.js
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "Forbidden" });
```
```js
// FILE: server/src/models/Consent.js
import mongoose from "mongoose";
const consentSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  purpose:     { type: String, enum: ["risk_scoring", "fraud_monitoring", "model_training", "cross_institution_fl"], required: true },
  granted:     { type: Boolean, required: true },
  institutionId: { type: Number, default: null },
  version:     { type: String, default: "v1" },
  ip:          String,
}, { timestamps: true });
consentSchema.index({ user: 1, purpose: 1, createdAt: -1 });
export default mongoose.model("Consent", consentSchema);
```
```js
// FILE: server/src/models/AuditLog.js
import mongoose from "mongoose";
const auditSchema = new mongoose.Schema({
  actor:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  role:    String,
  action:  { type: String, required: true },   // e.g. "fl.start", "predict", "consent.grant", "consent.revoke", "data.erase_request"
  target:  String,                             // run_id / customerRef / pid
  meta:    mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ createdAt: -1 });
export default mongoose.model("AuditLog", auditSchema);
```
```js
// FILE: server/src/routes/flProgress.js
import express from "express";
const router = express.Router();
// Called by ml-fl-service Progress.emit(); re-broadcasts via Socket.IO
router.post("/fl/progress", (req, res) => {
  if (req.headers["x-internal-token"] !== process.env.NODE_INTERNAL_TOKEN) return res.status(401).end();
  const io = req.app.get("io"); io.to(`fl:${req.body.run_id}`).emit("fl:progress", req.body); io.emit("fl:any", req.body);
  res.json({ ok: true });
});
export default router;
```
```js
// FILE: server/src/index.js  (ADD inside io.on("connection"))
socket.on("fl:subscribe", ({ runId }) => runId && socket.join(`fl:${runId}`));
socket.on("fl:unsubscribe", ({ runId }) => runId && socket.leave(`fl:${runId}`));
```
Register `flProgress` in `server/src/routes/index.js`: `router.use("/", flProgressRouter);`. Also add `mongoose` `role` to JWT payload in `utils/jwt.js` / `authController.js` (`signToken({ id, role, institutionId })`) and expose `role`/`institutionId` in `/auth/profile`.

Consent routes (in `server`):
```
POST /api/consent                 (auth)              body {purpose, granted}       -> {ok, consent}
GET  /api/consent/me              (auth)                                            -> {purposes: {risk_scoring: true, ...}, history[]}
POST /api/consent/erase-request   (auth, citizen)                                   -> {ok, ticketId}   (writes AuditLog action=data.erase_request)
GET  /api/audit?limit=100         (auth, analyst/admin)                             -> [AuditLog]
```

## 9.2 `chatbot-backend` — FL proxy + copilot

```js
// FILE: chatbot-backend/src/helpers/mlClient.js
import axios from "axios";
const base = process.env.ML_API_URL || "http://localhost:8000";
const hdr = { "x-internal-token": process.env.NODE_INTERNAL_TOKEN || "" };
export const ml = {
  startFL: (cfg) => axios.post(`${base}/fl/start`, cfg, { headers: hdr }).then(r => r.data),
  stopFL:  (id)  => axios.post(`${base}/fl/stop/${id}`, {}, { headers: hdr }).then(r => r.data),
  status:  (id)  => axios.get(`${base}/fl/status/${id}`).then(r => r.data),
  runs:    ()    => axios.get(`${base}/fl/runs`).then(r => r.data),
  summary: ()    => axios.get(`${base}/fl/summary`).then(r => r.data),
  predict: (b)   => axios.post(`${base}/predict`, b).then(r => r.data),
  sample:  (ds, run, q) => axios.get(`${base}/customers/${ds}/${run}/sample`, { params: q }).then(r => r.data),
};
```
```js
// FILE: chatbot-backend/src/routes/flRoutes.js
import express from "express";
import { ml } from "../helpers/mlClient.js";
import { protect, requireRole, audit } from "../middleware/auth.js";   // adapt to existing auth middleware in this service
const r = express.Router();
r.post("/start",  protect, requireRole("analyst", "admin"), async (req, res) => { const out = await ml.startFL(req.body); await audit(req, "fl.start", out.run_id, req.body); res.json(out); });
r.post("/stop/:id", protect, requireRole("analyst", "admin"), async (req, res) => { await audit(req, "fl.stop", req.params.id); res.json(await ml.stopFL(req.params.id)); });
r.get("/runs", protect, async (_q, res) => res.json(await ml.runs()));
r.get("/status/:id", protect, async (req, res) => res.json(await ml.status(req.params.id)));
r.get("/summary", protect, async (_q, res) => res.json(await ml.summary()));
r.post("/predict", protect, async (req, res) => { await audit(req, "predict", req.body.run_id, { n: req.body.rows?.length }); res.json(await ml.predict(req.body)); });
r.get("/customers", protect, requireRole("analyst", "admin"), async (req, res) =>
  res.json(await ml.sample(req.query.dataset || "paysim_banks", req.query.run_id, { n: req.query.n || 50, client_id: req.user.institutionId })));
export default r;
```
Mount at `/api/fl` in `chatbot-backend/src/app.js`. **Important:** `chatbot-backend` uses Supabase auth today; `server` uses Mongo JWT. Pick ONE identity provider for the new pages — **recommended: `server` Mongo JWT** (it already has `User`, roles are trivial to add). Make `chatbot-backend`'s `protect` verify the same `JWT_SECRET`. Record in `DECISIONS.md`.

Copilot prompt:
```js
// FILE: chatbot-backend/src/prompts/riskCopilotPrompt.js
export const RISK_COPILOT_ANALYST = `You are Arth Saathi, a risk-investigation copilot for a bank analyst.
You have access to: (1) the current federated model run summary (metrics per round, privacy budget), (2) scored customers for THIS analyst's institution only,
(3) derived graph intelligence (risk clusters, campaigns) — all pseudonymised.
Rules: never invent data; cite the run_id and round when quoting metrics; explain trade-offs (privacy budget ε vs accuracy) plainly;
never attempt to re-identify a pseudonymous account; when asked about another institution's customers, refuse and explain the federated design.
Answer with short headers and bullet points. Include a one-line "So what for the bank" at the end.`;
export const RISK_COPILOT_CITIZEN = `You are Arth Saathi, a friendly financial companion for an individual customer.
Explain their risk score in plain language using ONLY the provided SHAP contributions; give 3 practical, non-judgmental steps to improve;
explain their DPDP rights (access, correction, erasure, consent withdrawal) when asked; never give guarantees about loan approval.`;
```
Inject context (`/fl/status`, `/customers`, `/risk-graph/campaigns`, `/predict?explain=true`) into the prompt via a `buildRiskContext(req)` helper before calling the LLM in the existing chat route. Add `mode: "risk_analyst" | "risk_citizen"` to the existing chat request body.

---

# 10. Frontend (Next.js)

## 10.1 Endpoints — extend `client/src/config/endpoints.js`
```js
// ADD to ENDPOINTS
fl: `${MAIN_API}/api/fl`,                     // start/stop/runs/status/summary/predict/customers (via chatbot-backend)
flStream: (runId) => `${ML_API}/fl/stream/${runId}`,  // SSE direct to python (read-only)
riskGraphOverview: `${GRAPH_API}/api/risk-graph/overview`,
riskGraphCampaigns: `${GRAPH_API}/api/risk-graph/campaigns`,
riskGraphCampaign: (id) => `${GRAPH_API}/api/risk-graph/campaign/${id}`,
riskGraphNeighbors: (pid) => `${GRAPH_API}/api/risk-graph/account/${pid}/neighbors`,
consent: `${GRAPH_API}/api/consent`,
audit: `${GRAPH_API}/api/audit`,
```

## 10.2 Typed API client — `client/src/lib/api.ts`
```ts
// FILE: client/src/lib/api.ts
import { ENDPOINTS } from "@/config/endpoints";
const auth = () => ({ Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : ""}` });
const j = async (r: Response) => { if (!r.ok) throw new Error(await r.text()); return r.json(); };

export type RoundEvent = { event: "start"|"round"|"end"|"error"; run_id: string; round?: number; num_rounds?: number; strategy?: string;
  global?: { roc_auc: number; pr_auc: number; f1: number; loss: number; ece: number; recall_at_p90?: number };
  privacy?: { dp_enabled: boolean; epsilon: number|null; delta: number; noise_multiplier: number; clipping_norm: number; secagg: boolean }; final?: any };

export const api = {
  fl: {
    start: (cfg: Record<string, unknown>) => fetch(`${ENDPOINTS.fl}/start`, { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify(cfg) }).then(j),
    stop: (id: string) => fetch(`${ENDPOINTS.fl}/stop/${id}`, { method: "POST", headers: auth() }).then(j),
    runs: () => fetch(`${ENDPOINTS.fl}/runs`, { headers: auth() }).then(j),
    status: (id: string) => fetch(`${ENDPOINTS.fl}/status/${id}`, { headers: auth() }).then(j),
    summary: () => fetch(`${ENDPOINTS.fl}/summary`, { headers: auth() }).then(j),
    predict: (b: unknown) => fetch(`${ENDPOINTS.fl}/predict`, { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify(b) }).then(j),
    customers: (q: Record<string, string>) => fetch(`${ENDPOINTS.fl}/customers?` + new URLSearchParams(q), { headers: auth() }).then(j),
    stream: (id: string, onEvent: (e: RoundEvent) => void) => { const es = new EventSource(ENDPOINTS.flStream(id)); es.onmessage = (m) => onEvent(JSON.parse(m.data)); return () => es.close(); },
  },
  graph: {
    overview: (minScore = 0.3, limit = 400) => fetch(`${ENDPOINTS.riskGraphOverview}?minScore=${minScore}&limit=${limit}`).then(j),
    campaigns: () => fetch(ENDPOINTS.riskGraphCampaigns).then(j),
    campaign: (id: number) => fetch(ENDPOINTS.riskGraphCampaign(id)).then(j),
    neighbors: (pid: string) => fetch(ENDPOINTS.riskGraphNeighbors(pid)).then(j),
  },
  consent: {
    me: () => fetch(`${ENDPOINTS.consent}/me`, { headers: auth() }).then(j),
    set: (purpose: string, granted: boolean) => fetch(ENDPOINTS.consent, { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify({ purpose, granted }) }).then(j),
    erase: () => fetch(`${ENDPOINTS.consent}/erase-request`, { method: "POST", headers: auth() }).then(j),
  },
};
```

## 10.3 Pages & components (what each MUST show)

**`/analyst` (portfolio overview)** — cards: customers scored, high-risk %, latest run PR-AUC, current ε; `ComparisonBars` (isolated vs FL vs centralized from `/fl/summary`); table of top-risk customers (from `/fl/customers`, institution-scoped) linking to `/analyst/customers/[id]`.

**`/analyst/fl` (FL control panel)** — `FLControlPanel`: dataset select, strategy select (`fedavg|fedprox|fedadam`), rounds slider, **DP toggle + noise slider showing predicted ε** (call a tiny `/fl/epsilon?noise=&rounds=` helper — add to python API), SecAgg toggle; Start/Stop. Right side: `ConvergenceChart` (live via SSE: ROC-AUC & PR-AUC per round; dashed horizontal lines for isolated-mean and centralized), `PrivacyBudgetMeter` (ε consumed vs target), per-client mini-bars (from `status.rounds[-1].clients` if present), run history list. Institution chips: "Bank 0 … Bank 4 — 🔒 raw data local".

**`/analyst/graph`** — `RiskGraphViewer` (force-directed; reuse existing viewer's engine): node size = pagerank, color = band, hull/color by `cluster`; side panel lists `campaigns`; click campaign → focus subgraph; click node → neighbors; "Explain in copilot" button pre-fills chat.

**`/analyst/customers/[id]`** — score gauge, band, `ShapWaterfall` from `/fl/predict` with `explain:true`, neighbors mini-graph, recommended actions (rule table: high+ring → "escalate to FIU", high → "manual review", medium → "step-up KYC").

**`/analyst/fairness`** — (Phase 6) group-wise PR-AUC / FPR by `age_band` or `income quintile` from a `/fairness` python endpoint.

**`/citizen`** — `RiskGauge` (their `customerRef` scored via `/fl/predict`), plain-language explanation (top-3 SHAP → sentences), "what improves this" tips, copilot CTA.

**`/citizen/consent`** — `ConsentCenter`: toggles for the 4 purposes, history timeline, "Request data erasure" (creates ticket), "Download my data" (JSON of their scored row + consents). Explanatory copy citing DPDP §6, §11–12.

**Auth pages** — add role radio (Citizen / Bank employee) and, for analysts, institution select (Bank 0–4).

Component skeleton example:
```jsx
// FILE: client/src/components/risk/ConvergenceChart.jsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts";
export default function ConvergenceChart({ rounds = [], isolated, centralized, metric = "pr_auc" }) {
  const data = rounds.map(r => ({ round: r.round, value: r.global?.[metric] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <XAxis dataKey="round" /><YAxis domain={[0, 1]} /><Tooltip /><Legend />
        {isolated != null && <ReferenceLine y={isolated} stroke="#f59e0b" strokeDasharray="4 4" label="Isolated (avg)" />}
        {centralized != null && <ReferenceLine y={centralized} stroke="#10b981" strokeDasharray="4 4" label="Centralized" />}
        <Line type="monotone" dataKey="value" name={`Federated ${metric.toUpperCase()}`} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```
> Check `client/package.json` for a charting lib before adding `recharts`. If none, `npm i recharts`.

## 10.4 Acceptance — Phase 6 (UI)
- Analyst can start a run from the UI and see the convergence line update live within 5s of each round.
- Graph page renders ≥ 3 campaigns; clicking one isolates the ring.
- Citizen consent toggles persist and appear in `/api/audit`.
- No page shows a raw `nameOrig`/`nameDest`; only `pid`s.

---

# 11. Compliance mapping (for UI copy + pitch)

| Principle | Regime | Design element | Where visible |
|---|---|---|---|
| No centralization / data minimization | DPDP §8; RBI localization; PIPL | Raw parquet only inside client process; only `ArrayRecord` crosses | FL panel institution chips; architecture slide |
| Purpose limitation & consent | DPDP §6 | `Consent` model, 4 purposes, versioned | `/citizen/consent` |
| Access / correction / erasure | DPDP §11–12 | download-my-data, erase ticket, audit | `/citizen/consent` |
| Cross-border transfer | DPDP §16 | nothing leaves institution; even aggregates are DP-noised | privacy meter |
| Accountability / audit | DPDP §8(6) | `AuditLog` on start/predict/consent | `/api/audit` |
| Fairness / responsible use | RBI fair-lending; DPDP spirit | group metrics, BAF | `/analyst/fairness` |

---

# 12. Testing

```
ml-fl-service/tests/
├── test_data.py          # partitions disjoint; no synthetic in val/test; schema columns present
├── test_model.py         # forward pass shapes; loss decreases on 200 steps of a toy batch
├── test_metrics.py       # metrics on known arrays
├── test_fl_smoke.py      # 2 clients × 2 rounds on 5k sample via `flwr run . local-sim-2 --run-config "num-server-rounds=2 ..."`
├── test_dp.py            # epsilon monotone in rounds; noise_for_target_epsilon round-trips
├── test_psi.py           # 3-party PSI equals set intersection
├── test_graph_privacy.py # no raw ids in Neo4j
└── test_api.py           # FastAPI TestClient: /health, /datasets, /predict on saved smoke model
```
Add federation `local-sim-2` (`options.num-supernodes = 2`) to `pyproject.toml` for the smoke test.

Node: add `server/tests/consent.test.mjs` (supertest) for consent + role guard. Client: at minimum `npm run build` passes.

---

# 13. Build order & task checklist (agent executes top-to-bottom)

**Phase 0 — Scaffold**
- [ ] Create `ml-fl-service/` per §2 with `pyproject.toml`, `requirements.txt`, `settings.py`, `Dockerfile`, empty packages.
- [ ] `docker-compose.yml`, `Makefile`, `.env.example` files, `DECISIONS.md`.
- [ ] `server`: add `role/institutionId/customerRef` to `User`, `requireRole`, `Consent`, `AuditLog`, consent routes, `flProgress` webhook, socket rooms. Put `role` in JWT.
- [ ] `chatbot-backend`: `mlClient.js`, `flRoutes.js`, mount `/api/fl`; unify JWT verification with `server`.
- [ ] `client`: endpoints + `lib/api.ts`; role select on signup; route stubs.
- ✅ **Accept:** `docker compose up` brings all 6 services healthy; `/health` on 8000; login as analyst works.

**Phase 1 — Data** (§4) → accept §4.7.
**Phase 2 — Centralized ceiling** (§5) → accept §5.7.
**Phase 3 — HFL core** (§6.1–6.7) → accept §6.9 (non-DP parts).
**Phase 4 — Privacy** (§6.3 DP wrapper, §6.4, DP runs, SecAgg attempt) → accept §6.9 (DP parts). Write ε-vs-PR-AUC to `runs/summary.json`.
**Phase 5 — Graph** (§8) → accept §8.7. Also wire `graph/features.py` per-client features and re-run `ps_fedprox` as `ps_fedprox_graph`; report delta.
**Phase 6 — UI + copilot** (§9.2 copilot, §10) → accept §10.4.
**Phase 7 — VFL showcase + fairness + polish** (§6.10, `/fairness`, seed script, demo data, backup video).

Every phase: update `README.md` run instructions; append deviations to `DECISIONS.md`; commit with message `phase-N: <what>`.

---

# 14. Demo script (8 minutes)

1. **Silos (30s):** `/analyst/fl` — five institution chips, each "🔒 raw data local". Open `docker ps` briefly: separate processes.
2. **Today's baseline (45s):** `ComparisonBars` — isolated-model PR-AUC (weak, esp. thin-file bank with lowest positives).
3. **Federated training (2m):** click Start (FedProx, 30 rounds). Convergence line climbs past the isolated dashed line toward centralized. Narrate: only model arrays moved.
4. **Privacy (1.5m):** toggle DP (noise 1.0) + SecAgg; start second run; `PrivacyBudgetMeter` shows ε; show small, quantified accuracy cost. Show ε-vs-PR-AUC chart from `/fl/summary`.
5. **Graph (1.5m):** `/analyst/graph` — ring surfaced across institutions using only pseudonymised, derived nodes. Click "Explain in copilot".
6. **Citizen (1m):** `/citizen` — score + plain-language SHAP; `/citizen/consent` — revoke `cross_institution_fl`, show audit entry.
7. **VFL (45s):** `runs/vfl_demo/summary.json` — bank-only AUC vs bank+insurer+lending-app AUC after PSI alignment.
8. **Close (30s):** compliance table (§11).

Seed script `ml-fl-service/experiments/seed_demo.py` MUST pre-generate: `ps_fedavg`, `ps_fedprox`, `ps_fedprox_dp1`, `ps_fedprox_dp05`, baselines, graph ingest, VFL summary — so the demo works even if live training is slow.

---

# 15. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Flower API drift | §0 rule: installed version wins; keep client/server thin; smoke test in CI |
| PaySim size (6M rows) slow on laptop | `--run-config "sample-frac=0.2"` (add to task loader); GPU optional |
| DP kills accuracy | tune clip norm 0.5–2, noise 0.6–1.4; report curve honestly |
| SecAgg integration time | scaffold from official example; if blocked, ship DP only and mark SecAgg "roadmap" in `DECISIONS.md` |
| Two auth systems | unify on `server` JWT (§9.2) |
| Neo4j GDS plugin missing | networkx fallback already in `community.py` |
| Judges ask "is PaySim real?" | Answer: simulator calibrated on real mobile-money logs; GMSC is real borrowers; disclose in README |

---

# 16. References
- Flower docs — Message API (`ServerApp`, `ClientApp`, `ArrayRecord`), DP (`LocalDpMod`, `DifferentialPrivacyClientSideFixedClipping`), SecAgg example. https://flower.ai/docs
- `flwrlabs/fed-fraud-paysim-banks` (HuggingFace) — 5-bank partitioned PaySim.
- Give Me Some Credit (Kaggle); Home Credit Default Risk (Kaggle); BAF NeurIPS 2022 (Kaggle).
- FedResAttNet — federated residual-attention for cross-institution default (GMSC, 5 institutions). PeerJ CS 3972.
- FedQuAD — curvature-aware FL for credit default; secure aggregation + client-level DP. Mathematics 14(6):1012.
- Fed-RD — horizontal + vertical FL for financial crime with DP + MPC. arXiv:2408.01609.
- ICLR 2025 — Secure & scalable HFL for bank fraud (Flower + BAF).
- Opacus — RDP accountant. https://opacus.ai
- DPDP Act 2023 (MeitY); Protiviti "Navigating DPDPA in Banking"; RBI data-localization circular (2018).
