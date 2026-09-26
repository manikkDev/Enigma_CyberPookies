import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neural_network import MLPClassifier

from arth_fl.dp_accounting import epsilon_after_rounds
from arth_fl.progress import Progress
from data.schema import SCHEMAS
from models.common import frame_to_matrix, model_columns, sample_frame, save_json
from models.metrics import all_metrics
from settings import settings

HIDDEN_LAYERS = (48, 24)


class StoppedRun(Exception):
    pass


def federated_statistics(frames, schema):
    count = 0
    total = None
    total_sq = None
    for frame in frames:
        matrix = frame_to_matrix(frame, schema).astype(np.float64)
        count += len(matrix)
        current_sum = matrix.sum(axis=0)
        current_sq = np.square(matrix).sum(axis=0)
        total = current_sum if total is None else total + current_sum
        total_sq = current_sq if total_sq is None else total_sq + current_sq
    mean = total / count
    variance = np.maximum(total_sq / count - np.square(mean), 1e-6)
    return mean.astype(np.float64), np.sqrt(variance).astype(np.float64), count


def layer_sizes(n_features):
    return [n_features, *HIDDEN_LAYERS, 1]


def pack_params(model):
    return np.concatenate([array.ravel() for array in [*model.coefs_, *model.intercepts_]])


def unpack_params(model, vector):
    offset = 0
    for array in [*model.coefs_, *model.intercepts_]:
        size = array.size
        array[...] = vector[offset : offset + size].reshape(array.shape)
        offset += size


def _template_model(n_features, seed=0):
    model = MLPClassifier(hidden_layer_sizes=HIDDEN_LAYERS, alpha=1e-3, random_state=seed)
    model.partial_fit(np.zeros((2, n_features)), np.array([0, 1]), classes=np.array([0, 1]))
    return model


def forward(matrix, params, sizes):
    weights = []
    biases = []
    offset = 0
    for layer in range(len(sizes) - 1):
        weight_size = sizes[layer] * sizes[layer + 1]
        weights.append(params[offset : offset + weight_size].reshape(sizes[layer], sizes[layer + 1]))
        offset += weight_size
    for layer in range(1, len(sizes)):
        biases.append(params[offset : offset + sizes[layer]])
        offset += sizes[layer]
    x = matrix.astype(np.float64)
    for layer, (weight, bias) in enumerate(zip(weights, biases)):
        x = x @ weight + bias
        if layer < len(weights) - 1:
            x = np.maximum(x, 0)
    return (1 / (1 + np.exp(-np.clip(x, -30, 30)))).ravel()


def _oversample(matrix, labels, seed, ratio=8):
    rng = np.random.default_rng(seed)
    positive = np.where(labels == 1)[0]
    negative = np.where(labels == 0)[0]
    repeats = min(ratio * len(positive), max(len(positive), len(negative) // 2))
    extra = rng.choice(positive, size=repeats, replace=True) if len(positive) else np.array([], dtype=int)
    order = np.concatenate([np.arange(len(labels)), extra])
    rng.shuffle(order)
    return matrix[order], labels[order]


def _local_update(matrix, labels, global_vector, epochs, seed, proximal_mu):
    model = _template_model(matrix.shape[1], seed)
    unpack_params(model, global_vector)
    x_local, y_local = _oversample(matrix, labels, seed)
    rng = np.random.default_rng(seed)
    for _ in range(epochs):
        order = rng.permutation(len(y_local))
        model.partial_fit(x_local[order], y_local[order])
        if proximal_mu:
            local = pack_params(model)
            unpack_params(model, (local + proximal_mu * global_vector) / (1 + proximal_mu))
    return pack_params(model) - global_vector


def _secure_weighted_average(updates, counts, seed):
    weighted = [np.asarray(update) * count for update, count in zip(updates, counts)]
    rng = np.random.default_rng(seed)
    for left in range(len(weighted)):
        for right in range(left + 1, len(weighted)):
            mask = rng.normal(0, 0.05, size=weighted[left].shape)
            weighted[left] += mask
            weighted[right] -= mask
    return np.sum(weighted, axis=0) / sum(counts)


def run_federated(config, stop_event=None):
    dataset = config.get("dataset", "paysim_banks")
    schema = SCHEMAS[dataset]
    clients = int(config.get("clients", 5))
    rounds = int(config.get("num-server-rounds", config.get("rounds", 12)))
    epochs = int(config.get("local-epochs", 1))
    cap = int(config.get("client-sample-cap", 60000))
    strategy = config.get("strategy", "fedprox")
    proximal_mu = float(config.get("proximal-mu", 0.05)) if strategy == "fedprox" else 0.0
    dp_enabled = bool(config.get("dp-enabled", False))
    noise = float(config.get("dp-noise-multiplier", 2.5))
    clip = float(config.get("dp-clipping-norm", 1.0))
    delta = float(config.get("dp-delta", 1e-5))
    secagg = bool(config.get("secagg-enabled", True))
    seed = int(config.get("seed", 42))
    run_id = config.get("run-id") or "fl_{}".format(uuid.uuid4().hex[:8])
    root = Path(settings.PARTITIONS_DIR) / dataset / "hfl_{}".format(clients)
    frames = [sample_frame(pd.read_parquet(root / "client_{}".format(client) / "train.parquet"), schema.target, cap, seed + client) for client in range(clients)]
    mean, scale, stats_count = federated_statistics(frames, schema)
    matrices = [frame_to_matrix(frame, schema, mean, scale) for frame in frames]
    labels = [frame[schema.target].to_numpy(np.int8) for frame in frames]
    test = sample_frame(pd.read_parquet(root / "test.parquet"), schema.target, int(config.get("test-sample-cap", 160000)), seed)
    test_matrix = frame_to_matrix(test, schema, mean, scale)
    test_labels = test[schema.target].to_numpy(np.int8)
    sizes = layer_sizes(matrices[0].shape[1])
    global_vector = pack_params(_template_model(matrices[0].shape[1], seed))
    progress = Progress(settings.RUNS_DIR, run_id, settings.PROGRESS_WEBHOOK, settings.NODE_INTERNAL_TOKEN)
    progress.path.write_text("")
    normalized_config = {**config, "run-id": run_id, "dataset": dataset, "strategy": strategy, "num-server-rounds": rounds, "dp-enabled": dp_enabled, "secagg-enabled": secagg, "model": "mlp{}".format(HIDDEN_LAYERS)}
    progress.emit({"run_id": run_id, "event": "start", "config": normalized_config})
    rng = np.random.default_rng(seed)
    round_events = []
    for server_round in range(1, rounds + 1):
        if stop_event and stop_event.is_set():
            raise StoppedRun(run_id)
        updates = []
        norms = []
        for client, (matrix, target) in enumerate(zip(matrices, labels)):
            delta_vector = _local_update(matrix, target, global_vector, epochs, seed + server_round * 100 + client, proximal_mu)
            vector_norm = float(np.linalg.norm(delta_vector))
            norms.append(vector_norm)
            if dp_enabled and vector_norm > clip:
                delta_vector = delta_vector * (clip / vector_norm)
            updates.append(delta_vector)
        counts = [len(target) for target in labels]
        if secagg:
            aggregate = _secure_weighted_average(updates, counts, seed + server_round)
        else:
            aggregate = sum(update * count for update, count in zip(updates, counts)) / sum(counts)
        if dp_enabled:
            aggregate = aggregate + rng.normal(0, noise * clip / clients, size=aggregate.shape)
        global_vector = global_vector + aggregate
        probability = forward(test_matrix, global_vector, sizes)
        metrics = all_metrics(test_labels, probability)
        epsilon = epsilon_after_rounds(noise, server_round, 1.0, delta) if dp_enabled else None
        event = progress.emit({
            "run_id": run_id,
            "event": "round",
            "round": server_round,
            "num_rounds": rounds,
            "strategy": strategy,
            "global": metrics,
            "clients": {str(client): {"num_examples": counts[client], "update_norm": norms[client]} for client in range(clients)},
            "privacy": {"dp_enabled": dp_enabled, "epsilon": epsilon, "delta": delta, "noise_multiplier": noise, "clipping_norm": clip, "secagg": secagg, "secagg_mode": "simulated_pairwise_masks" if secagg else "disabled"},
        })
        round_events.append(event)
    final = round_events[-1]["global"]
    directory = Path(settings.RUNS_DIR) / run_id
    np.savez(directory / "global_model.npz", params=global_vector, layer_sizes=np.array(sizes), mean=mean, scale=scale)
    summary = {
        "run_id": run_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "config": normalized_config,
        "final": final,
        "epsilon": round_events[-1]["privacy"]["epsilon"],
        "privacy": round_events[-1]["privacy"],
        "federated_statistics": {"aggregated_records": stats_count, "shared": ["count", "feature_sum", "feature_sum_of_squares"], "raw_rows_shared": False},
        "feature_names": model_columns(schema),
    }
    save_json(directory / "summary.json", summary)
    progress.emit({"run_id": run_id, "event": "end", "final": final, "privacy": summary["privacy"]})
    return summary


class FederatedJobs:
    def __init__(self):
        self.jobs = {}
        self.lock = threading.Lock()

    def start(self, config):
        run_id = config.get("run-id") or "fl_{}".format(uuid.uuid4().hex[:8])
        config = {**config, "run-id": run_id}
        stop_event = threading.Event()
        job = {"run_id": run_id, "status": "running", "config": config, "stop": stop_event, "error": None}
        self.jobs[run_id] = job

        def target():
            try:
                job["summary"] = run_federated(config, stop_event)
                job["status"] = "finished"
            except StoppedRun:
                job["status"] = "stopped"
            except Exception as error:
                job["status"] = "failed"
                job["error"] = str(error)

        threading.Thread(target=target, daemon=True).start()
        return run_id

    def stop(self, run_id):
        if run_id in self.jobs:
            self.jobs[run_id]["stop"].set()
            return True
        return False

    def status(self, run_id):
        directory = Path(settings.RUNS_DIR) / run_id
        events = []
        metrics = directory / "metrics.jsonl"
        if metrics.exists():
            events = [json.loads(line) for line in metrics.read_text().splitlines() if line.strip()]
        job = self.jobs.get(run_id)
        summary_path = directory / "summary.json"
        return {
            "run_id": run_id,
            "status": job["status"] if job else ("finished" if summary_path.exists() else "unknown"),
            "config": job["config"] if job else (json.loads(summary_path.read_text())["config"] if summary_path.exists() else None),
            "rounds": [event for event in events if event.get("event") == "round"],
            "final": json.loads(summary_path.read_text()) if summary_path.exists() else None,
            "error": job.get("error") if job else None,
        }


jobs = FederatedJobs()
