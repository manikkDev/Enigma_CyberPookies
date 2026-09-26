"""Torch MLP shared across the federated runner, baselines and calibration.

Parameter convention: a flat vector packed as all weight matrices (in, out order,
matching sklearn's coefs_ convention) followed by all bias vectors. This is the
same layout ``models.inference.forward`` consumes, so artifacts stay compatible.
"""
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

HIDDEN_LAYERS = (48, 24)


def layer_sizes(n_features):
    return [n_features, *HIDDEN_LAYERS, 1]


class RiskMLP(nn.Module):
    def __init__(self, n_features, hidden=HIDDEN_LAYERS):
        super().__init__()
        sizes = layer_sizes(n_features)
        layers = []
        for index in range(len(sizes) - 1):
            layers.append(nn.Linear(sizes[index], sizes[index + 1]))
            if index < len(sizes) - 2:
                layers.append(nn.ReLU())
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x).squeeze(-1)


def build_model(n_features, seed=0):
    torch.manual_seed(seed)
    return RiskMLP(n_features)


def pack_state(model):
    weights = [layer.weight.detach().numpy().T.ravel() for layer in model.net if isinstance(layer, nn.Linear)]
    biases = [layer.bias.detach().numpy().ravel() for layer in model.net if isinstance(layer, nn.Linear)]
    return np.concatenate([*weights, *biases]).astype(np.float64)


def unpack_state(model, vector):
    vector = np.asarray(vector, dtype=np.float64)
    sizes = [layer for layer in model.net if isinstance(layer, nn.Linear)]
    offset = 0
    for layer in sizes:
        count = layer.in_features * layer.out_features
        weight = vector[offset : offset + count].reshape(layer.in_features, layer.out_features)
        layer.weight.data = torch.tensor(weight.T, dtype=torch.float32)
        offset += count
    for layer in sizes:
        count = layer.out_features
        layer.bias.data = torch.tensor(vector[offset : offset + count], dtype=torch.float32)
        offset += count
    return model


def train_local(matrix, labels, global_vector, epochs, seed, proximal_mu=0.0,
                lr=3e-3, batch_size=512, pos_weight=8.0):
    """One institution's local training. Returns the parameter *delta*.

    ``proximal_mu`` applies the true FedProx proximal term
    ``(mu / 2) * ||theta - theta_global||^2`` inside the loss.
    """
    torch.manual_seed(seed)
    model = unpack_state(build_model(matrix.shape[1], seed), global_vector)
    x = torch.tensor(matrix, dtype=torch.float32)
    y = torch.tensor(labels.astype(np.float32))
    loader = DataLoader(TensorDataset(x, y), batch_size=batch_size, shuffle=True,
                        generator=torch.Generator().manual_seed(seed))
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(float(pos_weight)))
    global_params = [p.detach().clone() for p in model.parameters()]
    model.train()
    for _ in range(int(epochs)):
        for xb, yb in loader:
            loss = criterion(model(xb), yb)
            if proximal_mu:
                prox = sum(torch.sum((p - g) ** 2) for p, g in zip(model.parameters(), global_params))
                loss = loss + (proximal_mu / 2) * prox
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
    return pack_state(model) - np.asarray(global_vector, dtype=np.float64)


def predict_logits(model, matrix):
    model.eval()
    with torch.no_grad():
        return model(torch.tensor(matrix, dtype=torch.float32)).numpy()


def predict_proba(model, matrix):
    return 1 / (1 + np.exp(-np.clip(predict_logits(model, matrix), -30, 30)))
