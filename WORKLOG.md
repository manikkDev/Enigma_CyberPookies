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

- FL engine = **Flower 1.20 real path** (`arth_fl/{client_app,server_app}.py`, `simulate.py`,
  `flower_runner.py`); the in-process runner remains as a labeled dev engine.
  `/fl/start` takes `engine: "flower"|"local"`. Flower needs a space-free
  interpreter: `FLOWER_PYTHON=/Users/manik/arth_link/flvenv/bin/python`
  (Ray can't spawn workers under "~/Web Projects/").
- Model = `ResidualRiskNet` (`residual_mlp_v1`) — promoted run
  `flwr_residual_v1` (`runs/default_run.txt`). `legacy_mlp_v1` still loads.
- Score display = **population percentile** of calibrated probability (bands p75/p95).
- Same-class baselines are the honest comparison; XGBoost/LightGBM pooled are
  labeled non-deployable ceilings.
- Evaluation: federated val per round; untouched natural-prevalence test once
  post-training; ECE-gated temperature calibration. No bare "accuracy" claims.

## Current verified metrics (runs/, leak-free features, natural-prevalence test n=636,262, prevalence 0.129%)

- **Promoted: `flwr_residual_v1`** — real Flower 5-client, 25 rounds, SecAgg+
  masked aggregation, FedProx μ=0.01, residual MLP:
  test PR-AUC **0.6582**, ROC-AUC 0.9879, recall@P≥90% 0.487, ECE 0.0044.
- Same-class ladder: isolated MLP mean **0.4753** → federated **0.6582**
  → pooled MLP reference **0.6385** (federated edged past pooled — more data
  seen per client across 25 rounds).
- Ceilings (non-deployable): pooled XGBoost **0.9604** PR-AUC, LightGBM 0.4074,
  logistic 0.3915; isolated XGBoost mean 0.9174 (trees dominate tabular —
  honest framing, do not hide).
- VFL split-NN (`runs/vfl_demo`): bank-only PR-AUC 0.055 → split-NN **0.215**
  (+0.160); pooled reference 0.427; 0 raw features exchanged, 0 labels shared.
- `baselines_paysim_banks.json` regenerated leak-free (old leaked file kept as
  `baselines_paysim_banks_legacy_leaked.json`).

## Session 2 additions (post-audit rebuild)

- Copilot: typed tool layer (`copilotTools.js`) — 9 analyst + 3 citizen tools,
  evidence IDs + citations, deterministic fallback, `draft_case_note`,
  streaming/non-streaming parity, institution scoping. 18 copilot tests incl.
  prompt-injection suite (`test/promptInjection.test.mjs`).
- Legacy threat-intel copilot modes removed from the product surface
  (`riskMode.js` only allows the caller's role mode).
- Graph: snapshot provenance (`snapshot_id`, `model_run_id`, time buckets),
  PageRank stored, auth-protected routes, institution scoping,
  fetch-based SSE (EventSource can't send auth headers).
- Auth: invite-only analyst signup (`ANALYST_INVITE_CODE` env + institution id,
  timing-safe compare); rate limiting (`express-rate-limit` — auth 30/15min,
  API 1200/15min, writes 200/15min).
- Erasure lifecycle: real `ErasureRequest` — revokes all purposes, deletes
  conversations, pseudonymises account, blocks login + live JWTs.
  `GET /api/consent/erase-request/:ticketId` for status.
- Frontend: strict lint+typecheck on builds (all ignore flags removed);
  glossary `Term` tooltips on analyst pages; VFL showcase on FL page;
  erasure steps surfaced in consent UI; stats updated to verified numbers.

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
- Tests: 26 Python pass · 18 chatbot tests pass (risk modes + copilot tools + prompt injection) · 8 Node contract tests pass (`server npm test`, needs live stack) · strict `next build` (lint+typecheck) clean

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
- SecAgg+ is REAL on the Flower engine (verified masked-vector aggregation over
  isolated Ray actors); the in-process `local` engine still uses simulated
  pairwise masks and is labeled as such in the UI.
- VFL is a real educational split-NN (bottom nets + top net, embeddings-only
  boundary) running single-process — labeled as a simulation of party isolation.
- PSI remains an educational hashed-DH simulation.
- `server/test/` needs the live stack + seeded demo users.
- Legacy routes `/alerts` `/cases` `/feeds` `/analyze` redirect to `/analyst`.
- Baselines & local MLP training need `KMP_DUPLICATE_LIB_OK=TRUE` +
  `torch.set_num_threads(1)` on macOS (xgboost/sklearn OpenMP deadlocks torch
  kernels — fixed in `models/baselines.py`).

## Session 3 polish (final)

- Chat suggestions replaced with role-aware risk prompts
  (`client/src/services/suggestions/riskSuggestions.js`); generic data.json no
  longer used by the copilot. Empty-state now shows clickable starter prompts.
- Removed legacy post-chat `/api/gemini/charts` call (wrong host + ungrounded
  freeform chart generation — inappropriate for an evidence-cited copilot).
- `output: 'standalone'` gotcha found: `next start` mis-serves; production
  server is `node .next/standalone/server.js` (README documents the copy step).
- Playwright browser pass: login → analyst dashboard (live promoted metrics,
  institution-scoped pseudonymous queue) → copilot answered with grounded
  run-cited metrics and zero console errors.

## Next steps (if resumed)

- Optional: SSE on FL page instead of 1.5s polling (`api.fl.stream` exists).
- Rotate `ARTH_DATA_HASH_KEY`, `ANALYST_INVITE_CODE`, JWT secret + `.env`
  secrets before any real deployment.
- NOT DEPLOYED — awaiting explicit user approval.
