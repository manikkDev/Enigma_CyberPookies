import argparse
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from data.schema import SCHEMAS
from models.common import sample_frame, save_json, xy
from models.metrics import all_metrics
from settings import settings


def fit_model(train, validation, key, seed=42):
    x_train, y_train = xy(train, key)
    x_validation, y_validation = xy(validation, key)
    negative, positive = np.bincount(y_train, minlength=2)
    model = xgb.XGBClassifier(
        n_estimators=350,
        learning_rate=0.06,
        max_depth=6,
        min_child_weight=2,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=float(negative / max(positive, 1)),
        tree_method="hist",
        eval_metric="aucpr",
        random_state=seed,
        n_jobs=4,
        early_stopping_rounds=35,
    )
    model.fit(x_train, y_train, eval_set=[(x_validation, y_validation)], verbose=False)
    return model


def run(key="paysim_banks", clients=5, train_cap=150000, test_cap=200000, runs_dir=None, seed=42):
    schema = SCHEMAS[key]
    root = Path("data/partitions") / key / "hfl_{}".format(clients)
    test = sample_frame(pd.read_parquet(root / "test.parquet"), schema.target, test_cap, seed)
    x_test, y_test = xy(test, key)
    trains, validations, isolated = [], [], {}
    for client in range(clients):
        train = sample_frame(pd.read_parquet(root / "client_{}".format(client) / "train.parquet"), schema.target, train_cap, seed + client)
        validation = sample_frame(pd.read_parquet(root / "client_{}".format(client) / "val.parquet"), schema.target, max(25000, train_cap // 5), seed + client)
        trains.append(train)
        validations.append(validation)
        model = fit_model(train, validation, key, seed + client)
        isolated[str(client)] = all_metrics(y_test, model.predict_proba(x_test)[:, 1])
    central_train = pd.concat(trains, ignore_index=True).sample(frac=1, random_state=seed).reset_index(drop=True)
    central_validation = pd.concat(validations, ignore_index=True).sample(frac=1, random_state=seed).reset_index(drop=True)
    central = fit_model(central_train, central_validation, key, seed)
    centralized = all_metrics(y_test, central.predict_proba(x_test)[:, 1])
    numeric_metrics = [key for key, value in centralized.items() if isinstance(value, (int, float)) and key != "n"]
    isolated_mean = {metric: float(np.mean([entry[metric] for entry in isolated.values() if entry[metric] is not None])) for metric in numeric_metrics}
    result = {
        "dataset": key,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "methodology": {"centralized": "pooled-data XGBoost upper bound", "isolated": "one XGBoost model per institution", "train_cap": train_cap, "test_cap": test_cap, "seed": seed},
        "centralized": centralized,
        "isolated": isolated,
        "isolated_mean": isolated_mean,
        "gap": {"pr_auc": centralized["pr_auc"] - isolated_mean["pr_auc"], "roc_auc": centralized["roc_auc"] - isolated_mean["roc_auc"]},
    }
    output = Path(runs_dir or settings.RUNS_DIR)
    output.mkdir(parents=True, exist_ok=True)
    central.save_model(output / "centralized_{}.json".format(key))
    save_json(output / "baselines_{}.json".format(key), result)
    print(result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="paysim_banks")
    parser.add_argument("--clients", type=int, default=5)
    parser.add_argument("--train-cap", type=int, default=150000)
    parser.add_argument("--test-cap", type=int, default=200000)
    arguments = parser.parse_args()
    run(arguments.dataset, arguments.clients, arguments.train_cap, arguments.test_cap)
