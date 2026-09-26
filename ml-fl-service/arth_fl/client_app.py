from pathlib import Path

import numpy as np
import pandas as pd
from flwr.client import ClientApp, NumPyClient
from sklearn.linear_model import SGDClassifier

from data.schema import SCHEMAS
from models.common import frame_to_matrix, sample_frame


def stable_matrix(frame, schema):
    matrix = frame_to_matrix(frame, schema)
    return (np.sign(matrix) * np.log1p(np.abs(matrix))).astype(np.float32)


class BankClient(NumPyClient):
    def __init__(self, context):
        config = context.run_config
        self.client_id = int(context.node_config["partition-id"])
        clients = int(context.node_config["num-partitions"])
        dataset = config.get("dataset", "paysim_banks")
        schema = SCHEMAS[dataset]
        root = Path(config.get("partitions-dir", "data/partitions")) / dataset / "hfl_{}".format(clients) / "client_{}".format(self.client_id)
        train = sample_frame(pd.read_parquet(root / "train.parquet"), schema.target, int(config.get("client-sample-cap", 30000)), 42 + self.client_id)
        validation = sample_frame(pd.read_parquet(root / "val.parquet"), schema.target, 10000, 142 + self.client_id)
        self.x_train = stable_matrix(train, schema)
        self.y_train = train[schema.target].to_numpy(np.int8)
        self.x_validation = stable_matrix(validation, schema)
        self.y_validation = validation[schema.target].to_numpy(np.int8)
        self.model = SGDClassifier(loss="log_loss", class_weight="balanced", random_state=42 + self.client_id)
        self.model.partial_fit(self.x_train[:2], self.y_train[:2], classes=np.array([0, 1]))

    def get_parameters(self, config):
        return [self.model.coef_.copy(), self.model.intercept_.copy()]

    def set_parameters(self, parameters):
        self.model.coef_ = parameters[0].copy()
        self.model.intercept_ = parameters[1].copy()

    def fit(self, parameters, config):
        self.set_parameters(parameters)
        self.model.partial_fit(self.x_train, self.y_train)
        return self.get_parameters({}), len(self.y_train), {"client_id": self.client_id}

    def evaluate(self, parameters, config):
        self.set_parameters(parameters)
        probabilities = self.model.predict_proba(self.x_validation)[:, 1]
        loss = float(-np.mean(self.y_validation * np.log(probabilities + 1e-7) + (1 - self.y_validation) * np.log(1 - probabilities + 1e-7)))
        return loss, len(self.y_validation), {"client_id": self.client_id}


def client_fn(context):
    return BankClient(context).to_client()


app = ClientApp(client_fn=client_fn)
