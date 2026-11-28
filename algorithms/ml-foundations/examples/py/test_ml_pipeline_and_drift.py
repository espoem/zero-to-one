from __future__ import annotations

import numpy as np
import pytest
from numpy.typing import NDArray
from pydantic import BaseModel, Field, ValidationError
from scipy.stats import ks_2samp
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


class FeatureSnapshotManifest(BaseModel):
    dataset_uri: str
    content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    row_count: int = Field(gt=0)
    schema_version: int = Field(ge=1)


def compute_psi(
    reference: NDArray[np.float64],
    actual: NDArray[np.float64],
    num_bins: int = 10,
    eps: float = 1e-6,
) -> float:
    """Compute Population Stability Index using fixed reference quantile bin edges."""
    quantiles = np.linspace(0.0, 1.0, num_bins + 1)
    edges = np.quantile(reference, quantiles)
    edges[0] = -np.inf
    edges[-1] = np.inf
    # Deduplicate identical quantile edges if ties exist
    edges = np.unique(edges)

    ref_counts, _ = np.histogram(reference, bins=edges)
    act_counts, _ = np.histogram(actual, bins=edges)

    ref_props = np.clip(ref_counts / len(reference), eps, None)
    act_props = np.clip(act_counts / len(actual), eps, None)

    return float(np.sum((act_props - ref_props) * np.log(act_props / ref_props)))


def test_numpy_strided_views_and_broadcasting() -> None:
    base = np.arange(12, dtype=np.float64).reshape(3, 4)
    assert base.strides == (32, 8)
    assert base.flags["C_CONTIGUOUS"]

    # Transpose is a zero-copy view reversing shape and strides
    transposed = base.T
    assert transposed.base is not None
    assert transposed.strides == (8, 32)
    assert not transposed.flags["C_CONTIGUOUS"]

    # Broadcasting subtracts per-column mean without tiling
    centered = base - base.mean(axis=0)
    assert centered.shape == (3, 4)
    assert np.allclose(centered.mean(axis=0), 0.0)


def test_pydantic_manifest_validation() -> None:
    valid = FeatureSnapshotManifest(
        dataset_uri="s3://ml-snapshots/fraud/2026-11-28.parquet",
        content_sha256="a" * 64,
        row_count=100_000,
        schema_version=2,
    )
    assert valid.row_count == 100_000

    with pytest.raises(ValidationError):
        FeatureSnapshotManifest(
            dataset_uri="s3://ml-snapshots/fraud/bad.parquet",
            content_sha256="not-a-hex-digest",
            row_count=0,
            schema_version=1,
        )


def test_leakage_free_pipeline_vs_pre_split_leakage_counterexample() -> None:
    rng = np.random.default_rng(42)
    # Pure noise features with an extreme test-half outlier scale shift
    n = 400
    x = rng.normal(0.0, 1.0, size=(n, 5))
    y = rng.integers(0, 2, size=n)

    # Negative check: pre-fitting scaler across train+test leaks global mean/variance
    leaky_scaler = StandardScaler()
    x_leaky = leaky_scaler.fit_transform(x)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    leaky_scores = cross_val_score(LogisticRegression(max_iter=500), x_leaky, y, cv=cv)

    # Leakage-free: scaler fit strictly inside each fold via Pipeline + ColumnTransformer
    prep = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), [0, 1, 2, 3, 4]),
        ],
        remainder="drop",
    )
    safe_pipe = Pipeline([("prep", prep), ("clf", LogisticRegression(max_iter=500))])
    safe_scores = cross_val_score(safe_pipe, x, y, cv=cv)

    assert len(leaky_scores) == 5 and len(safe_scores) == 5
    # Verify OneHotEncoder handle_unknown="ignore" survives unseen production categories
    train_cat = np.array([["retail"], ["travel"], ["dining"]], dtype=object)
    unseen_cat = np.array([["crypto"]], dtype=object)
    ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    ohe.fit(train_cat)
    encoded_unseen = ohe.transform(unseen_cat)
    assert np.allclose(encoded_unseen, np.zeros((1, 3)))


def test_pr_auc_exposes_skew_collapse_when_roc_auc_looks_high() -> None:
    rng = np.random.default_rng(7)
    n_neg = 9900
    n_pos = 100
    y_true = np.concatenate([np.zeros(n_neg, dtype=np.int64), np.ones(n_pos, dtype=np.int64)])

    # Negatives mostly low score, but 3% tail overlaps positives -> 300 false positives vs 85 TPs
    neg_scores = np.concatenate(
        [rng.uniform(0.0, 0.3, size=n_neg - 300), rng.uniform(0.65, 0.99, size=300)]
    )
    pos_scores = np.concatenate([rng.uniform(0.1, 0.4, size=15), rng.uniform(0.6, 0.95, size=85)])
    y_score = np.concatenate([neg_scores, pos_scores])

    roc_auc = roc_auc_score(y_true, y_score)
    pr_auc = average_precision_score(y_true, y_score)

    assert roc_auc > 0.90
    assert pr_auc < 0.35


def test_psi_and_ks_effect_size_drift_detection() -> None:
    rng = np.random.default_rng(123)
    ref = rng.normal(loc=0.0, scale=1.0, size=100_000)

    # Trivial 0.02 mean shift: negligible PSI, negligible KS effect size D, yet tiny p-value at N=100k!
    tiny_shift = rng.normal(loc=0.02, scale=1.0, size=100_000)
    psi_tiny = compute_psi(ref, tiny_shift)
    ks_tiny = ks_2samp(ref, tiny_shift, method="asymp")
    assert psi_tiny < 0.10
    assert ks_tiny.statistic < 0.02
    assert ks_tiny.pvalue < 0.01  # Demonstrates the large-N p-value trap

    # Major shift (mean +1.0 std): triggers both PSI > 0.25 and large KS effect size D
    major_shift = rng.normal(loc=1.0, scale=1.1, size=100_000)
    psi_major = compute_psi(ref, major_shift)
    ks_major = ks_2samp(ref, major_shift, method="asymp")
    assert psi_major > 0.25
    assert ks_major.statistic > 0.30
