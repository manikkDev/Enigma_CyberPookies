# WORKLOG — Arth Saathi completion sprint

Living context file. Updated at every milestone. Read this first when resuming.

## Stack

- `client/` Next.js :3000 · `chatbot-backend/` Express :5001 · `server/` Express+Mongo+Neo4j :5002 · `ml-fl-service/` FastAPI :8000 · mongo :27017 · neo4j :7474/7687
- `docker compose up -d` — all six healthy. Compose pinned to **local mongo** (`mongodb://mongo:27017/arth_saathi`); `MONGO_URI=""` in compose wins over `.env` Atlas value.
- Demo logins: `analyst@arthsaathi.demo` / `Analyst@123` (Bank 2 analyst) · `citizen@arthsaathi.demo` / `Citizen@123`. One-click cards on `/login`. Disable seeding: `SEED_DEMO_USERS=0`.
- Python venv for local runs: `ml-fl-service/.venv/bin/python` — Python 3.9, has torch 2.8.0 CPU, opacus, xgboost, networkx, pytest, pandas.
- `runs/` and `data/` are **bind-mounted** into ml-fl-service → seed locally, container reads artifacts. App code is **baked into images** → `docker compose build <svc>` after edits.
- Neo4j creds pinned in compose (`neo4j/password`) — `server/.env` had stale old-project creds, do not trust it.

## Locked decisions

- FL engine = **synchronous runner** (`arth_fl/federated.py`); Flower files are documented scaffolds.
- Model = torch `RiskMLP(48,24)` — real FedProx proximal term `(μ/2)‖θ−θ_g‖²`, FedAvg, FedAdam (server-lr 0.05).
- Score display = **population percentile** of calibrated probability (bands p75/p95); raw probs inflated by pos_weight=8.
- Same-class baselines (MLP pooled/per-bank) are the honest comparison; XGBoost labeled ceiling-only.

## Current verified metrics (runs/, all real artifacts)

- XGB pooled 0.9973 PR-AUC · XGB isolated mean 0.9963
- **Same-class**: isolated MLP 0.6562 → **FedProx 0.6843** → pooled MLP 0.7723
- Strategy ladder (8r): FedProx 0.684 > FedAvg 0.602 > FedAdam 0.353
- DP tradeoff: 0.684 → σ0.3/ε70.8→0.581 → σ0.45/ε39.5→0.332 → σ0.6/ε26.6→0.141 → σ2.0/ε6.0→0.013
- VFL/PSI: aligned 4662, bank-only 0.970 → combined 0.988 (+1.8pt)
- Graph: `demo_fedprox` re-ingested — 29,838 accounts, 15,000 edges, 25 campaigns, `raw_identifiers_written: False`
- `default_run.txt` = `demo_fedprox`

## Features completed this sprint

- `models/torch_mlp.py` (RiskMLP, pack/unpack state, `train_local` w/ proximal), `models/calibrate.py` (temperature), `graph/features.py` (per-client degree/PageRank)
- `federated.py`: fraction-train, per-client val metrics in round events, FedAdam server state, target-ε DP solve, quantile map for percentile scores
- `app.py`: 404s on missing runs/artifacts, `/privacy/epsilon` accepts `target_epsilon`
- `baselines.py`: `centralized_mlp` + `isolated_mlp_mean` same-class artifacts
- `experiments/fl_run.py` CLI + `run_matrix.py` + `report.py` + updated `seed_demo.py`
- Backend: consent enforcement (revoke `risk_scoring` → `scoring_disabled` before model call), `GET /api/consent/export`, audit wired everywhere (`fl.start/predict/consent.*/data.*/graph.seed/citizen.view_blocked`)
- `chatbot-backend/helpers/riskContext.js` injects live metrics into `risk_analyst`/`risk_citizen` copilot modes; `?mode=` deep links work; dropdown includes risk personas
- Frontend: analyst comparison bars, FL page (strategy selector incl. FedAdam, target-ε mode, clip slider, run history, per-client val bars, isolated/pooled reference lines), graph page (community-clustered layout, campaign isolation, neighbor drill-down, copilot link), `/analyst/audit` page, citizen gated state + facts card, consent export download + history, RiskShell nav + mode'd copilot links
- Makefile: `fl`, `fl-dp`, `graph-features`, `seed`, `experiments`, `test` all point at real modules
- Tests: 25 Python pass (`test_model`, `test_fl_smoke`, `test_graph_privacy`, extended `test_api` + existing data/dp/metrics/psi/augment) · 4 Node contract tests pass (`server npm test`, needs live stack)

## Commands

```bash
make test                                    # python suite
cd server && npm test                        # live contract tests (stack must be up)
cd client && npm run build
docker compose build ml-fl-service server chatbot-backend client && docker compose up -d
cd ml-fl-service && .venv/bin/python -m experiments.seed_demo   # reseed everything
```

## Known limitations / honest notes

- FedAdam < FedProx at 8 rounds — real property, mention if asked.
- DP at 5 institutions: ε<~30 collapses utility — this IS the finding, present it as such.
- SecureAgg = labeled simulation; PSI = educational simulation; VFL = benchmark not split learning.
- `server/test/` needs the live stack + seeded demo users.
- Legacy routes `/alerts` `/cases` `/feeds` `/analyze` redirect to `/analyst`.

## Next steps (if resumed)

- Optional: SSE on FL page instead of 1.5s polling (`api.fl.stream` exists).
- Optional: `demo_fedprox_graph` headline run naming (graph features already in the main run).
- Rotate `ARTH_DATA_HASH_KEY` + `.env` secrets before any real deployment.
