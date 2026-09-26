# Arth Saathi

Arth Saathi is a privacy-preserving financial-risk platform for citizens and bank analysts. It combines a Next.js application, MongoDB-backed identity and consent APIs, a chatbot/API gateway, Neo4j graph infrastructure, and a Python Flower service for cross-institution federated learning.

## Services

| Service | Purpose | Port |
|---|---|---:|
| `client` | Next.js citizen and analyst web application | 3000 |
| `chatbot-backend` | Copilot and authenticated ML/FL gateway | 5001 |
| `server` | Identity, consent, audit, Neo4j, and Socket.IO | 5002 |
| `ml-fl-service` | FastAPI and Flower ML/FL runtime | 8000 |
| Neo4j | Pseudonymised risk graph | 7474/7687 |
| MongoDB | Local fallback for users, consent, and audit | 27017 |

Direct server runs use the configured MongoDB Atlas URI. Docker Compose defaults to its internal MongoDB for reproducible local development; export `COMPOSE_DB_URI` before `docker compose up` only when you intentionally want Compose to use Atlas.

## Phase 0 status

Phase 0 provides:

- A Python 3.11 FastAPI/Flower project scaffold and `/health` endpoint.
- Dockerfiles, Docker Compose orchestration, health checks, and Make targets.
- MongoDB JWT identity with `citizen`, `analyst`, and `admin` roles.
- Institution-scoped analysts (`institutionId` 0–4) and pseudonymous citizen references.
- Purpose-level consent history, erasure requests, and audit records.
- Authenticated FL proxy routes and Socket.IO FL progress rooms.
- Role-aware signup and protected citizen/analyst route scaffolds.
- A verified six-service Compose stack: client, chatbot gateway, application server, CPU-only ML/FL service, MongoDB, and Neo4j all pass health checks.
- Non-root application containers and deterministic dependency installation.

## Phase 1 status

Phase 1 provides a reproducible, privacy-conscious financial data pipeline:

- Downloads the versioned `flwrlabs/fed-fraud-paysim-banks` Parquet source and records SHA-256 provenance.
- Explicitly identifies PaySim as synthetic transactions calibrated from aggregated real mobile-money patterns.
- Excludes source account IDs and the `isFlaggedFraud` target proxy from model-ready data.
- Generates keyed pseudonymous customer/counterparty IDs and causal transaction, balance, time, and velocity features.
- Preserves the official 636,262-row test split and partitions 5,726,358 training rows among five natural institutions.
- Uses deterministic customer-grouped train/validation splits and creates institution-scoped test splits.
- Supports optional, explicitly labeled SMOTE augmentation on training rows only.
- Produces `meta.json` and `validation_report.json` evidence covering schema, finite values, disjoint institutions, leakage boundaries, class distributions, and synthetic-data rules.

The generated dataset files are intentionally gitignored. Phase 2 model training consumes the reproducible partition paths. The complete architecture and phase contracts are in `IMPLEMENTATION_PLAN.md`.

## Phases 2–7 status (demo-complete)

The platform now implements the full loop end to end:

- **Baselines (Phase 2).** `models/baselines.py` trains one pooled XGBoost model (the "if pooling were legal" ceiling), one isolated XGBoost per bank, and **same-class RiskMLP baselines** (pooled + per-bank) so the federated number is compared like-for-like. Metrics: ROC-AUC, PR-AUC, F1, recall@P90, Brier, ECE → `ml-fl-service/runs/baselines_paysim_banks.json`.
- **Horizontal FL (Phase 3).** `arth_fl/federated.py` implements synchronous **FedAvg / FedProx (true proximal term) / FedAdam (adaptive server)** over the five bank partitions with a torch `RiskMLP(48,24)`. Raw parquet rows never leave `client_i/` loaders; only parameter deltas and aggregate feature statistics cross. Client sampling (`fraction-train`), per-client validation metrics per round, and run history are all supported. Runs persist `metrics.jsonl` + `summary.json` + `global_model.npz` and are controllable via `/fl/start`, `/fl/stop`, `/fl/status`, `/fl/runs`, `/fl/stream` (SSE).
- **Calibration & scoring.** Post-hoc temperature scaling (`models/calibrate.py`) produces calibrated probabilities; the UI risk score is the **population percentile** of that probability (bands: ≥p95 high, ≥p75 medium), which is honest for a ~0.7% base-rate problem.
- **Privacy (Phase 4).** Per-client update clipping + Gaussian noise on the aggregate, epsilon via Opacus RDP accounting (`noise_for_target_epsilon` solves a target budget), pairwise-mask secure-aggregation **simulation** (labeled `simulated_pairwise_masks` in every event and the UI). Measured ε-vs-utility curve at `runs/privacy_tradeoff.json`.
- **Graph (Phase 5).** `graph/features.py` computes degree/PageRank features **per client partition** (each bank only sees its own subgraph); `graph/ingest.py` writes only pseudonymous IDs, model scores and aggregated transfer stats into Neo4j; Louvain community detection surfaces fraud-ring campaigns. Authenticated endpoints: `/api/risk-graph/overview|campaigns|campaign/:id|account/:pid/neighbors`.
- **Serving + UI (Phase 6).** `/predict` (with occlusion-based explanations), `/customers/.../sample`, `/citizen/{ref}`, `/fairness`, all proxied through `chatbot-backend` with JWT + role checks + consent enforcement + Mongo audit logging. Analyst pages: overview with same-class comparison bars, FL control with live convergence + run history + per-client metrics, interactive risk graph (campaign isolation, neighbor drill-down), fairness, audit log, customer investigation. Citizen pages: consent-gated risk profile, DPDP-style consent center with data export + erasure, risk-persona copilot.
- **VFL/PSI (Phase 7).** `vertical/psi.py` is a hashed Diffie–Hellman educational PSI simulation; `vertical/run_vfl_demo.py` aligns parties on shared record IDs and measures bank-only vs combined-feature AUC → `runs/vfl_demo/summary.json`.

## Live demo flow (mentoring session)

1. Start the stack: `docker compose up -d` → all six services healthy; `make health` returns 200×3.
2. Seed artifacts if `ml-fl-service/runs/` is empty: `docker compose run --rm ml-fl-service python -m experiments.seed_demo` (or locally: `.venv/bin/python -m experiments.seed_demo`). Writes baselines, `demo_fedprox` (default model), three DP tradeoff runs, VFL summary, and the Neo4j graph.
3. Log in at `localhost:3000/login` — two demo accounts are seeded automatically on server boot (disable with `SEED_DEMO_USERS=0`), and the login page has one-click buttons for both:
   - **Bank employee**: `analyst@arthsaathi.demo` / `Analyst@123` → lands on `/analyst`, scoped to institution 2.
   - **Citizen**: `citizen@arthsaathi.demo` / `Citizen@123` → lands on `/citizen`.
   You can also sign up manually (`/signup`) and pick "Bank employee" + an institution.
4. `/analyst/fl` → pick FedAvg/FedProx/FedAdam, toggle DP (fixed noise or target-ε), set client participation, start a run, and watch per-round PR-AUC converge against the isolated/pooled reference lines plus per-bank validation bars. Run history lists previous runs.
5. `/analyst/graph` → Neo4j risk rings (only pseudonymous IDs) clustered by detected community; click a campaign to isolate its subgraph, click a node for its derived neighbors, or ask the analyst copilot.
6. `/analyst/fairness` → per-institution PR-AUC / false-positive-rate spread (operational fairness — PaySim has no demographics).
7. `/analyst/customers/[id]` → per-account score, occlusion feature contributions, graph neighbours, recommended action.
8. `/analyst/audit` → the MongoDB audit trail: every FL run, prediction, consent change, export and erasure with actor, role and institution.
9. Open the citizen side with the seeded `citizen@arthsaathi.demo` login → `/citizen` shows a plain-language risk gauge and explanations; `/citizen/consent` exercises purpose toggles (revoking risk scoring immediately pauses scoring), data export, and erasure requests (DPDP); `/chat?mode=risk_citizen` talks to the citizen copilot.
10. Judges' verification: `curl localhost:5001/api/fl/runs` without a token → 401; `curl localhost:8000/datasets` → partition metadata; `runs/` JSON files reproduce every headline number; `make test` runs the Python suite and `cd server && npm test` runs the API contract tests against the live stack.

## Honest limitations

- PaySim is **synthetic** mobile-money data; it is nearly separable given the right features, so the isolated-vs-centralized gap is small by construction. Post-transaction balance fields (`newbalance*`, `*_delta`, `*_zero_*`) are excluded from the model as leakage; the demo model uses only pre-transaction observables plus per-client graph features (degree/PageRank computed inside each bank's partition).
- The headline comparison is now **same-class**: isolated MLP 0.656 → federated FedProx 0.684 → pooled MLP 0.772 (PR-AUC), so the collaboration story is honest within one model family. XGBoost (0.997) is reported only as a theoretical pooled ceiling — it is not the FL model class.
- FedAdam converges slower at 8 rounds (0.353 PR-AUC) than FedProx — a real, reproducible property of the ladder at this horizon, not a bug; longer budgets change the ordering.
- The displayed risk score is a **population percentile**, not a probability; calibrated probabilities are reported alongside. With pos_weight training, raw probabilities overstate the ~0.7% base rate, so operational bands are percentile-based.
- Secure aggregation is a **simulation** of pairwise masking, not production SecAgg. DP numbers are real Opacus RDP accounting, but with only 5 institutions strong ε destroys utility — the tradeoff chart is the honest result.
- The VFL demo is a benchmark: PSI alignment + a pooled logistic model on aligned features. It is not end-to-end split learning.
- Neo4j contains only derived, pseudonymised intelligence; `ARTH_DATA_HASH_KEY` must be a private stable secret before any real deployment.

## Requirements

- Docker Desktop with Compose, or Node.js 20+ and Python 3.11+
- MongoDB Atlas/local MongoDB
- Neo4j local/Aura
- API keys used by the existing copilot features

## Environment

Copy the templates and replace every placeholder. Never commit `.env` files.

```bash
cp server/.env.example server/.env
cp chatbot-backend/.env.example chatbot-backend/.env
cp client/.env.example client/.env
cp ml-fl-service/.env.example ml-fl-service/.env
```

`JWT_SECRET` MUST match between `server` and `chatbot-backend`. `NODE_INTERNAL_TOKEN` MUST match across `server`, `chatbot-backend`, and `ml-fl-service`.

## Run with Docker

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
make health
```

Open `http://localhost:3000`. Service health endpoints:

- `http://localhost:5001/health`
- `http://localhost:5002/api/health`
- `http://localhost:8000/health`

## Run services directly

```bash
cd server && npm ci && npm run dev
cd chatbot-backend && npm ci && npm run dev
cd client && npm ci && npm run dev
cd ml-fl-service && python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app:app --reload --port 8000
```

## Phase 1 data pipeline

From `ml-fl-service`, use Python 3.11 or activate the service virtual environment first. The primary download is approximately 276 MiB; generated processed and partition files require additional disk space.

```bash
source .venv/bin/activate
python -m data.download --only paysim_banks
python -m data.features paysim_banks
python -m data.partition --dataset paysim_banks --clients 5 --mode hfl --seed 42
python -m data.validate --dataset paysim_banks --clients 5
```

Equivalent root commands are `make data`, `make partitions`, and `make validate-data`. To prepare Give Me Some Credit as a secondary credit-default dataset, configure Kaggle credentials and run:

```bash
python -m data.download --only gmsc
python -m data.features gmsc
python -m data.partition --dataset gmsc --clients 5 --mode hfl --seed 42
```

`ARTH_DATA_HASH_KEY` should be a stable secret in deployments. Changing it requires regenerating all processed and partitioned artifacts.

## Python dependency groups

- `requirements.txt` — pinned ML/FL API runtime dependencies.
- `requirements.lock` — exact verified transitive runtime graph used by Docker.
- `requirements-data.txt` — optional Kaggle/Hugging Face download tooling.
- `requirements-augmentation.txt` — optional SDV/CTGAN tooling.
- `requirements-dev.txt` — local test and data-development tools.

The Docker image installs the official CPU-only PyTorch wheel. Do not replace it with the default Linux ARM wheel on Apple Silicon: that wheel can pull several gigabytes of unusable NVIDIA libraries.

## Verification

```bash
make test                     # 25 Python tests: data, metrics, DP, PSI, model, FL smoke, graph privacy, API
cd server && npm test         # live contract tests: auth, role guards, consent, export (needs the stack up)
cd client && npm run build    # production build of all 20 routes
docker compose config --quiet
```

The inherited frontend currently has legacy full-repository lint findings. Phase-specific TypeScript files have no ESLint errors, and the production Next.js build passes. With Docker Desktop running, `docker compose ps` should show all six services as healthy.

Non-breaking npm security updates have been applied. Remaining audit findings require breaking upgrades in inherited UI/mail/file-processing dependencies, and `xlsx` has no upstream fix. These are documented rather than hidden with `npm audit fix --force`.
