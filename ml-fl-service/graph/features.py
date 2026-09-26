"""Per-institution graph features (plan §8.5).

Each bank computes dest_in_degree, dest_out_degree and orig_pagerank on ITS OWN
transaction subgraph only — raw counterparties never cross institutions. The
three placeholder columns in the processed frame are filled in place per client
partition, and on the global test split per-institution (each institution scores
its own test rows against its own graph).
"""
import argparse
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd

from data.schema import SCHEMAS
from settings import settings

GRAPH_COLUMNS = ["dest_in_degree", "dest_out_degree", "orig_pagerank"]


def _fill(frame, source_col="customer_id", target_col="counterparty_id"):
    graph = nx.DiGraph()
    graph.add_edges_from(frame[[source_col, target_col]].itertuples(index=False, name=None))
    in_degree = dict(graph.in_degree())
    out_degree = dict(graph.out_degree())
    pagerank = nx.pagerank(graph) if graph.number_of_nodes() else {}
    frame["dest_in_degree"] = frame[target_col].map(in_degree).fillna(0).astype(np.float32)
    frame["dest_out_degree"] = frame[target_col].map(out_degree).fillna(0).astype(np.float32)
    frame["orig_pagerank"] = frame[source_col].map(pagerank).fillna(0).astype(np.float32)
    return frame


def fill_client(root, client, schema):
    directory = root / "client_{}".format(client)
    train = pd.read_parquet(directory / "train.parquet")
    validation = pd.read_parquet(directory / "val.parquet")
    # One institution sees its full local ledger (train+val) — never other banks.
    combined = _fill(pd.concat([train, validation], ignore_index=True), schema.id_col, "counterparty_id")
    lookup = combined[[*GRAPH_COLUMNS]]
    train.loc[:, GRAPH_COLUMNS] = lookup.iloc[: len(train)].to_numpy()
    validation.loc[:, GRAPH_COLUMNS] = lookup.iloc[len(train) :].to_numpy()
    train.to_parquet(directory / "train.parquet", index=False)
    validation.to_parquet(directory / "val.parquet", index=False)
    return {"client": client, "train_rows": len(train), "nonzero_dest_in_degree": float((train["dest_in_degree"] > 0).mean())}


def fill_test(root, schema):
    path = root / "test.parquet"
    test = pd.read_parquet(path)
    parts = []
    for institution, group in test.groupby(schema.client_col):
        parts.append(_fill(group.copy(), schema.id_col, "counterparty_id"))
    pd.concat(parts).sort_index().to_parquet(path, index=False)
    return {"test_rows": len(test)}


def run(key="paysim_banks", clients=5):
    schema = SCHEMAS[key]
    root = Path(settings.PARTITIONS_DIR) / key / "hfl_{}".format(clients)
    report = [fill_client(root, client, schema) for client in range(clients)]
    report.append(fill_test(root, schema))
    return {"dataset": key, "partitions": report}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="paysim_banks")
    parser.add_argument("--clients", type=int, default=5)
    arguments = parser.parse_args()
    print(run(arguments.dataset, arguments.clients))
