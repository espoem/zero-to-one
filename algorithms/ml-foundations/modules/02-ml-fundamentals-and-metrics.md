# Module 02: ML Fundamentals & Evaluation Metrics

Choosing a model family or tuning hyperparameters without formalizing generalization bounds and decision-threshold economics leads to brittle classifiers that optimize the wrong proxy. This module formalizes supervised and unsupervised learning, derives the bias-variance decomposition and $L_1/L_2$ regularization geometry, constructs leakage-free `scikit-learn 1.9.1` pipelines (`Pipeline` + `ColumnTransformer`), and proves why ROC-AUC misleads under class skew through an imbalanced fraud-detection case study.

---

## 1. Formal Learning Setup & Generalization

### 1.1 Supervised vs. Unsupervised Formulation

- **Supervised learning**: Given i.i.d. samples $\mathcal{D} = \{(\mathbf{x}_i, y_i)\}_{i=1}^n \sim P(X, Y)^n$ with $\mathbf{x}_i \in \mathbb{R}^d$, Empirical Risk Minimization (ERM) chooses $h \in \mathcal{H}$ minimizing empirical risk $\hat{R}(h) = \frac{1}{n}\sum_{i=1}^n \ell(h(\mathbf{x}_i), y_i)$ as a proxy for true population risk $R(h) = \mathbb{E}_{(X,Y)\sim P}[\ell(h(X), Y)]$.
- **Unsupervised learning**: Given unlabeled samples $\{\mathbf{x}_i\}_{i=1}^n \sim P(X)^n$, recover latent structure—density estimation $p_\theta(\mathbf{x})$, low-rank subspaces (PCA), or cluster partitions ($k$-means, GMM, HDBSCAN).

### 1.2 Bias-Variance Decomposition

For regression under squared loss $\ell(\hat{y}, y) = (\hat{y} - y)^2$ where $y = f(\mathbf{x}) + \epsilon$ with $\mathbb{E}[\epsilon] = 0$ and $\mathrm{Var}(\epsilon) = \sigma^2$, the expected prediction error of estimator $\hat{f}_{\mathcal{D}}(\mathbf{x})$ across random training sets $\mathcal{D}$ decomposes exactly as:

$$\mathbb{E}_{\mathcal{D},\epsilon}\!\left[\left(y - \hat{f}_{\mathcal{D}}(\mathbf{x})\right)^2\right] = \underbrace{\left(\mathbb{E}_{\mathcal{D}}\!\left[\hat{f}_{\mathcal{D}}(\mathbf{x})\right] - f(\mathbf{x})\right)^2}_{\text{Bias}^2} + \underbrace{\mathbb{E}_{\mathcal{D}}\!\left[\left(\hat{f}_{\mathcal{D}}(\mathbf{x}) - \mathbb{E}_{\mathcal{D}}\!\left[\hat{f}_{\mathcal{D}}(\mathbf{x})\right]\right)^2\right]}_{\text{Variance}} + \underbrace{\sigma^2}_{\text{Irreducible Noise}}$$

- **High bias (underfitting)**: $\mathcal{H}$ is too constrained (e.g., linear model on XOR); training and validation errors both plateau high. Adding data alone does not fix bias—increase feature expressiveness or model capacity.
- **High variance (overfitting)**: $\mathcal{H}$ memorizes sample noise (e.g., unpruned deep decision tree); training error approaches zero while validation error rises. Fix via more data, stronger regularization, or ensembling (bagging reduces variance directly).

### 1.3 Regularization: $L_1$ (Lasso) vs. $L_2$ (Ridge)

Penalized ERM minimizes $\hat{R}(\mathbf{w}) + \lambda \Omega(\mathbf{w})$:

| Regularizer | Penalty $\Omega(\mathbf{w})$ | Closed Form (OLS) / Subgradient | Geometric & Optimization Effect |
| --- | --- | --- | --- |
| **$L_2$ (Ridge / Weight Decay)** | $\frac{1}{2}\lVert\mathbf{w}\rVert_2^2$ | $\hat{\mathbf{w}} = (X^\top X + \lambda I)^{-1}X^\top \mathbf{y}$ | Spherical constraint ball; shrinks correlated features proportionally; improves Hessian condition number $\kappa$ |
| **$L_1$ (Lasso)** | $\lVert\mathbf{w}\rVert_1 = \sum_j \lvert w_j\rvert$ | Soft-thresholding proximal step | Diamond constraint polytope with corners on axes; induces exact **sparse zeros** ($w_j = 0$) for feature selection |
| **Elastic Net** | $\alpha\lVert\mathbf{w}\rVert_1 + \frac{1-\alpha}{2}\lVert\mathbf{w}\rVert_2^2$ | Proximal gradient / coordinate descent | Preserves $L_1$ sparsity while grouping correlated predictors via $L_2$ convexity |

---

## 2. Leakage-Free `scikit-learn 1.9.1` Pipelines

In `scikit-learn 1.9.1`, composing `ColumnTransformer` inside a `Pipeline` enforces strict fold isolation during `cross_validate` or `GridSearchCV`: every transformer's `.fit()` runs solely on `X_train_fold`, while `.transform()` applies those frozen training parameters to `X_val_fold`.

```python
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

numeric_cols = ["amount_log", "tx_velocity_24h"]
categorical_cols = ["merchant_category", "country"]

preprocess = ColumnTransformer(
    transformers=[
        (
            "num",
            Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]),
            numeric_cols,
        ),
        (
            "cat",
            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            categorical_cols,
        ),
    ],
    remainder="drop",
)

clf = Pipeline([
    ("prep", preprocess),
    ("model", LogisticRegression(C=1.0, max_iter=1000)),
])
```

- **Why `handle_unknown="ignore"` matters**: Production inference routinely encounters unseen categories (`merchant_category = "NEW_CODE"`); failing to configure `ignore` raises a `ValueError` crash at serving time.
- **Why `remainder="drop"` matters**: Dropping unlisted columns prevents accidental pass-through of raw IDs or future target metadata appended upstream.

---

## 3. Classification, Calibration, and Regression Metrics

### 3.1 Confusion Matrix & Threshold Metrics

For binary labels $y \in \{0, 1\}$ and thresholded predictions $\hat{y} = \mathbb{I}(\hat{p} \ge \tau)$:

$$\text{Precision} = \frac{TP}{TP + FP}, \qquad \text{Recall (TPR)} = \frac{TP}{TP + FN}, \qquad \text{FPR} = \frac{FP}{FP + TN}$$

$$F_\beta = (1 + \beta^2)\,\frac{\text{Precision}\cdot\text{Recall}}{\beta^2\,\text{Precision} + \text{Recall}} \qquad (F_1:\ \beta = 1)$$

### 3.2 ROC-AUC vs. PR-AUC Under Class Skew

- **ROC-AUC** plots $\text{TPR}$ vs. $\text{FPR} = \frac{FP}{FP + TN}$ across all $\tau \in [0, 1]$. Notice that $\text{FPR}$ divides false positives by the **total negative count** $N_- = FP + TN$. When positives are `1%` ($N_- = 99{,}000$, $N_+ = 1{,}000$), `1,000` false alarms raise $\text{FPR}$ by only `0.01`, keeping ROC-AUC artificially high (`> 0.96`), even though **Precision collapses to 50%**.
- **PR-AUC (Average Precision)** plots $\text{Precision} = \frac{TP}{TP + FP}$ vs. $\text{Recall}$, directly penalizing every false positive against true positives regardless of $N_-$. Under severe class imbalance (fraud, anomaly detection, rare disease), **PR-AUC is the primary ranking metric**; ROC-AUC masks false-positive floods.

### 3.3 Calibration & Proper Scoring Rules

Ranking metrics (ROC-AUC, PR-AUC) are invariant to monotonic score transformations and do **not** verify whether $\hat{p} = 0.20$ means a `20%` empirical event rate. Use proper scoring rules whenever probabilities feed expected-value cost matrices ($\mathbb{E}[\text{Loss}] = \hat{p} \cdot C_{\text{fraud}}$):

- **Log-Loss (Binary Cross-Entropy)**: $-\frac{1}{n}\sum_{i=1}^n \left[y_i \ln \hat{p}_i + (1 - y_i)\ln(1 - \hat{p}_i)\right]$ — heavily penalizes confident wrong predictions.
- **Brier Score**: $\frac{1}{n}\sum_{i=1}^n (\hat{p}_i - y_i)^2$ — decomposes into calibration error + refinement.
- **Post-hoc calibration**: Apply Platt scaling (`CalibratedClassifierCV(method="sigmoid")`) or isotonic regression (`method="isotonic"`) on a held-out calibration split—never on the training fold.

### 3.4 Regression Metrics

| Metric | Formula | Sensitivity & Use Case |
| --- | --- | --- |
| **RMSE** | $\sqrt{\frac{1}{n}\sum_{i=1}^n (y_i - \hat{y}_i)^2}$ | Same units as $y$; quadratically penalizes large outliers |
| **MAE** | $\frac{1}{n}\sum_{i=1}^n \lvert y_i - \hat{y}_i\rvert$ | Robust to heavy-tailed outliers; optimizes conditional median |
| **$R^2$** | $1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$ | Fraction of variance explained vs. constant mean baseline; can be negative on OOD test sets |

---

## 4. Case Study: 1% Fraud Detection Decision Pipeline

Consider a payment gateway processing `100,000` transactions/day with a `1%` fraud base rate (`1,000` fraud cases, `99,000` legitimate), where each missed fraud costs `\$200` and each false-positive manual review or friction challenge costs `\$5`.

1. **Wrong objective (`accuracy` / default `tau = 0.5`)**: Predicting all-legitimate achieves `99.0%` accuracy while missing `100%` of fraud (`\$200,000/day` loss).
2. **Threshold optimization via expected cost**: Flagging a transaction is cost-optimal when $\hat{p}(\text{fraud} \mid \mathbf{x}) \cdot C_{FN} > (1 - \hat{p}(\text{fraud} \mid \mathbf{x})) \cdot C_{FP}$, yielding optimal Bayes threshold:

$$\tau^* = \frac{C_{FP}}{C_{FP} + C_{FN}} = \frac{5}{5 + 200} \approx 0.0244$$

3. **Metric stack**: Select model hyperparameters on `average_precision` (PR-AUC), verify probability calibration via Brier score + reliability diagram on a fresh time-ordered calibration window, and set $\tau$ to maximize net dollar savings rather than defaulting to `0.5`. (See [`examples/py/test_ml_pipeline_and_drift.py`](../examples/py/test_ml_pipeline_and_drift.py) for the executable proof.)

---

## 5. Interview Drill

### 1. Why does $L_1$ regularization produce exact zero weights while $L_2$ only shrinks weights toward zero?

<details><summary>Answer</summary>

Geometrically, the constrained optimization $\min \hat{R}(\mathbf{w})$ subject to $\lVert\mathbf{w}\rVert_1 \le t$ places loss level-set contours against a diamond polytope whose sharp vertices lie directly on the coordinate axes; tangency frequently occurs at those vertices where $w_j = 0$. Analytically, the subgradient of $\lambda\lvert w_j\rvert$ at $w_j = 0$ is $[-\lambda, +\lambda]$, trapping small gradient updates at exact zero via soft thresholding, whereas the gradient of $\frac{\lambda}{2}w_j^2$ vanishes as $w_j \to 0$.

</details>

### 2. A model achieves 0.97 ROC-AUC on a 0.2% positive-rate dataset, yet operations rejects it on day one. What likely happened?

<details><summary>Answer</summary>

At `0.2%` prevalence (`500:1` negative-to-positive ratio), even a `1%` false-positive rate generates `5` false positives per positive instance, capping Precision at `~16.7%` (or lower at moderate recall). ROC-AUC divides $FP$ by the huge negative population $N_-$, hiding the false-alarm flood that PR-AUC immediately exposes.

</details>

### 3. If your training error is 18% and your validation error is 19%, will collecting 10x more training data fix the model?

<details><summary>Answer</summary>

No. A tiny train-validation gap (`1%`) paired with high absolute error (`18%`) diagnoses **high bias (underfitting)**: the hypothesis class lacks capacity or informative features. Collecting more rows will keep both errors near `18–19%`. You need richer features, nonlinear interactions, reduced regularization $\lambda$, or a higher-capacity model family.

</details>

### 4. Why must `CalibratedClassifierCV` never be fitted on the same dataset used to train a tree ensemble like `RandomForest` or `GradientBoosting`?

<details><summary>Answer</summary>

In-sample predictions from high-capacity ensembles are overconfident (pushed toward `0` and `1`) relative to unseen data. Fitting Platt sigmoid or isotonic regression on those training predictions calibrates the overconfident training distribution rather than true out-of-sample generalization probabilities, worsening test Brier score and log-loss. Always calibrate on held-out folds or a dedicated time-split validation window.

</details>

### 5. Why is `R^2` negative on a test set even though it is bounded in `[0, 1]` on linear-regression training data?

<details><summary>Answer</summary>

On OLS training data with an intercept, residual sum of squares cannot exceed total variance around $\bar{y}_{\text{train}}$, guaranteeing $R^2 \in [0, 1]$. On a test set—especially under covariate shift or overfitting—model predictions can have higher MSE than simply predicting the test sample mean $\bar{y}_{\text{test}}$, making $\text{SS}_{\text{res}} / \text{SS}_{\text{tot}} > 1$ and therefore $R^2 < 0$.

</details>
