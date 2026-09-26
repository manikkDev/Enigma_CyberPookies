# Architecture decisions

## Phase 0

- MongoDB in `server` is the single application identity and compliance store. The configured Atlas `DB_URI` is used when present; the Compose Mongo service remains a local fallback.
- `server` issues JWTs and owns users. `chatbot-backend` verifies those JWTs using the same `JWT_SECRET`; its former Supabase user routes remain mounted only for backward compatibility and are no longer used by the frontend.
- `chatbot-backend` sends audit events to the authoritative `server` API instead of connecting to MongoDB directly.
- Neo4j remains a separate graph store. MongoDB stores users, consent history, and audit logs.
- Phase 0 creates a health-only FastAPI service and empty Flower applications. Data, model, and orchestration behavior begins in Phase 1 and Phase 3.
- Python 3.11 is the supported runtime. Docker supplies it even when the host Python is older.
