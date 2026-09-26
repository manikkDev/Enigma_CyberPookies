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

The configured MongoDB Atlas URI is used by `server` when present. Docker Compose still starts local MongoDB as a development fallback.

## Phase 0 status

Phase 0 provides:

- A Python 3.11 FastAPI/Flower project scaffold and `/health` endpoint.
- Dockerfiles, Docker Compose orchestration, health checks, and Make targets.
- MongoDB JWT identity with `citizen`, `analyst`, and `admin` roles.
- Institution-scoped analysts (`institutionId` 0–4) and pseudonymous citizen references.
- Purpose-level consent history, erasure requests, and audit records.
- Authenticated FL proxy routes and Socket.IO FL progress rooms.
- Role-aware signup and protected citizen/analyst route scaffolds.

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

## Verification

```bash
cd ml-fl-service && .venv/bin/pytest -q
cd ../client && npm run build
cd .. && docker compose config --quiet
```

The inherited frontend currently has legacy full-repository lint findings. Phase-specific TypeScript files have no ESLint errors, and the production Next.js build passes. Docker runtime health still requires Docker Desktop to be running.
