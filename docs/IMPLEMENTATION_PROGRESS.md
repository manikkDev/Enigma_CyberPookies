# Implementation Progress Ledger

Live state tracker for the Arth Saathi rebuild. Update this file as work lands so a
fresh session can resume without re-auditing. Master plan:
`docs/COMPREHENSIVE_IMPLEMENTATION_PLAN.md`; decisions in `DECISIONS.md`.

## Environment facts

- Repo root: `/Users/manik/Web Projects/Enigma_CyberPookies/arth-saathi`
- ML env: `ml-fl-service/.venv` (Python 3.9.6). flwr 1.20.0 + ray 2.31.0 +
  lightgbm 4.6.0 installed 2025-session. Run everything with `.venv/bin/python`.
- Partitions: `ml-fl-service/data/partitions/paysim_banks/hfl_5/client_{0..4}/`
  (`train|val|test.parquet`), plus shared `test.parquet`, `meta.json`.
- Graph features were REGENERATED leak-free (validation uses train-only history;
  test uses train+val history; Neo4j ingest uniform, label-blind).
- Demo creds: analyst@arthsaathi.demo / Analyst@123 (institution 2),
  citizen@arthsaathi.demo / Citizen@123.

## Verified state

- Python tests: **26 passed** (after `orig_pagerank` optional-column fix in
  `graph/ingest.py` — `test_graph_privacy` green).
- Chatbot: 10 passed (riskMode + copilotTools suites).
- **Frontend production build PASSES with strict lint + typecheck**
  (`eslint.ignoreDuringBuilds:false`, `typescript.ignoreBuildErrors:false` in
  `next.config.js` — warnings only, zero errors, 20 routes).
  Fixed en route: conditional hooks in `excalidraw-viewer.tsx`, `any`→`unknown`
  sanitizers, Google Identity types, null-safe Excalidraw/panzoom refs, deleted
  dead `app/api/feeds/route.ts`.
- Old artifacts (do NOT overwrite): `ml-fl-service/runs/demo_fedprox`,
  `baselines_paysim_banks.json`, `privacy_tradeoff.json`, `vfl_demo`.
  Reported numbers pre-regen: FedProx PR-AUC 0.6843, isolated 0.6562,
  pooled MLP 0.7723, pooled XGBoost 0.9973 (centralized upper bound only).

## Done so far

- Phase 0 truthfulness: random chatbot scores removed; web copy corrected;
  risk modes isolated from unrelated enrichment.
- Auth: public signup citizen-only; analyst self-assign blocked (server + UI +
  Google onboarding). Server test covers it.
- Consent: unset `risk_scoring` now blocks scoring (was only blocking revoked).
- ML gateway: role-scoped routes; analyst institution scope enforced; citizen
  self-score separate path. Exact-customer endpoint added; UI fallback to
  `rows[0]` removed.
- Graph: neighbor route institution-scoped; raw identifiers removed from
  ingest payload and tests; `graph/features.py` rewritten leakage-safe.
- Chatbot: `riskMode` role-aware + tests; Mongo-backed conversation store
  (`server` owns `ChatConversation` + `/api/conversations`), chatbot calls it
  via internal token; Supabase no longer required at startup.
- Evaluation: round metrics now on federated validation; untouched
  natural-prevalence test evaluated once post-training; uniform sampling;
  calibration accepted only if it lowers held-out ECE.
- Model: `ResidualRiskNet` (`residual_mlp_v1`) added alongside `legacy_mlp_v1`;
  npz artifacts record `model_architecture` for backward-compatible loading.

## In progress

- Nothing currently running in background.

## Real FL production run — DONE

- `runs/flwr_residual_v1/`: **25-round, 5-client Flower run, REAL SecAgg+**
  (masked vectors, zero raw exchange), FedProx, `residual_mlp_v1`, 192 s.
- `arth_fl.finalize flwr_residual_v1` on untouched official test
  (n=636,262, prevalence 0.129%): **PR-AUC 0.6582, ROC-AUC 0.9879,
  recall@P≥0.90 = 0.487, ECE 0.0044, Brier 0.0027**.
- `summary.json` + `metrics.jsonl` + `global_model.npz` carry provenance.
- This is the current PROMOTED candidate artifact for inference.

## Graph hardening — DONE

- `graph/ingest.py`: per-snapshot tagging (`snapshot_id`, `model_run_id`,
  `time_bucket`), stores `orig_pagerank` (optional column — absent columns
  skipped, never synthesized), label-blind uniform sampling.
- `server/src/routes/graph.js`: legacy `/api/graph*` routes now auth-protected;
  `/api/risk-graph/*` analyst/admin-only + institution-scoped (admin bypass);
  snapshot metadata endpoint added.
- `client/src/components/NetworkGraph.jsx`: replaced `EventSource` with
  fetch-based SSE so bearer headers are sent; `app/graph/page.jsx` auth-wrapped.
- Analyst graph UI surfaces snapshot provenance.

## VFL split-NN — DONE

- `vertical/splitnn.py`: real educational split neural network — per-party
  bottom nets, top net on label holder, ONLY embeddings + embedding grads cross
  boundaries (ledgered); single-process simulation (labeled as such).
- Verified `runs/vfl_demo/summary.json`: aligned_n 23,333; bank-only
  ROC-AUC 0.965 / PR-AUC 0.055 → VFL ROC-AUC 0.996 / PR-AUC 0.215 (+0.160);
  centralized pooled reference (non-deployable) PR-AUC 0.427; raw features
  exchanged: 0, labels shared with feature parties: 0.

## Copilot tool layer — DONE

- `chatbot-backend/src/helpers/copilotTools.js`: typed deterministic tool layer.
  Intent routing → authorized tools (analyst: model_summary, run_progress,
  privacy_report, risk_queue, customer_case, campaigns, account_neighborhood,
  fairness_report, dp_tradeoff; citizen: my_score, consent_status, rights_request).
  Each result carries `evidence_id`/`ok`/`summary`/`data`. Deterministic fallback
  (`deterministicFallback`) grounds replies when the LLM is unavailable.
- Both chat handlers (streaming + non-streaming) execute tools, inject a
  "TOOL EVIDENCE" block (framed as data-not-instructions), emit an `evidence`
  SSE event, and persist `toolEvidence` on the assistant message.
- `copilotPrompt.js`: `<evidence_rules>` block — numeric claims must come from
  evidence/context, cite `[evidence_id]`, per-persona `<tool_scope>`.
- Client: SSE `evidence` event consumed in `chat/page.jsx`; `toolEvidence` field
  on `Message` rendered as a "Verified platform evidence" strip in
  `chat-message.tsx` (green = ok, amber = tool error).
- Tests: `test/copilotTools.test.mjs` — 7 tests (routing, ID extraction,
  citizen isolation, fallback grounding). `npm test` = 10/10 pass.
- Node `--check` clean on all chatbot-backend + server sources.

## Flower real-FL path — DONE & VERIFIED

- `arth_fl/{client_app,server_app}.py`: real Flower 1.20 ClientApp/ServerApp.
  Real SecAgg+ verified end-to-end (3 isolated Ray actors, masked vectors,
  weighted aggregate only). Smoke: `runs/flwr_smoke2` — 2 rounds, 0 failures.
- `arth_fl/stats.py` → `hfl_5/norm_stats.json` (sufficient stats only);
  clients + server standardize identically to `models.inference`.
- `arth_fl/finalize.py` → post-run test eval + temperature (ECE-gated) +
  quantiles; smoke artifact finalized: test PR-AUC 0.107 @ 0.129% prevalence
  (2-round/3-client smoke — not a headline number).
- `arth_fl/simulate.py`: driver = `flower-simulation` entrypoint; works around
  Ray's unquoted-exec worker spawn bug on space paths.
- `arth_fl/flower_runner.py`: API-facing subprocess jobs; `POST /fl/start` now
  takes `engine:"local"|"flower"`. **Requires `FLOWER_PYTHON` env pointing at a
  space-free interpreter** (Ray can't spawn workers under "~/Web Projects/").
  Working mirror: `/Users/manik/arth_link/flvenv` (cp -Rc clone of .venv).
- FedAdam auto-downgrades to FedAvg under SecAgg+; DP is client-side
  (clip+noise on delta, `dp_mode: client_side_gaussian`).

### Flower commands

```bash
# stats (once per partition layout)
.venv/bin/python -m arth_fl.stats --dataset paysim_banks --clients 5
# smoke (needs space-free python)
/Users/manik/arth_link/flvenv/bin/python -m arth_fl.simulate --app . \
  --num-supernodes 3 --run-config 'run-id="x" clients=3 num-server-rounds=2 \
  num-shares=3 reconstruction-threshold=2 \
  hfl-dir="data/partitions/paysim_banks/hfl_5" \
  norm-stats-file="data/partitions/paysim_banks/hfl_5/norm_stats.json"'
# finalize artifact for inference
.venv/bin/python -m arth_fl.finalize <run_id>
```

## Session 3 completions

- Baselines regenerated on leak-free features — `baselines_paysim_banks.json`
  refreshed (isolated XGB mean 0.9174, pooled XGB 0.9604, LightGBM 0.4074,
  logistic 0.3915, isolated MLP 0.4753, pooled MLP 0.6385; n=636,262 natural
  prevalence). Fixed two real bugs en route: macOS OpenMP deadlock
  (`torch.set_num_threads(1)` in `_mlp_fit`, `KMP_DUPLICATE_LIB_OK`) and
  lbfgs divergence under ~775:1 class weights (sqrt weighting + C=0.5).
- `flwr_residual_v1` promoted via `runs/default_run.txt` — inference +
  analyst UI now serve the real SecAgg+ artifact.
- Prompt-injection suite: `chatbot-backend/test/promptInjection.test.mjs`
  (8 tests — role escalation, forged evidence lines, legacy-mode lockout).
  `riskMode.js` now only permits the caller's own role mode.
- `draft_case_note` analyst tool: institution-scoped case + graph context,
  structured draft, evidence-cited. 18/18 chatbot tests pass.
- Invite-only analyst signup: `ANALYST_INVITE_CODE` env, timing-safe compare,
  institution id required; signup UI exposes "I have an invitation" flow.
  Verified live: wrong code 403, valid code creates scoped analyst.
- Rate limiting: `express-rate-limit` — auth 30/15min, API 1200/15min,
  writes 200/15min (`server/src/middleware/rateLimit.js`).
- Real erasure lifecycle: `ErasureRequest` model — revokes all purposes,
  deletes conversations, pseudonymises account, blocks login AND live JWTs
  (`erasedAt` checked in `protect`). Status endpoint + UI step display.
  Verified live end-to-end.
- Copilot verified live: analyst model summary cites `run:flwr_residual_v1`;
  citizen injection attempt refused; risk queue institution-scoped.
- Frontend: `Term` glossary tooltips (14 terms) on analyst pages; VFL
  split-NN showcase on `/analyst/fl`; stats strip updated to verified
  numbers; "Live" mock pulse → "Preview". Strict build passes.

## Pending (priority order)

1. ~~Baselines + promotion~~ DONE.
2. ~~Chatbot tools/citations/injection~~ DONE.
3. ~~Auth hardening (invite + rate limit)~~ DONE. Session-cookie migration
   deferred (Bearer tokens today; document before deploy).
4. ~~Erasure lifecycle~~ DONE. Training-eligibility: model_training consent
   is recorded; no personal-data training pipeline exists to enforce against
   — consent UI now states this explicitly.
5. ~~Frontend polish~~ DONE — role-aware suggestions, starter chips, dead
   charts call removed, standalone-server gotcha documented. Playwright
   browser pass verified login → analyst → copilot with grounded cited answer.
6. DONE — full stack live-verified (routes 200/307, copilot, graph, FL API).
   NOT DEPLOYED — awaiting explicit user approval.

## Key conventions

- Never raw rows across boundaries; coordinator sees ndarrays/metrics only.
- Synthetic PaySim — never call it real customer data.
- Numbers must cite run_id + evaluation split; no bare "accuracy" claims.
- New artifacts go to new run dirs; never overwrite `runs/demo_*`.
