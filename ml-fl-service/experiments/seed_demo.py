import argparse
import json
from pathlib import Path

from arth_fl.federated import run_federated
from experiments.report import build_report
from graph.ingest import ingest
from models.baselines import run as run_baselines
from settings import settings
from vertical.run_vfl_demo import run as run_vfl


def seed(force=False, include_graph=True):
    root = Path(settings.RUNS_DIR)
    baseline_path = root / "baselines_paysim_banks.json"
    if force or not baseline_path.exists():
        run_baselines(train_cap=80000, test_cap=120000)
    non_private = root / "demo_fedprox" / "summary.json"
    if force or not non_private.exists():
        run_federated({"run-id": "demo_fedprox", "dataset": "paysim_banks", "strategy": "fedprox", "num-server-rounds": 8, "local-epochs": 1, "client-sample-cap": 40000, "test-sample-cap": 120000, "secagg-enabled": True, "dp-enabled": False})
    private = root / "demo_fedprox_dp" / "summary.json"
    if force or not private.exists():
        run_federated({"run-id": "demo_fedprox_dp", "dataset": "paysim_banks", "strategy": "fedprox", "num-server-rounds": 5, "local-epochs": 1, "client-sample-cap": 25000, "test-sample-cap": 100000, "secagg-enabled": True, "dp-enabled": True, "dp-noise-multiplier": 3.0, "dp-clipping-norm": 1.0})
    vfl_path = root / "vfl_demo" / "summary.json"
    if force or not vfl_path.exists():
        run_vfl(sample_cap=6000)
    graph = ingest("demo_fedprox", 12000) if include_graph else None
    report = build_report()
    result = {"ok": True, "baseline": json.loads(baseline_path.read_text()), "federated_runs": [run["run_id"] for run in report["federated"]], "vfl": report["vfl"], "graph": graph}
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-graph", action="store_true")
    arguments = parser.parse_args()
    seed(arguments.force, not arguments.skip_graph)
