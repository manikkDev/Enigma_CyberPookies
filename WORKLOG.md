# WORKLOG — Arth Saathi completion sprint

Living context file. Updated at every milestone. Read this first when resuming.

## Stack

- `client/` Next.js :3000 · `chatbot-backend/` Express :5001 · `server/` Express+Mongo+Neo4j :5002 · `ml-fl-service/` FastAPI :8000 · mongo :27017 · neo4j :7474/7687
- `docker compose up -d` — all six healthy. Compose pinned to **local mongo** (`mongodb://mongo:27017/arth_saathi`).
- Demo logins: `analyst@arthsaathi.demo` / `Analyst@123` (Bank 2 analyst) · `citizen@arthsaathi.demo` / `Citizen@123`
- Python venv for local runs: `ml-fl-service/.venv/bin/python` (xgboost, networkx installed; torch CPU pending local check)
- Runs/data are bind-mounted into the ml-fl-service container → seed locally, container reads artifacts.

## Locked decisions (this sprint)

- FL engine = **synchronous runner** (`arth_fl/federated.py`); Flower files are documented scaffolds.
- Model = torch `RiskMLP` (48,24), real FedProx proximal term, FedAdam server-side option.
- Full retrain approved — headline metrics will change and be re-recorded.

## Verified metrics (BEFORE this sprint — superseded once reseeded)

- XGB centralized PR-AUC 0.9974 · isolated mean 0.9966 · federated sklearn-MLP 0.7593 / ROC 0.9933
- DP curve: no-DP 0.76 → σ0.3/ε106→0.63 → σ0.45/ε49→0.54 → σ0.6/ε32→0.15 → σ2.0/ε6.6→0.01
- VFL/PSI: bank-only 0.970 → combined 0.988 · Graph: 23,889 accts, 12k edges, 25 campaigns

## Key files

- `ml-fl-service/arth_fl/federated.py` — FL engine (`run_federated`, `FederatedJobs`)
- `ml-fl-service/models/common.py` — `MODEL_NUMERIC` (leakage-cleaned), `frame_to_matrix`, `sample_frame`
- `ml-fl-service/models/inference.py` — npz load + occlusion explain
- `ml-fl-service/app.py` — FastAPI; `default_run.txt` resolves "latest"
- `ml-fl-service/graph/ingest.py` — pseudonymised Neo4j ingest + Louvain + campaigns
- `server/src/routes/consentRoutes.js` `graph.js` `auditRoutes.js` `flProgress.js`
- `chatbot-backend/src/routes/flRoutes.js` + `helpers/mlClient.js` + `prompts/copilotPrompt.js` (risk modes wired)
- `client/src/lib/api.ts`, `client/src/app/{analyst,citizen}/…`, `components/risk/RiskShell.jsx`

## Done

- (prior commits) data pipeline, baselines, FL engine, DP, graph, VFL, fairness, consent UI, demo users, one-click login

## In progress

- (sprint in progress — see plan `/Users/manik/.devin/plans/plan-dd91669903f842af.md`)
