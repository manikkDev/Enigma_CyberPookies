# Arth Saathi — Comprehensive Audit and Production-Grade Implementation Plan

**Track:** FinTech  
**Problem statement:** Federated Learning for Cross-Institution Financial Risk Control  
**Document purpose:** agent-facing remediation and implementation plan for the existing repository  
**Status:** planning only; this document distinguishes verified code from demo scaffolding and future work

---

## 1. Executive conclusion

The repository contains a useful proof-of-concept skeleton, but it is **not yet a fully functional federated financial-risk platform**. The strongest completed parts are the PaySim data pipeline, a reproducible custom federated-training experiment, basic role-aware dashboards, MongoDB consent/audit records, and a pseudonymised Neo4j visualization.

Several headline claims currently exceed what the code proves:

1. The main training path is a custom in-process Python runner. It loads every institution's Parquet files into one process. This is algorithmic federation, not process- or institution-isolated federation.
2. Secure aggregation is a cancelling-mask simulation, not a production SecAgg protocol.
3. The VFL path performs PSI-like alignment and then trains a centrally pooled logistic-regression benchmark. It is not distributed split learning.
4. The citizen shown after signup is deterministically mapped to an arbitrary PaySim account. It is not an authenticated customer's financial record.
5. The Neo4j graph is built from a label-enriched sample of the test set and does not prove discovery of a genuine cross-institution ring.
6. The chatbot remains largely inherited from a broad cyber-threat assistant. Its conversation persistence is split between Mongo JWT identities and Supabase UUID records, and uploaded transaction rows receive random `sus_detection` values.
7. Consent is stored, but most purposes are not enforced. An unset risk-scoring consent currently permits scoring; erasure creates only a ticket.
8. The frontend build succeeds only because type checking and linting are skipped. There are no frontend or chatbot-backend automated tests.
9. Current reported model metrics are from class-enriched capped test samples. The current best federated artifact has PR-AUC 0.6843, while the same-class isolated mean is 0.6562 and pooled MLP is 0.7723. The 0.9973 XGBoost PR-AUC is a pooled, non-federated upper bound and must not be called federated accuracy.
10. The landing page contains hard-coded mock account/ring claims and incorrectly calls PaySim transactions “real.”

The correct next step is not to add more surface-level features. It is to make the privacy boundary, evaluation protocol, identity model, graph provenance, and chatbot tool access real and testable, then redesign the UI around that evidence.

---

## 2. Problem statement — precise interpretation

The project must demonstrate that multiple financial institutions can improve a risk decision without pooling raw customer data.

A convincing solution must prove all of the following:

- **Distributed information:** each institution controls its own rows or feature slice.
- **Useful collaboration:** a federated model or derived collaborative signal beats isolated institutional baselines on a held-out evaluation.
- **Privacy:** raw records do not cross boundaries; update visibility and leakage risks are addressed with an explicit threat model, secure aggregation, differential privacy, pseudonymisation, and access controls.
- **Responsible use:** consent, auditability, explainability, model limitations, fairness, human review, and data-subject rights are implemented rather than described only in copy.
- **Practicality:** the system has reproducible experiments, service health, failure handling, observability, deployment architecture, and a coherent workflow for bank staff and customers.

### 2.1 Use cases to lock

The product should focus on two related but distinct decisions:

1. **Primary demonstrator — cross-bank transaction-fraud risk (HFL):** five banks own different customers with the same feature schema and collaboratively train a fraud model.
2. **Differentiator — shared-customer default/financial-risk assessment (VFL):** a bank, insurer, and lending app own different columns for overlapping pseudonymous customers and train a split model after private entity alignment.

Do not blur these into one claim. PaySim supports transaction-fraud demonstration; it does not contain insurance claims or real lending-app spending histories. A VFL demonstration must use a suitable public dataset, a transparently constructed research partition, or a clearly labelled synthetic multi-party scenario.

### 2.2 Success metrics

“Highest accuracy” is not an acceptable objective for a roughly 0.1–0.7% fraud event rate. A model predicting every transaction as legitimate can exceed 99% accuracy while detecting no fraud.

Use this metric hierarchy:

- Primary: **PR-AUC** on the untouched natural-prevalence test set.
- Operational: recall at fixed precision (90% and 95%), precision at a fixed review capacity, false positives per 10,000 transactions, expected cost saved, and alert volume.
- Secondary: ROC-AUC, F1 at a validation-selected threshold, Brier score, log loss, ECE, and calibration slope/intercept.
- Federated value: improvement over a same-model-class isolated baseline and percentage of the isolated-to-pooled gap recovered.
- Privacy/utility: PR-AUC and operational recall plotted against epsilon, clipping norm, participation rate, and SecAgg status.
- Robustness: per-institution metrics, worst-institution metric, variance, temporal stability, seed confidence intervals, and client-dropout tolerance.

No metric may be displayed without dataset version, split, sample count, event prevalence, run ID, model version, and evaluation timestamp.

---

## 3. Verified current state

### 3.1 What genuinely works

- Next.js production compilation completes for 20 routes.
- Python test suite passes: 25 tests.
- PaySim download, provenance, pseudonymisation, feature engineering, natural five-bank partitioning, and validation reports exist locally.
- A custom synchronous FedAvg/FedProx/FedAdam runner produces model and metric artifacts.
- FastAPI provides run control, status, summary, scoring, citizen demo profile, fairness, and graph-seeding endpoints.
- MongoDB JWT login, roles, consent history, audit records, and basic role guards are present.
- Analyst overview, FL control, graph, fairness, customer, audit, citizen profile, and consent pages call live APIs.
- Neo4j receives pseudonymous identifiers and derived attributes rather than raw PaySim source account IDs.
- Risk chatbot modes inject selected live metrics into a system prompt.

### 3.2 Current measured artifacts and where accuracy is visible

Current local artifacts are under `ml-fl-service/runs/`:

| Artifact | Current result | Interpretation |
|---|---:|---|
| Pooled XGBoost PR-AUC | 0.9973 | Centralized upper bound; not federated |
| Isolated XGBoost mean PR-AUC | 0.9963 | Shows PaySim is nearly separable for trees; poor collaboration story |
| Pooled MLP PR-AUC | 0.7723 | Same-class centralized reference |
| Isolated MLP mean PR-AUC | 0.6562 | Same-class local baseline |
| FedProx PR-AUC | 0.6843 | Best seeded federated demo artifact |
| FedAvg PR-AUC | 0.6023 | Seeded eight-round run |
| FedAdam PR-AUC | 0.3527 | Under-tuned seeded eight-round run |
| VFL bank-only ROC-AUC | 0.9697 | Central benchmark after artificial feature split |
| VFL combined ROC-AUC | 0.9879 | Central benchmark, not split learning |

The current UI displays metrics on `/analyst` and `/analyst/fl`. Raw artifacts are in:

- `ml-fl-service/runs/baselines_paysim_banks.json`
- `ml-fl-service/runs/<run_id>/summary.json`
- `ml-fl-service/runs/<run_id>/metrics.jsonl`
- `ml-fl-service/runs/privacy_tradeoff.json`
- `ml-fl-service/runs/vfl_demo/summary.json`

These numbers must be re-run after fixing the evaluation protocol. They currently use class-enriched capped samples, so they are not final headline numbers.

---

## 4. Detailed gap register

Legend:

- **P0:** claim-invalidating, security-critical, or blocks an end-to-end trustworthy demo.
- **P1:** required for a professional prototype.
- **P2:** differentiator or production hardening after the core is sound.

### 4.1 Federated-learning and privacy gaps

| Priority | Gap | Evidence/impact | Required resolution |
|---|---|---|---|
| P0 | Aggregator process reads all bank Parquet files | `run_federated` loads every `client_i` frame in one Python process | Run each institution as an isolated client process/container with only its mounted partition; aggregator must have no data volume access |
| P0 | Main path is not the documented Flower application | Flower files are scaffolds; custom synchronous runner is the live path | Adopt one supported Flower version and implement the live path with ServerApp/ClientApp or document another framework; remove dead dual architecture |
| P0 | SecAgg is simulated | Random pairwise masks are generated centrally and cancel in memory | Integrate Flower SecAgg+ or another reviewed protocol, include dropout handling and an integration test proving the server cannot inspect individual updates |
| P0 | Test set evaluated every round | Repeated test observation can drive run selection and leaks evaluation information | Use aggregated client validation for round monitoring; evaluate untouched global test once after configuration is frozen |
| P0 | Evaluation changes class prevalence | `sample_frame` keeps all positives and caps negatives; PR-AUC, F1, Brier, and ECE are affected | Evaluate on full official test at natural prevalence; if subsampling is necessary, use weights and report both natural and sampled prevalence |
| P0 | Federated preprocessing summaries are visible and not protected | Counts, sums, and sum-squares are centrally aggregated even in non-private runs | Use SecAgg for preprocessing statistics, robust quantile/sketch alternatives, and optional DP; document leakage budget |
| P0 | DP claim lacks a precise threat model | Current client-level central DP has very high epsilon or destroys utility | Define adjacency (institution or person), trusted/untrusted aggregator, clipping unit, accountant assumptions, and target epsilon before optimization |
| P1 | In-memory job manager is non-durable | Restart loses active job state; concurrent starts are unbounded | Add persistent run/job store, idempotency keys, concurrency limit, cancellation state, heartbeat, timeout, and recovery |
| P1 | Run IDs/config are weakly validated | Strategy/dataset combinations and arbitrary IDs can fail late | Strict enums, safe run-ID regex, immutable configuration schema, duplicate-run rejection, and API error contracts |
| P1 | No client authentication/attestation | Any simulated client/update source is trusted | Issue per-institution credentials, mTLS or signed messages, allow-list client IDs, and record update provenance |
| P1 | No poisoning/Byzantine robustness | One client can submit extreme updates | Add update norm/anomaly monitoring and evaluate trimmed mean/median/Krum only as explicit adversarial experiments |
| P2 | No communication/computation evidence | Practicality is asserted without bytes, round time, CPU, or failures | Record per-round bytes, duration, client participation, failures, retries, and model size |

### 4.2 ML, data, and evaluation gaps

| Priority | Gap | Impact | Required resolution |
|---|---|---|---|
| P0 | PaySim is described as real in the landing page | Misrepresents synthetic data | Replace every claim with “synthetic PaySim transactions calibrated from aggregated real mobile-money patterns” |
| P0 | Graph and dashboard artifacts use test labels for sampling | Graph ingest deliberately includes every true fraud row, creating label leakage and an unrealistically rich graph | Build graph from training/stream history without target-aware selection; score future holdout windows |
| P0 | Graph features leak validation/test topology | Train+validation graph is combined; test features are computed from the whole test graph | Use strictly causal temporal graph features based only on events available before each scored event |
| P0 | Calibration currently worsens ECE | Seeded FedProx ECE rises after temperature scaling | Fit calibration without oversampling distortion, compare temperature/isotonic/beta calibration, reject calibration unless held-out metrics improve |
| P0 | Percentile bands force 5% “high risk” | p95 is a relative rank, not a validated fraud threshold | Separate percentile from decision status; choose thresholds on validation using precision, capacity, and expected cost |
| P1 | Single short seed dominates model claims | Eight-round results can be unstable | Run multiple seeds and confidence intervals; lock experiment manifests and hardware/software metadata |
| P1 | Model ladder is underdeveloped | Small MLP leaves a large same-class pooled gap | Establish logistic regression, calibrated XGBoost/LightGBM, MLP, FT-Transformer/TabTransformer, and federated variants; keep only models with measured gains |
| P1 | Hyperparameters are hand-set | FedAdam appears poor due to under-tuning | Use validation-only Optuna studies with bounded search spaces and equal compute budgets |
| P1 | Dataset story is too narrow | PaySim tree models show almost no isolated-vs-pooled gap | Add BAF for account-opening fraud/fairness and GMSC/Home Credit for default/thin-file evaluation; maintain separate task-specific models |
| P1 | No temporal/generalization evaluation | Random/static split can overestimate fraud performance | Add time-based holdout, institution-held-out stress test, concept-drift report, and out-of-distribution checks |
| P1 | Explainability is called SHAP-style but is simple occlusion | Can mislead professionals | Label it “feature occlusion” or implement validated SHAP/Integrated Gradients; include baseline, direction, feature value, uncertainty, and limitations |
| P1 | No model registry or promotion gate | “latest” and `default_run.txt` are filesystem conventions | Add model/run registry with status: candidate, validated, promoted, archived; only promoted models serve predictions |
| P2 | No uncertainty/abstention | Every row receives a confident-looking band | Add calibrated uncertainty, abstain/manual-review region, and data-quality flags |
| P2 | No drift or post-deployment monitoring | Accuracy can silently decay | Add feature drift, score drift, delayed-label performance, calibration drift, and institution-level alerts |

### 4.3 VFL gaps

- The existing PSI is educational finite-field code without production cryptographic validation.
- The current VFL source is a sampled `client_0` HFL partition rather than genuine party-owned datasets.
- Parties are created in one process and aligned in memory.
- Features are concatenated centrally and logistic regression is trained centrally.
- No embeddings/gradients are exchanged across isolated party services.
- No label-holder protocol, activation privacy, gradient leakage analysis, or party-dropout handling exists.
- There is no UI showing party-specific features, overlap, PSI result size, training flow, or privacy limitations.

**Required result:** three isolated party services, a reviewed PSI library/protocol, split neural-network or secure vertical boosting training, messages captured at service boundaries, and a benchmark showing bank-only versus VFL gain on a held-out natural-prevalence set. Until then, label the current feature-union result “central VFL potential benchmark,” not VFL training.

### 4.4 Neo4j gaps

- The graph is a post-hoc visualization, not a fully integrated risk-intelligence subsystem.
- “Cross-bank ring” claims are unsupported: target counterparties often have institution `-1`, and graph ingestion does not establish institution-spanning ownership.
- Graph construction uses an enriched test sample selected with true labels.
- Community detection is run in NetworkX and only the result is persisted; Neo4j GDS capabilities are not professionally exposed.
- The page uses a fixed SVG ring layout, caps data, lacks zoom/pan, temporal filtering, path exploration, legends, provenance, score decomposition, saved views, and case workflow.
- Rebuilding the graph is hard-coded to `demo_fedprox` and destructively replaces graph contents without a job preview/version.
- Graph API queries include unrelated legacy routes with huge limits and debug logs.
- Graph account/customer scoping is not tied to an investigation case or purpose.
- No graph snapshot/model version is attached to an analyst decision.

### 4.5 Chatbot gaps

- The default experience is a cyber-threat copilot, not a federated financial-risk copilot.
- The UI still says “digital threats, malicious campaigns, and attack infrastructure.”
- Phishing, misinformation, YouTube, image search, social-profile search, medicine, generic investing, and unrelated modes remain mounted.
- Risk modes inject a text summary but do not use typed tool calling or verifiable citations.
- The analyst prompt can receive selected customer details directly from the ML API without a formal case/purpose check.
- Citizen and analyst modes are selectable manually; the backend does not enforce that a citizen cannot request analyst mode.
- Non-stream chat does not apply the risk-mode prompt path consistently.
- Mongo JWT user IDs do not match Supabase UUIDs. Conversation creation can fall back to an ephemeral UUID, after which history fetch may fail; persistence is therefore unreliable.
- Chatbot startup requires several inherited keys, even when only the FL gateway is needed.
- Uploaded transactions are sent to external LLM/search services without a clear consent/redaction boundary.
- Uploaded rows receive random suspicion scores; this must be removed immediately.
- Image, web, social, YouTube, Mermaid, schema generation, and classification jobs run unnecessarily for risk chats, increasing cost, latency, and data exposure.
- There are no chatbot tests for role isolation, grounding, hallucination, prompt injection, conversation ownership, or tool authorization.

### 4.6 Authentication, authorization, and compliance gaps

| Priority | Gap | Required resolution |
|---|---|---|
| P0 | Public signup can self-assign `analyst` and any bank | Citizen self-signup only; analysts require institution invitation/admin approval and verified corporate domain |
| P0 | Google signup can also self-assign analyst | Apply the same invitation/approval policy; existing users cannot elevate role through OAuth payload |
| P0 | LocalStorage bearer tokens are XSS-accessible and trusted until expiry | Prefer secure HttpOnly, SameSite cookies via a BFF; add short access lifetime, refresh rotation, logout revocation, CSRF controls |
| P0 | Client-side route protection trusts cached user JSON | Validate session/profile server-side; backend remains authoritative for every protected action |
| P0 | Unset consent permits citizen scoring | Require explicit active `risk_scoring` consent; define lawful/demo basis separately and visibly |
| P0 | `model_training` and `cross_institution_fl` toggles do not affect datasets/training | Build consent eligibility snapshots and exclude/withdraw subjects according to policy; disclose model-unlearning limitations |
| P0 | Prediction endpoint is broadly callable | Split citizen self-score, analyst scoped score, and internal batch scoring contracts; enforce institution/customer ownership server-side |
| P1 | Forgot-password link is dead | Implement reset tokens, rate limits, expiry, confirmation, and session revocation |
| P1 | No email verification, MFA, lockout, or login rate limit | Add verified email, analyst MFA, throttling, suspicious-login audit, and generic auth errors |
| P1 | Erasure is ticket-only | Add ticket lifecycle, identity verification, retention/legal-hold decision, deletion/anonymisation worker, completion proof, and appeal state |
| P1 | Export omits actual scored/model-derived data | Include profile, predictions, explanations, consent, audit, purposes, retention, and model/version provenance |
| P1 | Correction right is missing | Add correction request and status workflow |
| P1 | Compliance copy overclaims legal alignment | Use “designed to support” wording, map controls to current law/rules, and require legal review before claiming compliance |
| P1 | Demo users/passwords seed by default | Seed only in explicit demo mode; never in production; no credentials in production UI |

### 4.7 Frontend and UX gaps

- Several pages are compressed into one-line JSX and are difficult to maintain.
- Type checking and linting are skipped during production builds.
- There are no unit, component, accessibility, or browser end-to-end tests.
- FL “live” status uses polling despite an SSE client existing; direct SSE bypasses gateway authentication.
- Polling is not stopped when a run finishes.
- Stop-run UI does not await/confirm state or refresh history.
- Empty/loading/error/retry states are inconsistent; several errors are swallowed.
- Customer detail silently falls back to the first customer when the requested ID is absent—a serious wrong-subject bug.
- The customer page fetches 100 random rows and searches client-side rather than using an institution-scoped customer endpoint.
- Risk labels display percentiles like probabilities in several locations.
- The fairness page is institution performance, not protected-group fairness.
- The graph’s “Explain in copilot” link does not pass the selected campaign/node context.
- Landing preview data, ring claims, account IDs, scores, and “cross-bank edges” are hard-coded mock content without a demo label.
- Landing animations are heavy, obscure the core evidence, and include unsupported fixed claims.
- Jargon is not progressively disclosed; there is no plain-language mode, glossary drawer, architecture walkthrough, or “why this matters” framing.
- No responsive/mobile, keyboard, screen-reader, color-contrast, or reduced-motion acceptance suite exists.

### 4.8 Backend and platform gaps

- There are two Node backends with overlapping responsibilities and legacy routes.
- The chatbot backend has no tests; its `npm test` intentionally exits with failure.
- Server tests require a live stack and fixed seeded credentials instead of isolated fixtures.
- Internal service authentication is a single static shared token.
- CORS origins are hard-coded and include an unrelated deployment.
- Direct FastAPI read/SSE endpoints are public; browser CORS is localhost-only.
- Secrets/config validation is inconsistent; the gateway exits if unrelated API keys are absent.
- No centralized structured logging, request IDs, metrics, traces, error reporting, readiness dependencies, or SLOs exist.
- No OpenAPI-generated typed client or contract tests keep four services aligned.
- No CI covers all services, security checks, migrations, Docker build, or end-to-end flows.
- Local run artifacts and 1.6 GB data are not a deployment-safe registry/storage design.

---

## 5. Target product and architecture

### 5.1 Product surfaces

#### Public evidence site

- Plain-language problem and architecture animation.
- Honest dataset disclosure.
- Live/recorded verified experiment cards sourced from immutable artifacts, not hard-coded values.
- “What stays local / what moves / what the coordinator sees” explainer.
- HFL and VFL shown as separate scenarios.
- Privacy-utility and isolated-vs-federated evidence.
- Explicit prototype limitations.

#### Citizen portal

- Explicit onboarding and consent before first score.
- Identity-to-account link via institution-issued demo enrollment token; no arbitrary hash mapping.
- Current score with separate percentile and calibrated probability.
- Model version, generated-at time, confidence/data-quality status, and “not a lending decision” notice.
- Plain-language, actionable explanation based only on authorized facts.
- Transaction dispute/correction workflow.
- Consent, access/export, correction, erasure, request-status timeline, and support/escalation.
- Citizen copilot restricted to the citizen's own approved context and rights guidance.

#### Bank employee workspace

- Portfolio overview scoped to institution and model version.
- Alert queue with stable filters, review status, assignee, SLA, and reason codes.
- Customer investigation with transaction timeline, model evidence, graph evidence, explanation, uncertainty, notes, and human decision.
- Federated run console for authorized model operators—not every analyst.
- Graph investigation workspace with temporal and provenance controls.
- Fairness/model-risk dashboard.
- Audit and compliance evidence.
- Analyst copilot embedded within a selected run/customer/campaign case.

#### Admin/model-risk workspace

- Institution and analyst invitations.
- Role/permission management.
- Model registry and promotion approval.
- Data/consent eligibility snapshots.
- Privacy budget policy.
- Run approval and cancellation.
- Audit export and retention settings.

### 5.2 Service boundaries

Prefer reducing accidental complexity:

1. **Next.js frontend/BFF** — UI, secure session cookies, server-side route guards, API proxy.
2. **Application API** — users, organizations, invitations, consent, audit, cases, conversations, graph query authorization. Consolidate the two Node services unless a documented reason requires separation.
3. **ML control plane** — run registry, experiment metadata, inference, model registry, signed artifact URLs.
4. **FL coordinator** — model aggregation only; no institutional data volume.
5. **Institution clients** — one process/container per institution with only that institution's data and credentials.
6. **VFL party services** — isolated bank/insurer/lending-app feature owners.
7. **MongoDB/managed document store** — product records and append-only audit events.
8. **Neo4j Aura/local Neo4j** — versioned, pseudonymous, derived graph intelligence.
9. **Object storage** — models, metrics, plots, manifests, SBOMs, and signed run evidence.
10. **LLM provider adapter** — narrow tool-calling interface; no direct database access and no raw financial rows by default.

### 5.3 Authorization model

Roles should be capability-based:

- `citizen`: self-profile, own consent/rights requests, own copilot.
- `analyst`: institution-scoped portfolio/cases/graph.
- `model_operator`: start/stop approved FL configurations.
- `model_risk`: evaluate/promote/archive models and fairness reports.
- `institution_admin`: invite employees and manage institution membership.
- `platform_admin`: platform operations; no automatic customer-data visibility.

Every route must check both role and resource scope. Role alone is insufficient.

---

## 6. Professional Neo4j design

### 6.1 Privacy-safe graph model

Version all graph facts and preserve provenance:

- `(:Institution {id, display_name})`
- `(:Account {pid, institution_id, first_seen_bucket, last_seen_bucket})`
- `(:Counterparty {pid, type})`
- `(:RiskSnapshot {id, run_id, score, probability, band, uncertainty, scored_at})`
- `(:BehaviorSignal {type, value, window, computed_at, institution_id})`
- `(:Community {id, algorithm, snapshot_id, size, risk_density})`
- `(:Campaign {id, status, confidence, created_at, snapshot_id})`
- `(:Case {id, status, institution_id})`
- `(:ModelRun {run_id, dataset_version, model_version, privacy_profile})`

Edges:

- `TRANSFERRED_TO` with time bucket and aggregate count/amount statistics.
- `HAS_RISK_SNAPSHOT`, `HAS_SIGNAL`, `MEMBER_OF`, `DERIVED_FROM_RUN`, `INVESTIGATED_IN`, `BELONGS_TO`.

Never store names, email, phone, raw source identifiers, free-text notes, exact unnecessary balances, or LLM prompts in the graph.

### 6.2 Derived graph analytics

Implement and benchmark:

- weighted in/out degree and temporal velocity;
- PageRank and personalized PageRank;
- weakly connected components;
- Louvain/Leiden communities;
- triangle/cycle and circular-fund-flow motifs;
- fan-in/fan-out and rapid pass-through behavior;
- shared-counterparty similarity;
- community risk density and anomaly score;
- shortest suspicious path between selected accounts;
- graph embeddings only if they improve held-out PR-AUC and privacy review passes.

Compute local graph features inside each institution for the model. Cross-institution graph intelligence must be built only from approved pseudonymous/DP-protected derived signals with a documented linkage protocol—not by copying raw transaction edges into one database.

### 6.3 Graph UI

Replace the fixed SVG with a maintained graph component and provide:

- zoom, pan, fit, minimap, legend, search, and deterministic layout;
- time window, institution, score, edge value, community, and model-run filters;
- node/edge provenance and “why visible” panel;
- risk score versus topology score separation;
- suspicious-path and cycle explanation;
- campaign list with confidence, evidence count, institutions represented, status, owner, and case link;
- snapshot/version selector so a model retrain does not silently rewrite past investigations;
- “Ask copilot about this evidence” with signed, scoped context ID;
- raw/derived-data disclosure and graph limitations.

### 6.4 Graph acceptance

- No raw identifier appears in Neo4j, logs, API, or DOM.
- Graph build uses no target labels from the evaluation window.
- Every node/edge returned has snapshot/run provenance.
- Analyst sees only authorized institution/campaign abstractions.
- A seeded scenario genuinely contains a multi-institution derived pattern and is labelled synthetic.
- Graph query p95 latency and maximum response size are measured.
- Graph rebuild creates a new version and never silently deletes the currently served snapshot.

---

## 7. Risk copilot redesign

### 7.1 Product position

The highlighting feature should be a **Federated Risk Investigation Copilot**, not a generic chat page. It should explain evidence, execute authorized read-only tools, compare model runs, navigate graph findings, draft case notes, and teach privacy concepts. It must not invent scores, make final lending decisions, or expose another institution's customers.

### 7.2 Role-specific capabilities

#### Analyst copilot

Typed tools:

- `get_model_run(run_id)`
- `compare_runs(run_ids, metrics)`
- `get_privacy_report(run_id)`
- `get_institution_alerts(filters)`
- `get_customer_case(customer_id, case_id)`
- `get_prediction_explanation(prediction_id)`
- `get_graph_campaign(campaign_id, snapshot_id)`
- `find_suspicious_path(source_pid, target_pid, snapshot_id)`
- `get_fairness_report(model_version)`
- `create_case_note(case_id, draft)` — requires user confirmation before write

Answers must cite tool-result IDs, run IDs, model versions, graph snapshot IDs, and metric definitions. UI should render evidence cards beside prose.

#### Citizen copilot

- Explain own score and feature contributions in plain language.
- Explain probability versus percentile.
- Explain consent and rights workflow.
- Start a correction/dispute draft, export request, or erasure request only after confirmation.
- Never give loan guarantees, investment advice, accusation, or information about another person.

#### Model-risk copilot

- Compare strategies and privacy budgets.
- Detect metric regression, calibration failure, worst-bank degradation, and missing artifacts.
- Explain why a candidate cannot be promoted.
- Generate a model-card draft from signed artifacts.

### 7.3 Grounding and safety architecture

1. Backend chooses persona from verified role; client-supplied mode cannot elevate access.
2. LLM receives minimal metadata and opaque resource IDs.
3. Tool gateway authorizes every call and applies institution/customer scope.
4. Tool results are structured and bounded; raw rows are not sent to the LLM by default.
5. Prompt injection inside uploaded text or graph labels is treated as untrusted data.
6. Disable web/social/image/YouTube search for financial-risk modes unless explicitly approved for a separate public-source investigation.
7. Redact PII before any external model call and record provider, purpose, fields, retention policy, and consent basis.
8. Store conversations in the authoritative application database with tenant and ownership constraints.
9. Log tool calls and citations, not hidden chain-of-thought.
10. Add deterministic fallback explanations for core metrics when LLM service is unavailable.

### 7.4 Copilot UX

- Context header: role, institution, selected run/customer/campaign, and data boundary.
- Suggested professional tasks rather than a blank chat box.
- Tool activity timeline with success/failure and source.
- Citation chips opening the underlying run/graph/customer evidence.
- “Plain language / technical detail” control.
- Glossary hover cards for PR-AUC, epsilon, SecAgg, HFL, VFL, PSI, calibration, and false positive.
- Clear boundary between facts, interpretation, recommendation, and required human decision.
- Copy-to-case-note with confirmation and audit.

### 7.5 Copilot evaluation

Create a versioned evaluation set covering:

- metric questions with exact expected values;
- cross-institution access attempts;
- prompt injection and data exfiltration attempts;
- unsupported causal claims;
- citizen adverse-decision questions;
- consent/erasure guidance;
- graph campaign explanations;
- no-data and stale-model states;
- provider timeout/failure;
- citation correctness and tool-call authorization.

Promotion gates: zero cross-tenant leaks, zero fabricated numeric metrics in the evaluation set, citation precision target, useful-answer rubric, latency budget, and cost budget.

---

## 8. Phased implementation plan

Each phase ends with evidence and tests. Do not progress by merely changing UI copy.

### Phase 0 — Truthful baseline and architecture freeze

1. Add an `AUDIT_STATUS.md`/machine-readable capability manifest generated from actual checks.
2. Remove or visibly label every fake/hard-coded claim on the landing page.
3. Correct PaySim wording and simulated SecAgg/VFL wording everywhere.
4. Disable random `sus_detection` scoring and unrelated automatic searches in risk chat.
5. Lock target use cases, threat model, roles, service boundaries, metric definitions, and model-promotion policy in architecture decisions.
6. Decide whether to consolidate Node services; default recommendation is consolidation.
7. Generate OpenAPI schemas and shared types for all active APIs.

**Acceptance:** no UI says “real PaySim,” production SecAgg, real VFL, or real cross-bank ring unless backed by a linked artifact; capability manifest matches code.

### Phase 1 — Identity, tenant isolation, and consent foundation

1. Create organization/institution membership and invitation models.
2. Restrict public signup to citizens.
3. Add analyst invitations, approval, verified domain, and analyst MFA.
4. Replace localStorage auth with secure server-managed sessions/cookies.
5. Add email verification, password reset, refresh rotation/revocation, rate limiting, and login audit.
6. Build policy middleware for role + institution + resource + purpose.
7. Make consent default explicit and block scoring until permitted.
8. Implement consent snapshots for training eligibility.
9. Implement correction, export, and erasure workflows with statuses.
10. Replace arbitrary citizen-to-PaySim mapping with institution-issued demo enrollment; label demo identities.

**Acceptance:** public requests cannot create/elevate analysts; tenant-isolation tests pass; unset/revoked consent blocks scoring; all rights workflows have audited state transitions.

### Phase 2 — Evaluation integrity and reproducibility

1. Freeze dataset revisions and checksums.
2. Regenerate leakage-safe temporal partitions.
3. Remove target-aware test sampling and evaluate full natural-prevalence test data.
4. Separate train, local validation, federation validation, calibration, and final test.
5. Compute causal graph features using historical windows only.
6. Add experiment manifests: git SHA, dataset SHA, seed, config, dependencies, hardware, duration, prevalence.
7. Run at least multiple seeds for baseline and finalist configurations.
8. Add confidence intervals and per-bank/worst-bank metrics.
9. Build model cards and data cards automatically.
10. Surface evaluation reports in `/analyst/model-risk`.

**Acceptance:** one command recreates every displayed number; final test is read once per frozen candidate; natural prevalence is shown; calibration improves or is disabled.

### Phase 3 — Real horizontal federated execution

1. Replace the in-process multi-bank runner with an FL coordinator and isolated client services.
2. Mount only `client_i` data into institution `i`.
3. Ensure coordinator container has no partition volume.
4. Implement federated preprocessing under SecAgg.
5. Support FedAvg and FedProx first; add FedAdam only after tuned validation evidence.
6. Persist run/job state and artifacts externally.
7. Add authenticated client registration, heartbeat, retry, timeout, cancellation, and dropout handling.
8. Capture communication bytes, round duration, client failures, and aggregation evidence.
9. Add integration tests that inspect mounts/network payloads and verify no raw row crosses.
10. Keep a fast deterministic two-client CI simulation separate from full experiments.

**Acceptance:** five isolated clients complete a run; packet/message schemas contain no rows/IDs; coordinator cannot open any institution dataset; FL beats same-class isolated mean on frozen validation and final test according to a predeclared threshold.

### Phase 4 — Real privacy controls

1. Integrate reviewed SecAgg+ with client dropout recovery.
2. Define and implement DP at the chosen adjacency unit.
3. Use clipping diagnostics and account for every release, including preprocessing and repeated runs.
4. Add institution-level privacy ledger and maximum budget policy.
5. Disable configurations that exceed policy or make utility unusable.
6. Run membership-inference/update-leakage evaluations appropriate to the threat model.
7. Add signed privacy report artifact per run.
8. Redesign privacy UI to show what epsilon means, assumptions, composition, and measured utility cost.

**Acceptance:** server cannot access an individual update in an integration test; accountant reproduces epsilon; budget policy blocks excess; privacy report links to measured utility.

### Phase 5 — Strong model ladder and decision quality

1. Establish natural-prevalence centralized and isolated baselines.
2. Add task-appropriate BAF and credit-default datasets.
3. Tune logistic, GBDT, MLP, and transformer-style tabular candidates under equal budgets.
4. Evaluate federated feature/model alternatives; complexity is accepted only if it improves predeclared metrics.
5. Select thresholds by review capacity and cost—not 0.5 or percentile alone.
6. Add uncertainty/abstention and out-of-distribution signals.
7. Validate explanations against model behavior.
8. Add drift and delayed-label monitoring contracts.
9. Promote only validated models through registry approval.

**Acceptance:** promoted model has full model card, confidence intervals, calibration, operational threshold metrics, per-bank results, privacy profile, and reproducible artifact bundle.

### Phase 6 — Neo4j risk-intelligence subsystem

1. Introduce versioned graph snapshots and provenance schema.
2. Build graph from training/history windows with no evaluation labels.
3. Implement local graph feature generation and approved cross-institution derived-signal flow.
4. Run GDS/NetworkX algorithms behind a consistent service with recorded parameters.
5. Add motif/path/community risk evidence and graph-model ablation.
6. Build professional interactive graph workspace.
7. Add cases, review state, analyst notes, and graph snapshot pinning.
8. Add privacy, authorization, performance, and target-leakage tests.

**Acceptance:** graph evidence improves a held-out operational metric or is presented only as investigative context; every graph fact is traceable; a real synthetic multi-bank scenario can be explained end-to-end.

### Phase 7 — Functional VFL showcase

1. Select a defensible shared-customer dataset/scenario.
2. Create isolated bank/insurer/lender party services.
3. Integrate reviewed PSI rather than custom educational crypto for the primary demo.
4. Implement split learning or secure vertical boosting.
5. Add activation/gradient protection and leakage evaluation.
6. Record party-visible messages and failure behavior.
7. Compare bank-only, central upper bound, and VFL under identical aligned records.
8. Build VFL workflow UI showing overlap, party features, messages, rounds, and measured gain.

**Acceptance:** no party or coordinator can read another party's feature columns; combined VFL beats bank-only on held-out data; the UI accurately states cryptographic and deployment limitations.

### Phase 8 — Role-focused frontend redesign

1. Create a coherent design system with accessible typography, spacing, charts, tables, and states.
2. Replace minified pages with typed, testable components.
3. Add server-side route guards and BFF API access.
4. Build citizen onboarding/profile/rights flows.
5. Build analyst queue, customer timeline, graph workspace, FL operator console, model-risk and audit pages.
6. Distinguish percentile, probability, decision threshold, and final human decision visually.
7. Add progressive jargon disclosure and glossary.
8. Replace polling with authenticated event streaming and reliable reconnect/final states.
9. Add mobile, keyboard, screen-reader, reduced-motion, and contrast support.
10. Remove dead redirect pages and unrelated cyber/medicine/investment surfaces from the production build.

**Acceptance:** typecheck, lint, component tests, accessibility checks, and critical Playwright flows pass; no wrong-customer fallback exists; all displayed values have provenance.

### Phase 9 — Copilot and case workflow

1. Move conversations to authoritative tenant-aware storage.
2. Enforce server-selected role persona.
3. Add typed, authorized tools and citations.
4. Integrate selected Neo4j campaign/path context by opaque ID.
5. Add case-note draft/confirm workflow.
6. Add citizen rights assistant and deterministic fallback.
7. Add prompt-injection/redaction controls and provider privacy settings.
8. Run the copilot evaluation suite in CI.
9. Add cost/latency/rate controls and graceful provider failover.

**Acceptance:** no role escalation, fabricated metric, cross-tenant response, or uncited numeric claim in the gate suite; conversation history persists for Mongo identities.

### Phase 10 — Reliability, security, and observability

1. Add unit, contract, integration, and end-to-end tests across all services.
2. Stop skipping TypeScript and lint checks.
3. Add structured logs, correlation IDs, metrics, traces, dashboards, and alerts.
4. Add dependency/SBOM/container/secret/static scans and migration checks.
5. Add backups, restore drill, retention policy, and artifact integrity checks.
6. Add rate limits, request-size limits, safe upload parsing, malware scanning, CSP, secure headers, and strict CORS.
7. Add load tests for scoring, graph, SSE, and chat.
8. Add chaos tests for client dropout, Neo4j pause, LLM failure, and worker restart.

**Acceptance:** CI is green from a clean checkout; recovery and degradation paths are demonstrated; no critical/high security finding remains unresolved without a signed exception.

### Phase 11 — Deployment and judge-ready evidence

1. Separate hosted inference/demo from heavy training jobs.
2. Store models/artifacts in object storage; never rely on container filesystem.
3. Add environment-specific secrets and URLs.
4. Add demo seed as an explicit one-off operation, never startup behavior.
5. Add health/readiness checks that verify dependencies.
6. Prepare a deterministic live path plus artifact replay if live training is unavailable.
7. Produce architecture, threat model, data flow, model card, privacy report, test report, and demo script.
8. Run a clean-room deployment and full judge flow.

**Acceptance:** one documented deployment produces a usable URL; all core paths work without local-only URLs; every judge-facing claim opens its evidence artifact.

---

## 9. Deployment recommendation

### 9.1 Recommended prototype topology

- **Frontend/BFF:** Vercel.
- **MongoDB:** MongoDB Atlas free/shared tier for prototype identity, cases, consent, and conversation data.
- **Neo4j:** AuraDB Free, keeping within its current 50,000-node/175,000-relationship prototype limit; it pauses after inactivity and has no free backups.
- **Node application API:** Render free for preview or a small paid/credit-backed container service for reliable demos.
- **ML inference API:** a container platform with at least 2 GB RAM and predictable cold-start behavior; bundle only the promoted inference artifact.
- **FL training/coordinator/clients:** local Docker Compose for the strongest judge demonstration, or on-demand container jobs/services. Do not put long-lived training inside a normal Vercel request.
- **Artifacts:** S3-compatible object storage or provider blob storage.

### 9.2 Free-tier limitations to design around

- Render free web services sleep after inactivity and have ephemeral filesystems; free persistent disks are unavailable. Training artifacts must be external.
- Vercel Hobby functions have finite duration/memory and are not a natural home for stateful multi-round FL workers, even though newer function/workflow features support longer tasks.
- AuraDB Free is suitable for the prototype but constrained in graph size and backup/availability behavior.
- A fully hosted five-client live FL demonstration may exceed practical free-tier reliability. A professional fallback is a hosted evidence/replay mode plus a local multi-container live run, clearly labelled.

### 9.3 MCP constraint

The current agent session does not expose a Vercel MCP server in its available MCP list. Deployment automation must be re-evaluated when implementation reaches Phase 11. Do not make the architecture depend on an MCP integration being present. CLI/API deployment can be used after explicit authorization if necessary.

---

## 10. Test strategy

### 10.1 Required suites

- **Data:** provenance, schema, leakage, temporal causality, prevalence, pseudonym collision, consent eligibility.
- **ML:** metrics, thresholds, calibration, determinism, explainability fidelity, drift, artifact loading.
- **FL:** isolated process boundary, strategy math, client sampling, dropout, restart, stop, authentication, no-row payload, SecAgg, DP accounting.
- **VFL:** PSI correctness, party isolation, split gradients, overlap, leakage, dropout.
- **API:** OpenAPI contracts, validation, role/resource/purpose scope, idempotency, error shape.
- **Auth:** privilege escalation, session rotation, CSRF, reset, invitation, MFA, rate limit.
- **Consent:** unset/granted/revoked states, training snapshot, export, correction, erasure lifecycle.
- **Graph:** no raw IDs, no target-aware build, snapshot version, authorization, Cypher parameterization, query limits.
- **Copilot:** tool authorization, grounding, citation, prompt injection, tenant isolation, refusal, provider failure.
- **Frontend:** unit/component, accessibility, visual regression, responsive, Playwright critical journeys.
- **Operations:** clean Docker build, migrations, backup/restore, load, restart, cold start.

### 10.2 Critical end-to-end journeys

1. Citizen signs up, verifies identity, grants scoring consent, links demo account, views score, asks an explanation, exports data, revokes consent, and confirms scoring is blocked.
2. Institution admin invites an analyst; unauthorized citizen cannot become analyst.
3. Model operator starts a five-client FL run; clients train separately; UI streams metrics; run completes and artifacts are registered.
4. Model-risk reviewer compares isolated/FL/pooled metrics and rejects or promotes the candidate.
5. Analyst opens an institution-scoped alert, explores graph evidence, asks the copilot with citations, creates a case note, and records a human decision.
6. Analyst attempts another bank's customer ID and receives a non-enumerating denial.
7. One FL client drops; SecAgg threshold behavior and run status are correct.
8. Neo4j or LLM is unavailable; core risk pages remain functional with clear degraded state.

---

## 11. Definition of done

The prototype is complete only when:

- raw institutional rows are technically inaccessible to the coordinator;
- active FL uses isolated clients and a real supported aggregation path;
- privacy claims are backed by protocol/config/accounting artifacts;
- all displayed model metrics use a frozen natural-prevalence evaluation;
- federated improvement is measured against same-class isolated baselines;
- customer identities are not arbitrarily mapped without a visible demo contract;
- analyst access is invitation-based and institution-scoped;
- consent purposes have real enforcement semantics;
- Neo4j contains only approved derived pseudonymous intelligence with provenance;
- VFL is either truly distributed or explicitly labelled a benchmark;
- chatbot responses use authorized tools and citations and cannot elevate roles;
- typecheck, lint, tests, security checks, and end-to-end journeys pass;
- deployment does not rely on local disk or localhost URLs;
- every judge-facing number and claim links to reproducible evidence;
- known limitations remain visible rather than hidden.

---

## 12. Inputs required from the team before implementation gates

Implementation can begin with Phase 0 without these, but the following decisions are required before the corresponding phases:

1. Whether public users should ever self-register as citizens, or all accounts should be invitation/demo-only.
2. Institution names/branding or permission to keep neutral Bank 0–4 labels.
3. Which external LLM provider and data-retention/privacy settings are acceptable.
4. Whether a billing-card-backed free quota is acceptable for Cloud Run/other services, or deployment must require no card.
5. Whether the team can create MongoDB Atlas, Neo4j AuraDB, object-storage, OAuth, and email-provider accounts.
6. Which use case is the final headline: transaction fraud, credit default/thin-file risk, or both with one primary.
7. Whether BAF/GMSC/Home Credit licenses and Kaggle credentials can be used in the final demo.
8. Target privacy policy: institution-level or customer-level DP, target epsilon range, and trusted-coordinator assumption.
9. Whether judges require live training over the internet or accept local isolated containers plus hosted artifact replay.
10. Brand assets, desired visual identity, and whether the inherited cyber-threat features should be removed entirely or moved to a separate branch/product.

---

## 13. Immediate next execution order

When implementation is approved, begin in this exact order:

1. Correct false claims and remove random chatbot scoring.
2. Fix analyst privilege escalation and explicit-consent enforcement.
3. Fix wrong-customer fallback and direct/public ML access.
4. Freeze architecture, threat model, metrics, and API contracts.
5. Rebuild evaluation at natural prevalence and regenerate trustworthy artifacts.
6. Move HFL to isolated client processes and real SecAgg.
7. Rebuild Neo4j from leakage-safe versioned data.
8. Redesign role workflows and integrate scoped copilot tools.
9. Implement real VFL after the HFL core is stable.
10. Complete deployment, reliability, and judge evidence.

This order prevents a polished UI from amplifying unsupported technical claims.