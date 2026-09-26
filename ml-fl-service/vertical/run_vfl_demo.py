import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from data.schema import SCHEMAS
from models.common import save_json
from vertical.psi import Party, intersect_many


def run(dataset="paysim_banks", sample_cap=12000, seed=42):
    schema = SCHEMAS[dataset]
    source = pd.read_parquet(Path("data/partitions") / dataset / "hfl_5" / "client_0" / "train.parquet")
    positives = source[source[schema.target] == 1]
    negatives = source[source[schema.target] == 0].sample(min(sample_cap - len(positives), len(source) - len(positives)), random_state=seed)
    frame = pd.concat([positives, negatives]).sample(frac=1, random_state=seed).reset_index(drop=True)
    rng = np.random.default_rng(seed)
    parties = {}
    for party, columns in schema.vfl_groups.items():
        selected = frame.loc[rng.random(len(frame)) < 0.92, [schema.record_col, *columns, *([schema.target] if party == "bank" else [])]]
        parties[party] = selected.drop_duplicates(schema.record_col)
    identifiers = intersect_many([Party(value[schema.record_col].astype(str).tolist()) for value in parties.values()])
    shared = set(identifiers)
    aligned = {name: value[value[schema.record_col].astype(str).isin(shared)].set_index(schema.record_col) for name, value in parties.items()}
    common = sorted(set.intersection(*(set(value.index) for value in aligned.values())))
    bank = aligned["bank"].loc[common]
    labels = bank[schema.target].astype(int)
    bank_features = pd.get_dummies(bank.drop(columns=[schema.target]), dummy_na=True).astype(float)
    combined = pd.concat([pd.get_dummies(value.loc[common].drop(columns=[schema.target], errors="ignore"), dummy_na=True).astype(float).add_prefix(name + "_") for name, value in aligned.items()], axis=1)
    train_indices, test_indices = train_test_split(range(len(common)), test_size=0.25, stratify=labels, random_state=seed)
    def evaluate(features):
        model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=300, class_weight="balanced", random_state=seed))
        model.fit(features.iloc[train_indices], labels.iloc[train_indices])
        return float(roc_auc_score(labels.iloc[test_indices], model.predict_proba(features.iloc[test_indices])[:, 1]))
    bank_auc = evaluate(bank_features)
    vfl_auc = evaluate(combined)
    result = {"aligned_n": len(common), "bank_only_auc": bank_auc, "vfl_auc": vfl_auc, "gain": vfl_auc - bank_auc, "psi": "hashed Diffie-Hellman educational simulation", "training": "aligned multi-party feature collaboration benchmark"}
    save_json(Path("runs") / "vfl_demo" / "summary.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="paysim_banks")
    arguments = parser.parse_args()
    print(run(arguments.dataset))
