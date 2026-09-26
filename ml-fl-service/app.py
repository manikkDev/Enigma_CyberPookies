import asyncio
import json
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from arth_fl.dp_accounting import epsilon_after_rounds
from arth_fl.federated import jobs
from data.schema import SCHEMAS
from models.inference import available_runs, citizen_profile, customer_sample, fairness_report, resolve_run, score_frame
from settings import settings

app = FastAPI(title="Arth Saathi ML/FL Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def internal(x_internal_token: str = Header(default="")):
    if not settings.NODE_INTERNAL_TOKEN or x_internal_token != settings.NODE_INTERNAL_TOKEN:
        raise HTTPException(401, "Invalid internal token")


class FLStartRequest(BaseModel):
    dataset: str = "paysim_banks"
    strategy: str = "fedprox"
    rounds: int = Field(8, ge=1, le=50)
    local_epochs: int = Field(1, ge=1, le=5)
    dp_enabled: bool = False
    dp_noise_multiplier: float = Field(2.5, gt=0)
    dp_clipping_norm: float = Field(1.0, gt=0)
    secagg_enabled: bool = True
    run_id: Optional[str] = None


class PredictRequest(BaseModel):
    run_id: Optional[str] = None
    dataset: str = "paysim_banks"
    rows: list[dict]
    explain: bool = False


@app.get("/")
def root():
    return {"service": "ml-fl-service", "status": "ready", "capabilities": ["baselines", "horizontal_fl", "dp_accounting", "secure_aggregation_simulation", "explainability", "fairness", "graph", "vfl_showcase"]}


@app.get("/health")
def health():
    return {"ok": True, "service": "ml-fl-service", "phase": "demo-complete", "port": settings.PORT, "model_ready": bool(available_runs())}


@app.get("/datasets")
def datasets():
    root_path = Path(settings.PARTITIONS_DIR)
    output = []
    for key, schema in SCHEMAS.items():
        for partition in sorted((root_path / key).glob("hfl_*")):
            metadata = partition / "meta.json"
            if metadata.exists():
                output.append({"dataset": key, "task": schema.task, "partition": partition.name, "meta": json.loads(metadata.read_text())})
    return output


@app.post("/fl/start", dependencies=[Depends(internal)], status_code=202)
def start_federated(request: FLStartRequest):
    config = {
        "dataset": request.dataset,
        "strategy": request.strategy,
        "num-server-rounds": request.rounds,
        "local-epochs": request.local_epochs,
        "dp-enabled": request.dp_enabled,
        "dp-noise-multiplier": request.dp_noise_multiplier,
        "dp-clipping-norm": request.dp_clipping_norm,
        "secagg-enabled": request.secagg_enabled,
        "run-id": request.run_id,
    }
    return {"run_id": jobs.start(config), "status": "running"}


@app.post("/fl/stop/{run_id}", dependencies=[Depends(internal)])
def stop_federated(run_id: str):
    return {"ok": jobs.stop(run_id)}


@app.get("/fl/status/{run_id}")
def federated_status(run_id: str):
    return jobs.status(run_id)


@app.get("/fl/runs")
def federated_runs():
    return [{"run_id": item["run_id"], "config": item["config"], "final": item["final"], "privacy": item.get("privacy"), "status": "finished"} for item in available_runs()]


@app.get("/fl/stream/{run_id}")
async def federated_stream(run_id: str):
    path = Path(settings.RUNS_DIR) / run_id / "metrics.jsonl"
    async def events():
        position = 0
        while True:
            if path.exists():
                text = path.read_text()
                update = text[position:]
                position = len(text)
                for line in update.splitlines():
                    yield {"event": "progress", "data": line}
                    if '"event": "end"' in line or '"event":"end"' in line:
                        return
            status = jobs.status(run_id)["status"]
            if status in {"failed", "stopped"}:
                yield {"event": "progress", "data": json.dumps({"event": status, "run_id": run_id})}
                return
            await asyncio.sleep(1)
    return EventSourceResponse(events())


@app.get("/fl/summary")
def summary():
    runs_root = Path(settings.RUNS_DIR)
    baseline_path = runs_root / "baselines_paysim_banks.json"
    vfl_path = runs_root / "vfl_demo" / "summary.json"
    tradeoff_path = runs_root / "privacy_tradeoff.json"
    runs = available_runs()
    latest = None
    try:
        _, latest = resolve_run()
    except FileNotFoundError:
        latest = {key: value for key, value in runs[0].items() if key != "mtime"} if runs else None
    return {
        "baselines": json.loads(baseline_path.read_text()) if baseline_path.exists() else None,
        "federated": [{key: value for key, value in item.items() if key != "mtime"} for item in runs],
        "latest": latest,
        "vfl": json.loads(vfl_path.read_text()) if vfl_path.exists() else None,
        "privacy_tradeoff": json.loads(tradeoff_path.read_text()) if tradeoff_path.exists() else None,
    }


@app.get("/vfl/summary")
def vfl_summary():
    vfl_path = Path(settings.RUNS_DIR) / "vfl_demo" / "summary.json"
    if not vfl_path.exists():
        raise HTTPException(404, "VFL demo has not been seeded yet")
    return json.loads(vfl_path.read_text())


@app.get("/privacy/tradeoff")
def privacy_tradeoff():
    tradeoff_path = Path(settings.RUNS_DIR) / "privacy_tradeoff.json"
    if not tradeoff_path.exists():
        raise HTTPException(404, "Privacy tradeoff has not been seeded yet")
    return json.loads(tradeoff_path.read_text())


@app.get("/privacy/epsilon")
def privacy_epsilon(noise: float = 2.5, rounds: int = 8, delta: float = 1e-5):
    return {"epsilon": epsilon_after_rounds(noise, rounds, 1.0, delta), "delta": delta, "noise_multiplier": noise, "rounds": rounds, "scope": "client-update central DP estimate under full participation"}


@app.post("/predict")
def predict(request: PredictRequest):
    frame = pd.DataFrame(request.rows)
    schema = SCHEMAS[request.dataset]
    for column in schema.numeric:
        if column not in frame:
            frame[column] = 0.0
    for column in schema.categorical:
        if column not in frame:
            frame[column] = "PAYMENT"
    frame[schema.target] = 0
    return score_frame(frame, request.run_id, request.dataset, request.explain)


@app.get("/customers/{dataset}/{run_id}/sample")
def customers(dataset: str, run_id: str, n: int = 50, client_id: Optional[int] = None):
    return customer_sample(None if run_id == "latest" else run_id, dataset, n, client_id)


@app.get("/citizen/{customer_ref}")
def citizen(customer_ref: str, run_id: Optional[str] = None):
    return citizen_profile(customer_ref, run_id)


@app.get("/fairness")
def fairness(run_id: Optional[str] = None):
    return fairness_report(run_id)


@app.post("/graph/seed", dependencies=[Depends(internal)])
def seed_graph(run_id: Optional[str] = None, max_rows: int = 15000):
    from graph.ingest import ingest
    return ingest(run_id, max_rows)
