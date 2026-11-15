import os
import torch
import torch.nn as nn
import numpy as np
from typing import Tuple, List, Dict, Any

class PyTorchAutoencoderNet(nn.Module):
    def __init__(self, input_dim: int = 18, latent_dim: int = 8):
        super(PyTorchAutoencoderNet, self).__init__()
        
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.BatchNorm1d(32),
            nn.LeakyReLU(0.2),
            nn.Linear(32, 16),
            nn.LeakyReLU(0.2),
            nn.Linear(16, latent_dim),
        )
        
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 16),
            nn.LeakyReLU(0.2),
            nn.Linear(16, 32),
            nn.LeakyReLU(0.2),
            nn.Linear(32, input_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        latent = self.encoder(x)
        reconstruction = self.decoder(latent)
        return reconstruction

class BehavioralAutoencoder:
    def __init__(self, model_path: str = None, input_dim: int = 18):
        self.input_dim = input_dim
        self.net = PyTorchAutoencoderNet(input_dim=input_dim)
        self.feature_names = None
        self.normal_mse_mean = 0.25
        self.normal_mse_std = 0.15
        if model_path and os.path.exists(model_path):
            self.load(model_path)

    def fit(self, X: np.ndarray, feature_names: List[str] = None, epochs: int = 25, lr: float = 0.003):
        self.feature_names = feature_names
        tensor_x = torch.tensor(X, dtype=torch.float32)
        dataset = torch.utils.data.TensorDataset(tensor_x)
        loader = torch.utils.data.DataLoader(dataset, batch_size=128, shuffle=True)

        optimizer = torch.optim.Adam(self.net.parameters(), lr=lr, weight_decay=1e-5)
        criterion = nn.MSELoss()

        self.net.train()
        for epoch in range(epochs):
            for batch in loader:
                inputs = batch[0]
                outputs = self.net(inputs)
                loss = criterion(outputs, inputs)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

        # Compute baseline MSE distribution on training set
        self.net.eval()
        with torch.no_grad():
            recons = self.net(tensor_x)
            mse_per_sample = torch.mean((tensor_x - recons) ** 2, dim=1).numpy()
            self.normal_mse_mean = float(np.mean(mse_per_sample))
            self.normal_mse_std = float(np.std(mse_per_sample)) + 1e-6

    def predict_risk(self, X: np.ndarray) -> Tuple[float, float, List[Dict[str, Any]]]:
        """
        Returns:
            reconstruction_mse,
            normalized_risk_score (0 - 100),
            top_reconstruction_error_features
        """
        self.net.eval()
        with torch.no_grad():
            # For 1 sample evaluation, disable batchnorm tracking or evaluate with batch size > 1
            tensor_x = torch.tensor(X, dtype=torch.float32)
            # Replicate tensor if single sample to avoid batchnorm 1D error
            if tensor_x.shape[0] == 1:
                batch_tensor = torch.cat([tensor_x, tensor_x], dim=0)
                recons_batch = self.net(batch_tensor)
                recon = recons_batch[0:1]
            else:
                recon = self.net(tensor_x)

            diff_sq = ((tensor_x - recon) ** 2).numpy()[0]
            mse = float(np.mean(diff_sq))

        # Normalized risk based on distance from genuine manifold:
        # mse <= mean -> low risk (~0-20)
        # mse > mean + 3*std -> high risk (> 70)
        z = (mse - self.normal_mse_mean) / self.normal_mse_std
        normalized_risk = (z / 4.0) * 100.0
        normalized_risk = round(min(max(normalized_risk, 0.0), 100.0), 2)

        feature_errors = []
        if self.feature_names is not None:
            top_indices = np.argsort(diff_sq)[::-1][:4]
            for idx in top_indices:
                fname = self.feature_names[idx]
                err_val = float(diff_sq[idx])
                if err_val > 0.5:
                    feature_errors.append({
                        "feature": fname,
                        "reconstruction_error": round(err_val, 3),
                        "description": f"Feature '{fname}' exhibited anomalous deviation ({err_val:.2f} MSE)",
                    })

        return mse, normalized_risk, feature_errors

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        torch.save({
            "state_dict": self.net.state_dict(),
            "feature_names": self.feature_names,
            "normal_mse_mean": self.normal_mse_mean,
            "normal_mse_std": self.normal_mse_std,
            "input_dim": self.input_dim,
        }, filepath)

    def load(self, filepath: str):
        checkpoint = torch.load(filepath, map_location="cpu", weights_only=False)
        self.input_dim = checkpoint.get("input_dim", 18)
        self.net = PyTorchAutoencoderNet(input_dim=self.input_dim)
        self.net.load_state_dict(checkpoint["state_dict"])
        self.feature_names = checkpoint.get("feature_names")
        self.normal_mse_mean = checkpoint.get("normal_mse_mean", 0.25)
        self.normal_mse_std = checkpoint.get("normal_mse_std", 0.15)
        self.net.eval()
