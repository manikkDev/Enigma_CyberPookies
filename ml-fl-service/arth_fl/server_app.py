import numpy as np
from flwr.common import ndarrays_to_parameters
from flwr.server import ServerApp, ServerAppComponents, ServerConfig
from flwr.server.strategy import FedAvg, FedAdam


def server_fn(context):
    config = context.run_config
    rounds = int(config.get("num-server-rounds", 3))
    features = 23
    initial = ndarrays_to_parameters([np.zeros((1, features), dtype=np.float64), np.zeros(1, dtype=np.float64)])
    common = {"fraction_fit": 1.0, "fraction_evaluate": 1.0, "min_available_clients": int(config.get("clients", 5)), "initial_parameters": initial}
    strategy = FedAdam(**common) if config.get("strategy") == "fedadam" else FedAvg(**common)
    return ServerAppComponents(strategy=strategy, config=ServerConfig(num_rounds=rounds))


app = ServerApp(server_fn=server_fn)
