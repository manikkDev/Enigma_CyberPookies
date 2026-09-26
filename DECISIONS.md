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
