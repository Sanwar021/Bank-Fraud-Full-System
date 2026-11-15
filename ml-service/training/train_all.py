import os
import sys
import json
import time
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    precision_recall_curve, auc, roc_auc_score, confusion_matrix
)

# Ensure path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from data.generator import generate_synthetic_transactions, FEATURE_COLUMNS
from features.pipeline import FeaturePipeline
from app.models.xgboost_model import XGBoostFraudClassifier
from app.models.isolation_forest import IsolationForestAnomalyDetector
from app.models.autoencoder import BehavioralAutoencoder

def train_and_export_all(artifacts_dir: str = "artifacts/v1"):
    print("==========================================================")
    print("      BANK INVESTIGATION: ML Pipeline Training Suite      ")
    print("==========================================================")
    
    os.makedirs(artifacts_dir, exist_ok=True)
    start_time = time.time()

    # 1. Generate Synthetic Transactions (50,000 samples, 2% fraud rate)
    print("\n[Step 1/6] Generating synthetic banking transactions...")
    df = generate_synthetic_transactions(n_samples=50000, fraud_rate=0.02, random_seed=42)
    print(f"Generated {len(df)} transactions. Fraud count: {df['is_fraud'].sum()} ({df['is_fraud'].mean()*100:.2f}%)")

    # 2. Train / Test Split (70/30)
    print("\n[Step 2/6] Splitting train and test sets (stratified)...")
    train_df, test_df = train_test_split(
        df, test_size=0.30, stratify=df["is_fraud"], random_state=42
    )

    # 3. Fit Feature Pipeline (StandardScaler)
    print("\n[Step 3/6] Fitting Feature Standardization Pipeline...")
    pipeline = FeaturePipeline()
    pipeline.fit(train_df[FEATURE_COLUMNS])
    scaler_path = os.path.join(artifacts_dir, "scaler.joblib")
    pipeline.save(scaler_path)
    print(f"Saved scaler to {scaler_path}")

    X_train = pipeline.transform(train_df)
    y_train = train_df["is_fraud"].values
    X_test = pipeline.transform(test_df)
    y_test = test_df["is_fraud"].values

    # Genuine-only subset for unsupervised anomaly models
    genuine_mask = (y_train == 0)
    X_train_genuine = X_train[genuine_mask]

    # 4. Train Model 1: XGBoost Supervised Classifier
    print("\n[Step 4/6] Training Model 1: Supervised XGBoost Classifier...")
    xgb_model = XGBoostFraudClassifier()
    xgb_model.fit(X_train, y_train, feature_names=FEATURE_COLUMNS)
    xgb_path = os.path.join(artifacts_dir, "xgboost.json")
    xgb_model.save(xgb_path)
    print(f"Saved XGBoost model to {xgb_path}")

    # 5. Train Model 2: Isolation Forest Unsupervised Detector
    print("\n[Step 5/6] Training Model 2: Unsupervised Isolation Forest...")
    iforest_model = IsolationForestAnomalyDetector()
    iforest_model.fit(X_train_genuine, feature_names=FEATURE_COLUMNS)
    iforest_path = os.path.join(artifacts_dir, "isolation_forest.joblib")
    iforest_model.save(iforest_path)
    print(f"Saved Isolation Forest to {iforest_path}")

    # 6. Train Model 3: PyTorch Sequence/Behavioral Autoencoder
    print("\n[Step 6/6] Training Model 3: PyTorch Behavioral Autoencoder...")
    autoencoder_model = BehavioralAutoencoder(input_dim=len(FEATURE_COLUMNS))
    autoencoder_model.fit(X_train_genuine, feature_names=FEATURE_COLUMNS, epochs=20, lr=0.003)
    ae_path = os.path.join(artifacts_dir, "autoencoder.pt")
    autoencoder_model.save(ae_path)
    print(f"Saved Autoencoder to {ae_path}")

    # --- EVALUATION ON TEST SET ---
    print("\n==========================================================")
    print("               MODEL EVALUATION METRICS                   ")
    print("==========================================================")

    # Evaluate XGBoost
    xgb_preds_prob = xgb_model.predict_proba_batch(X_test)
    xgb_preds_binary = (xgb_preds_prob >= 0.50).astype(int)

    precision = float(precision_score(y_test, xgb_preds_binary, zero_division=0))
    recall = float(recall_score(y_test, xgb_preds_binary, zero_division=0))
    f1 = float(f1_score(y_test, xgb_preds_binary, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, xgb_preds_prob))

    prec_curve, rec_curve, _ = precision_recall_curve(y_test, xgb_preds_prob)
    pr_auc = float(auc(rec_curve, prec_curve))

    cm = confusion_matrix(y_test, xgb_preds_binary).tolist()

    print(f"XGBoost Test Set Results:")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  PR-AUC:    {pr_auc:.4f}")
    print(f"  ROC-AUC:   {roc_auc:.4f}")
    print(f"  Confusion Matrix: {cm}")

    metadata = {
        "model_version": "v1.0.0",
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime()),
        "dataset_size": len(df),
        "test_size": len(test_df),
        "features": FEATURE_COLUMNS,
        "metrics": {
            "xgboost": {
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1_score": round(f1, 4),
                "pr_auc": round(pr_auc, 4),
                "roc_auc": round(roc_auc, 4),
                "confusion_matrix": cm,
            },
            "isolation_forest": {
                "contamination": 0.03,
                "n_estimators": 100,
            },
            "autoencoder": {
                "normal_mse_mean": round(autoencoder_model.normal_mse_mean, 4),
                "normal_mse_std": round(autoencoder_model.normal_mse_std, 4),
            },
        },
        "elapsed_seconds": round(time.time() - start_time, 2),
    }

    meta_path = os.path.join(artifacts_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nMetadata and evaluation report saved to {meta_path}")
    print(f"Total training pipeline completed in {metadata['elapsed_seconds']}s")

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "artifacts", "v1")
    train_and_export_all(out_dir)
