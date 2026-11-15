import numpy as np
import pandas as pd
from typing import Tuple

FEATURE_COLUMNS = [
    "amount",
    "transaction_hour",
    "day_of_week",
    "is_weekend",
    "avg_transaction_amount",
    "tx_amount_deviation",
    "historical_tx_frequency",
    "is_new_beneficiary",
    "is_new_device",
    "is_new_ip",
    "geo_distance_km",
    "tx_count_1m",
    "tx_count_1h",
    "tx_count_24h",
    "tx_sum_1h",
    "tx_sum_24h",
    "balance_drain_ratio",
    "failed_login_count",
]

def generate_synthetic_transactions(
    n_samples: int = 50000,
    fraud_rate: float = 0.02,
    random_seed: int = 42,
) -> pd.DataFrame:
    """
    Generates realistic synthetic banking transactions with realistic genuine
    and fraudulent distributions.
    """
    np.random.seed(random_seed)
    
    n_fraud = int(n_samples * fraud_rate)
    n_genuine = n_samples - n_fraud

    # --- 1. GENUINE TRANSACTIONS ---
    # Customer baseline habits
    genuine_avg_amount = np.random.lognormal(mean=4.5, sigma=0.8, size=n_genuine)
    genuine_amount = genuine_avg_amount * np.random.uniform(0.3, 1.8, size=n_genuine)
    hour_probs = np.array([
        0.01, 0.01, 0.01, 0.01, 0.01, 0.02, 0.03, 0.05, 0.07, 0.08,
        0.08, 0.08, 0.08, 0.08, 0.07, 0.06, 0.06, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01
    ])
    hour_probs = hour_probs / np.sum(hour_probs)
    genuine_hour = np.random.choice(24, size=n_genuine, p=hour_probs)
    genuine_dow = np.random.choice(7, size=n_genuine)
    genuine_weekend = (genuine_dow >= 5).astype(int)
    genuine_freq = np.random.poisson(lam=15, size=n_genuine) + 1
    genuine_new_ben = (np.random.rand(n_genuine) < 0.08).astype(int)
    genuine_new_dev = (np.random.rand(n_genuine) < 0.03).astype(int)
    genuine_new_ip = (np.random.rand(n_genuine) < 0.05).astype(int)
    genuine_geo_dist = np.random.exponential(scale=15.0, size=n_genuine)
    genuine_cnt_1m = np.random.choice([0, 1], size=n_genuine, p=[0.95, 0.05])
    genuine_cnt_1h = np.random.poisson(lam=0.8, size=n_genuine)
    genuine_cnt_24h = genuine_cnt_1h + np.random.poisson(lam=2.5, size=n_genuine)
    genuine_sum_1h = genuine_amount * (genuine_cnt_1h + 1) * np.random.uniform(0.8, 1.1, size=n_genuine)
    genuine_sum_24h = genuine_sum_1h + np.random.exponential(scale=100.0, size=n_genuine)
    genuine_drain = np.random.beta(a=1.5, b=8.0, size=n_genuine)
    genuine_failed_logins = np.random.choice([0, 1, 2], size=n_genuine, p=[0.92, 0.07, 0.01])

    # --- 2. FRAUD TRANSACTIONS (Specific Typologies) ---
    # Typology A: Account Takeover (ATO) - high amount, odd hours, high drain, new device/IP, failed logins
    # Typology B: Velocity burst / smurfing - rapid small transactions
    # Typology C: Sudden high-value drain to unknown beneficiary
    fraud_avg_amount = np.random.lognormal(mean=4.2, sigma=0.9, size=n_fraud)
    
    # 40% ATO, 30% Velocity Smurfing, 30% Sudden High-Value Drain
    p_types = np.random.rand(n_fraud)
    fraud_amount = np.zeros(n_fraud)
    fraud_cnt_1m = np.zeros(n_fraud)
    fraud_cnt_1h = np.zeros(n_fraud)
    fraud_drain = np.zeros(n_fraud)
    fraud_hour = np.zeros(n_fraud, dtype=int)
    fraud_new_dev = np.zeros(n_fraud, dtype=int)
    fraud_new_ip = np.zeros(n_fraud, dtype=int)
    fraud_new_ben = np.zeros(n_fraud, dtype=int)
    fraud_failed_logins = np.zeros(n_fraud, dtype=int)
    fraud_geo_dist = np.zeros(n_fraud)

    for i in range(n_fraud):
        t = p_types[i]
        if t < 0.40:
            # ATO
            fraud_amount[i] = fraud_avg_amount[i] * np.random.uniform(3.5, 9.0)
            fraud_hour[i] = np.random.choice([0, 1, 2, 3, 4, 23])
            fraud_drain[i] = np.random.uniform(0.70, 0.98)
            fraud_new_dev[i] = 1
            fraud_new_ip[i] = 1
            fraud_new_ben[i] = 1
            fraud_failed_logins[i] = np.random.choice([2, 3, 4])
            fraud_geo_dist[i] = np.random.uniform(300.0, 2500.0)
            fraud_cnt_1m[i] = 1
            fraud_cnt_1h[i] = np.random.randint(1, 4)
        elif t < 0.70:
            # Rapid Velocity Smurfing
            fraud_amount[i] = np.random.uniform(40.0, 180.0)
            fraud_hour[i] = np.random.randint(0, 24)
            fraud_drain[i] = np.random.uniform(0.30, 0.75)
            fraud_new_dev[i] = np.random.choice([0, 1])
            fraud_new_ip[i] = np.random.choice([0, 1])
            fraud_new_ben[i] = 1
            fraud_failed_logins[i] = 0
            fraud_geo_dist[i] = np.random.uniform(20.0, 500.0)
            fraud_cnt_1m[i] = np.random.randint(3, 8)
            fraud_cnt_1h[i] = np.random.randint(8, 20)
        else:
            # Sudden high-value drain
            fraud_amount[i] = fraud_avg_amount[i] * np.random.uniform(5.0, 12.0)
            fraud_hour[i] = np.random.randint(0, 24)
            fraud_drain[i] = np.random.uniform(0.85, 0.99)
            fraud_new_dev[i] = 1
            fraud_new_ip[i] = 1
            fraud_new_ben[i] = 1
            fraud_failed_logins[i] = np.random.choice([0, 1, 3])
            fraud_geo_dist[i] = np.random.uniform(100.0, 1200.0)
            fraud_cnt_1m[i] = 1
            fraud_cnt_1h[i] = np.random.randint(1, 3)

    fraud_dow = np.random.choice(7, size=n_fraud)
    fraud_weekend = (fraud_dow >= 5).astype(int)
    fraud_freq = np.random.poisson(lam=12, size=n_fraud) + 1
    fraud_cnt_24h = fraud_cnt_1h + np.random.poisson(lam=6.0, size=n_fraud)
    fraud_sum_1h = fraud_amount * (fraud_cnt_1h + 1)
    fraud_sum_24h = fraud_sum_1h + np.random.exponential(scale=500.0, size=n_fraud)

    # Assemble DataFrames
    df_genuine = pd.DataFrame({
        "amount": genuine_amount,
        "transaction_hour": genuine_hour,
        "day_of_week": genuine_dow,
        "is_weekend": genuine_weekend,
        "avg_transaction_amount": genuine_avg_amount,
        "tx_amount_deviation": (genuine_amount - genuine_avg_amount) / genuine_avg_amount,
        "historical_tx_frequency": genuine_freq,
        "is_new_beneficiary": genuine_new_ben,
        "is_new_device": genuine_new_dev,
        "is_new_ip": genuine_new_ip,
        "geo_distance_km": genuine_geo_dist,
        "tx_count_1m": genuine_cnt_1m,
        "tx_count_1h": genuine_cnt_1h,
        "tx_count_24h": genuine_cnt_24h,
        "tx_sum_1h": genuine_sum_1h,
        "tx_sum_24h": genuine_sum_24h,
        "balance_drain_ratio": genuine_drain,
        "failed_login_count": genuine_failed_logins,
        "is_fraud": 0,
    })

    df_fraud = pd.DataFrame({
        "amount": fraud_amount,
        "transaction_hour": fraud_hour,
        "day_of_week": fraud_dow,
        "is_weekend": fraud_weekend,
        "avg_transaction_amount": fraud_avg_amount,
        "tx_amount_deviation": (fraud_amount - fraud_avg_amount) / fraud_avg_amount,
        "historical_tx_frequency": fraud_freq,
        "is_new_beneficiary": fraud_new_ben,
        "is_new_device": fraud_new_dev,
        "is_new_ip": fraud_new_ip,
        "geo_distance_km": fraud_geo_dist,
        "tx_count_1m": fraud_cnt_1m,
        "tx_count_1h": fraud_cnt_1h,
        "tx_count_24h": fraud_cnt_24h,
        "tx_sum_1h": fraud_sum_1h,
        "tx_sum_24h": fraud_sum_24h,
        "balance_drain_ratio": fraud_drain,
        "failed_login_count": fraud_failed_logins,
        "is_fraud": 1,
    })

    full_df = pd.concat([df_genuine, df_fraud], ignore_index=True)
    full_df = full_df.sample(frac=1.0, random_state=random_seed).reset_index(drop=True)
    
    return full_df

if __name__ == "__main__":
    df = generate_synthetic_transactions(n_samples=50000, fraud_rate=0.02)
    print(f"Generated dataset shape: {df.shape}")
    print(f"Class distribution:\n{df['is_fraud'].value_counts(normalize=True)}")
