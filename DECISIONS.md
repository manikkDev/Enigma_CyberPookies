# Architecture decisions

## Phase 0

- MongoDB in `server` is the single application identity and compliance store. Direct local runs use the configured Atlas `DB_URI`. Compose defaults to its internal MongoDB for reproducible, offline-capable development; set `COMPOSE_DB_URI` to opt into Atlas explicitly.
- `server` issues JWTs and owns users. `chatbot-backend` verifies those JWTs using the same `JWT_SECRET`; its former Supabase user routes remain mounted only for backward compatibility and are no longer used by the frontend.
- `chatbot-backend` sends audit events to the authoritative `server` API instead of connecting to MongoDB directly.
- Neo4j remains a separate graph store. MongoDB stores users, consent history, and audit logs.
- Phase 0 creates a health-only FastAPI service and empty Flower applications. Data, model, and orchestration behavior begins in Phase 1 and Phase 3.
- Python 3.11 is the supported runtime. Docker supplies it even when the host Python is older.
- Containers use deterministic package-manager installs and run application processes as non-root users. The Compose production stack has been verified with all six services healthy.
- The ML image uses PyTorch 2.7.1 from the official CPU wheel index. Apple Silicon Docker cannot use NVIDIA CUDA, so CUDA libraries are intentionally excluded. Flower is pinned to 1.20.0 to match the Message API in this plan.
- Python dependencies are separated into runtime, optional data-download, optional augmentation, and development groups. `requirements.lock` captures the exact verified runtime graph; heavyweight SDV/Kaggle/dataset tooling is not installed in the API image.
- Non-breaking Node security updates were applied. Remaining audit findings require breaking framework/component upgrades or have no upstream fix (`xlsx`); they are not bypassed with `npm audit fix --force` and must be addressed during the legacy-dependency cleanup.

## Phase 1

- The primary Phase 1 dataset is `flwrlabs/fed-fraud-paysim-banks` at a recorded Hugging Face commit. PaySim is synthetic transaction data calibrated from aggregated real mobile-money patterns; it must never be described as raw real customer data. Give Me Some Credit remains an optional second dataset requiring Kaggle credentials.
- The source dataset's official test split is retained as the global test set. It is never augmented. This is safer and more reproducible than combining all rows and creating another random test split.
- Raw `nameOrig`, `nameDest`, `BankID`, and `isFlaggedFraud` values are excluded from processed and partitioned files. Account identifiers become stable keyed BLAKE2b pseudonyms; `isFlaggedFraud` is excluded as a target-proxy feature.
- `ARTH_DATA_HASH_KEY` controls pseudonymisation. The code has a public-demo fallback only for reproducibility; deployments must configure a stable secret value and must not rotate it after producing partitions unless all derived artifacts are rebuilt.
- PaySim's natural `BankID` assignment defines the five HFL institutions. Validation assignment is deterministic and customer-grouped, preventing the same customer from appearing in both local train and validation splits.
- Source-train and source-test identities occupy disjoint `record_id` ranges. Each client's test split is its institution-scoped subset of the official global test and the five client test splits exactly cover that global set.
- Velocity features are causal: they use only prior transactions in the preceding 24 PaySim steps and exclude the current transaction and all same-step transactions. Feature generation is shard-local, so it may omit history crossing source shard boundaries but cannot leak future or test information.
- Synthetic augmentation is opt-in and restricted to client `train.parquet`. Generated rows are explicitly marked `is_synthetic=1`; validation and test validation rejects synthetic rows.
- `make data` intentionally downloads only the credential-free primary PaySim dataset. GMSC is available through `python -m data.download --only gmsc` when Kaggle credentials are configured.

## Phases 2–7

- The deployable model family for federated training is a torch `RiskMLP(48,24)` trained with a synchronous runner in `arth_fl/federated.py`. The Flower Message API differs in pinned Flower 1.20, so the production demo path is the synchronous runner; Flower apps remain as scaffolds.
- FedProx is implemented as a true proximal term — `(μ/2)·‖θ−θ_global‖²` inside each client's local loss — not post-hoc weight shrinkage. FedAdam applies an Adam-style adaptive update on the server aggregate (`server-lr` 0.05; at 8 rounds it converges slower than FedProx, which is a real property, not a defect).
- Baselines now include **same-class** comparisons: pooled `RiskMLP` and per-bank `RiskMLP` trained through the identical routine as federated clients. The honest ordering `isolated_mlp (0.656) < FedProx (0.684) < centralized_mlp (0.772)` is what the UI comparison bars show; the XGBoost 0.997 is labeled as a theoretical pooled ceiling only.
- PaySim post-transaction balance fields (`newbalanceOrig`, `newbalanceDest`, `orig_delta`, `dest_delta`, `orig_zero_after`, `dest_zero_before`) are excluded from model features: the simulator's balance bookkeeping nearly encodes the fraud label, making every baseline trivially perfect. The model uses only pre-transaction observables plus per-client graph features.
- `graph/features.py` computes `dest_in_degree`, `dest_out_degree`, `orig_pagerank` **inside each client partition** — each bank only derives graph statistics from its own transactions, preserving the FL premise.
- Scores are shown as **population percentiles** of the temperature-calibrated probability (stored `score_quantiles` in `global_model.npz`), with bands at p75/p95. Raw pos-weight-trained probabilities would sit far above the ~0.7% base rate and make every transaction look extreme; the percentile display is the honest operational semantics.
- Baseline sampling keeps all fraud positives and caps negatives; evaluation reports the sampled positive rate. Centralized training uses the union of the same per-client samples as isolated training so the comparison is budget-fair.
- `runs/default_run.txt` names the model used for inference so "latest" never resolves to a deliberately degraded DP experiment run.
- DP is applied at the institution-update level: per-client L2 clipping (norm 2.0) plus Gaussian noise on the aggregate, with Opacus RDP epsilon accounting. `noise_for_target_epsilon` solves the noise multiplier for a requested ε budget. With five clients, strong epsilon destroys utility; `runs/privacy_tradeoff.json` reports the measured curve rather than a synthetic one.
- Secure aggregation is a pairwise-mask simulation and is labeled `simulated_pairwise_masks` in every run event and the UI; it is not presented as production SecAgg.
- Consent is **enforced**, not just persisted: revoking `risk_scoring` makes the citizen scoring endpoint return `scoring_disabled` before any model call, and the withdrawal is audited. Export (`GET /api/consent/export`) returns purposes, consent history and the subject's audit trail; erasure creates an auditable ticket.
- Every sensitive action is audited in MongoDB (`fl.start`, `fl.stop`, `predict`, `consent.*`, `data.export`, `data.erase_request`, `citizen.view_blocked`, `graph.seed`) and is visible to analysts at `/analyst/audit`.
- The copilot modes `risk_analyst`/`risk_citizen` inject live run/metric context (`chatbot-backend/src/helpers/riskContext.js`) so the assistant quotes real artifacts; both are reachable via `?mode=` deep links from the dashboards.
- Graph ingestion writes only pseudonymous IDs, model risk scores/bands, and aggregated edge statistics. Community detection uses NetworkX Louvain; no raw identifiers, names, or balances enter Neo4j.
- The VFL showcase uses hashed Diffie–Hellman PSI (educational simulation) to align shared record IDs, then a pooled logistic model on vertically partitioned feature groups to measure the bank-only vs combined AUC gain.
- Explainability uses feature occlusion (score delta when each standardized feature is neutralized), which is model-agnostic and valid for the MLP; it is presented as SHAP-style perturbation contributions, not exact SHAP values.
