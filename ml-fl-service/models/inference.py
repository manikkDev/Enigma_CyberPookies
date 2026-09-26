import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

from data.schema import SCHEMAS
from models.common import frame_to_matrix, model_columns
from models.metrics import all_metrics
from settings import settings


def available_runs():
    root = Path(settings.RUNS_DIR)
    runs = []
    if not root.exists():
        return runs
    for directory in root.iterdir():
        summary = directory / "summary.json"
        model = directory / "global_model.npz"
        if directory.is_dir() and summary.exists() and model.exists():
            value = json.loads(summary.read_text())
            runs.append({**value, "mtime": summary.stat().st_mtime})
    return sorted(runs, key=lambda item: item["mtime"], reverse=True)


def resolve_run(run_id=None):
    root = Path(settings.RUNS_DIR)
    if run_id:
        directory = root / run_id
        if (directory / "summary.json").exists() and (directory / "global_model.npz").exists():
            return directory, json.loads((directory / "summary.json").read_text())
        raise FileNotFoundError("Unknown model run {}".format(run_id))
    marker = root / "default_run.txt"
    if marker.exists():
        directory = root / marker.read_text().strip()
        if (directory / "summary.json").exists() and (directory / "global_model.npz").exists():
            return directory, json.loads((directory / "summary.json").read_text())
    runs = available_runs()
    if not runs:
        raise FileNotFoundError("No federated model is available; run the demo seed first")
    directory = root / runs[0]["run_id"]
    return directory, runs[0]


def _predict_proba(matrix, archive):
    from arth_fl.federated import forward
    return forward(matrix, archive["params"], archive["layer_sizes"].tolist())


def _occlusion_explanations(matrix, probabilities, archive, schema, top=8):
    names = model_columns(schema)
    explanations = []
    for row_index in range(len(matrix)):
        contributions = []
        for feature in range(matrix.shape[1]):
            neutral = matrix[row_index : row_index + 1].copy()
            neutral[0, feature] = 0.0
            contribution = float(probabilities[row_index] - _predict_proba(neutral, archive)[0])
            contributions.append({"feature": names[feature], "contribution": contribution, "direction": "increases risk" if contribution >= 0 else "reduces risk"})
        contributions.sort(key=lambda item: -abs(item["contribution"]))
        explanations.append(contributions[:top])
    return explanations


def score_frame(frame, run_id=None, dataset="paysim_banks", explain=False):
    directory, summary = resolve_run(run_id)
    archive = np.load(directory / "global_model.npz")
    schema = SCHEMAS[dataset]
    matrix = frame_to_matrix(frame, schema, archive["mean"], archive["scale"])
    probabilities = _predict_proba(matrix, archive)
    result = {"run_id": summary["run_id"], "scores": probabilities.tolist(), "risk_band": ["high" if value >= 0.7 else "medium" if value >= 0.3 else "low" for value in probabilities]}
    if explain:
        result["explanations"] = _occlusion_explanations(matrix, probabilities, archive, schema)
        result["explanation_method"] = "feature occlusion: score change when each feature is set to its population mean"
    return result


def test_frame(dataset="paysim_banks"):
    return pd.read_parquet(Path(settings.PARTITIONS_DIR) / dataset / "hfl_5" / "test.parquet")


def customer_sample(run_id=None, dataset="paysim_banks", n=50, client_id=None):
    schema = SCHEMAS[dataset]
    frame = test_frame(dataset)
    if client_id is not None:
        frame = frame[frame[schema.client_col] == int(client_id)]
    frame = frame.sample(min(int(n), len(frame)), random_state=17).reset_index(drop=True)
    scored = score_frame(frame, run_id, dataset, explain=False)
    columns = [schema.id_col, schema.client_col, schema.target, "amount", "type", "hour", "amt_to_bal_ratio"]
    rows = frame[columns].to_dict("records")
    for row, score, band in zip(rows, scored["scores"], scored["risk_band"]):
        row.update({"score": score, "risk_band": band})
    return {"run_id": scored["run_id"], "rows": rows}


def citizen_profile(customer_ref, run_id=None, dataset="paysim_banks"):
    frame = test_frame(dataset)
    index = int(hashlib.sha256(str(customer_ref).encode()).hexdigest(), 16) % len(frame)
    row = frame.iloc[[index]].copy()
    scored = score_frame(row, run_id, dataset, explain=True)
    schema = SCHEMAS[dataset]
    return {
        "run_id": scored["run_id"],
        "customer_ref": customer_ref,
        "pseudonymous_account": row.iloc[0][schema.id_col],
        "score": scored["scores"][0],
        "risk_band": scored["risk_band"][0],
        "explanation": scored["explanations"][0],
        "facts": {"transaction_type": row.iloc[0]["type"], "amount": float(row.iloc[0]["amount"]), "institution": int(row.iloc[0][schema.client_col])},
        "guidance": ["Review repayment dates and keep scheduled payments current", "Report unfamiliar transactions immediately", "Keep contact and income information up to date"],
        "disclaimer": "This educational risk signal is not a lending decision or guarantee.",
    }


def fairness_report(run_id=None, dataset="paysim_banks"):
    schema = SCHEMAS[dataset]
    frame = test_frame(dataset)
    scored = score_frame(frame, run_id, dataset)
    frame = frame.copy()
    frame["probability"] = scored["scores"]
    groups = []
    for institution, group in frame.groupby(schema.client_col):
        metrics = all_metrics(group[schema.target].to_numpy(), group["probability"].to_numpy())
        predicted = group["probability"] >= 0.5
        negatives = group[schema.target] == 0
        false_positive_rate = float((predicted & negatives).sum() / max(1, negatives.sum()))
        groups.append({"group": "Bank {}".format(int(institution)), "false_positive_rate": false_positive_rate, **metrics})
    return {"run_id": scored["run_id"], "scope": "institution-level operational fairness; PaySim has no demographic attributes", "groups": groups}
