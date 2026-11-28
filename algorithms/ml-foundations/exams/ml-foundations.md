# Machine Learning Foundations: Examination Question Bank & Timed Mock Exam

This original preparation bank tests competency across all six domains in [`exams/README.md`](README.md), aligned with Senior ML Engineer interview loops and overlapping domains of **AWS Certified Machine Learning Engineer – Associate (`MLA-C01`)**.

- **Bank scope**: **60 original questions** (`Q-MLF-001` through `Q-MLF-060`) in sequential reading order, spanning `single`, `multi`, `scenario`, and `ordering` formats across difficulty levels `1` (foundational mechanics), `2` (senior trade-offs), and `3` (staff-level quantitative calculations and subtle failure modes).
- **Timed simulation**: Complete the [40-Question Timed Mock Exam](#timed-mock-exam-40-questions--60-minutes) under a 60-minute timer before revealing `<details>` answer blocks.

---

## Domain 1: Numerical Computing, Pipelines & Data Lineage (`Q-MLF-001`–`Q-MLF-009`)

### Q-MLF-001 · Numerical Computing, Pipelines & Data Lineage · difficulty 1 · single

A C-order `float64` NumPy `ndarray` has `shape=(4, 5)` (`itemsize=8` bytes). What is its `strides` tuple in bytes, and what happens to `strides` if you take the transpose view `arr.T`?

- A) `strides=(8, 32)` initially, and `arr.T` allocates a contiguous copy with `strides=(40, 8)`.
- B) `strides=(40, 8)` initially, and `arr.T` returns an $O(1)$ zero-copy view with `strides=(8, 40)`.
- C) `strides=(5, 1)` initially, and `arr.T` returns a view with `strides=(1, 5)`.
- D) `strides=(40, 8)` initially, and `arr.T` keeps `strides=(40, 8)` while reordering the raw heap buffer in place.

<details><summary>Answer</summary>

**B.** In row-major C-order, stepping one element along axis 1 advances `8` bytes (`itemsize`), and stepping one row along axis 0 skips `5 * 8 = 40` bytes (`strides=(40, 8)`). `arr.T` flips `shape` to `(5, 4)` and `strides` to `(8, 40)` in $O(1)$ without copying memory.

- Why not A: `(8, 32)` swaps column-major strides and uses `4` instead of `5`; `.T` never copies.
- Why not C: NumPy strides are always measured in bytes, not element counts.
- Why not D: `.T` never mutates or reorders the underlying byte buffer.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://numpy.org/doc/stable/dev/internals.html

</details>

### Q-MLF-002 · Numerical Computing, Pipelines & Data Lineage · difficulty 2 · single

You slice a `10,000 x 10,000` C-contiguous array `X` via `V = X.T` and then execute `flat = V.reshape(-1)`. Which statement describes memory behavior and mutation semantics?

- A) `V.reshape(-1)` returns a zero-copy view because `V` is already 2D.
- B) `V.reshape(-1)` allocates an $O(N)$ copy because `V` has non-contiguous strides `(8, 80000)` that cannot be represented as a single 1D byte stride, so mutating `flat[0]` does not modify `X`.
- C) `V.reshape(-1)` raises a `ValueError` unless `np.ascontiguousarray(V)` is called first.
- D) Both `X.T` and `V.reshape(-1)` mutate `X` in place to sort elements into column-major order.

<details><summary>Answer</summary>

**B.** A 1D array requires one constant byte stride. Because `X.T` is Fortran-contiguous (`strides=(8, 80000)`), flattening in C-order requires walking column-by-column across non-adjacent memory offsets, forcing `reshape(-1)` to allocate and copy into a new contiguous buffer.

- Why not A: Being 2D does not make a transposed buffer 1D-stridable in row-major order.
- Why not C: `reshape` silently falls back to copying rather than raising an error (`V.shape = (-1,)` raises `AttributeError` when incompatible without copy).
- Why not D: Neither `.T` nor `.reshape` mutates the original buffer.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://numpy.org/doc/stable/reference/generated/numpy.ndarray.reshape.html

</details>

### Q-MLF-003 · Numerical Computing, Pipelines & Data Lineage · difficulty 2 · single

How does NumPy evaluate `Z = X - X.mean(axis=0)` when `X` has shape `(500_000, 64)` (`float64`) without materializing an intermediate `500,000 x 64` mean matrix?

- A) It forks 64 Python threads and calls `float.__sub__` on each column.
- B) It right-aligns `(64,)` to `(1, 64)` and assigns `stride = 0` bytes on axis 0 of the mean view so the SIMD C ufunc reads the same 64 floats across all 500,000 rows.
- C) It pads the smaller array with zeros in RAM until both shapes equal `(500_000, 64)`.
- D) It converts `X` into a Python `list` of tuples to avoid shape mismatch errors.

<details><summary>Answer</summary>

**B.** NumPy broadcasting sets stride `0` along any unit/missing broadcast axis, repeating the 64-element row virtually inside the vectorized C loop at $O(1)$ extra memory beyond the output array `Z`.

- Why not A: Pure Python object loops would box 32M floats and acquire the GIL per scalar.
- Why not C: Broadcasting never allocates a padded or tiled intermediate copy of the smaller operand.
- Why not D: Converting to lists destroys contiguous SIMD performance.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://numpy.org/doc/stable/user/basics.broadcasting.html

</details>

### Q-MLF-004 · Numerical Computing, Pipelines & Data Lineage · difficulty 2 · scenario

A hospital readmission model splits 100,000 inpatient encounter rows using random 5-fold `StratifiedKFold`. Many patients have 4–8 encounters across the dataset, and validation AUC hits `0.94` while live hospital rollout drops to `0.68`. What caused the offline/online gap, and what is the fix?

- A) `StratifiedKFold` leaked patient-specific patterns and comorbidities across train and validation folds; switch to `StratifiedGroupKFold` (or chronological patient split) grouped by `patient_id`.
- B) `float64` precision overflowed inside `StratifiedKFold`; switch to `float32`.
- C) `StratifiedKFold` dropped minority-class encounters; switch to unstratified `KFold`.
- D) Random splitting cannot cause leakage unless the target column `y` is duplicated as a feature.

<details><summary>Answer</summary>

**A.** Random row-level splitting places encounters from the same patient in both train and validation folds (**group leakage**), letting the model memorize patient identifiers/demographics rather than clinical progression. Grouping folds by `patient_id` ensures unseen patients at validation time.

- Why not B: Fold splitting uses integer indices, not floating-point arithmetic.
- Why not C: `StratifiedKFold` preserves every class sample across folds.
- Why not D: Entity overlap and temporal lookahead leak heavily even without copying the target label.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://scikit-learn.org/stable/modules/cross_validation.html#stratifiedgroupkfold

</details>

### Q-MLF-005 · Numerical Computing, Pipelines & Data Lineage · difficulty 3 · scenario

A fraud team builds an offline training table using `SELECT user_id, COUNT(*) AS chargebacks_30d FROM events GROUP BY user_id` and joins it to historical checkout transactions. Offline PR-AUC reaches `0.98`, yet live inference produces `0.41` PR-AUC. Why?

- A) SQL `COUNT(*)` returns `int64` instead of `float64`, causing scikit-learn integer truncation.
- B) Global `GROUP BY` aggregates future chargebacks occurring after checkout timestamp $t_0$ (**temporal target leakage**); it must be replaced by a point-in-time `ASOF` window strictly bounded to $[t_0 - 30\text{d}, t_0)$.
- C) `COUNT(*)` fails to normalize by user age, which requires `StandardScaler`.
- D) Online inference cannot query SQL databases, so the feature should be dropped entirely.

<details><summary>Answer</summary>

**B.** Aggregating across all time leaks future chargebacks (including the label of the checkout row itself!) into historical rows. Point-in-time `ASOF` joins restrict aggregations strictly to events stamped before $t_0$.

- Why not A: Scikit-learn casts numeric features to floating-point cleanly without truncating counts.
- Why not C: Scaling does not repair temporal leakage.
- Why not D: Historical 30-day chargeback counts computed strictly prior to $t_0$ are valid and highly predictive in online feature stores.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://scikit-learn.org/stable/common_pitfalls.html

</details>

### Q-MLF-006 · Numerical Computing, Pipelines & Data Lineage · difficulty 2 · multi

Which **two** practices keep dataset lineage reproducible and scalable in production ML teams?

- A) Committing 4 GB Parquet training snapshots directly into Git history with `git add -f`.
- B) Using `DVC 3.67.1` `.dvc` pointer files (storing size and content hash in Git while offloading blobs to S3/GCS) or LakeFS copy-on-write object-store branches for petabyte tables.
- C) Validating incoming dataset schemas, types, and non-null/monotonicity invariants via typed contracts (`Pydantic 2.14.4`) before feature computation.
- D) Pulling the mutable `latest.parquet` S3 key at training time without recording an immutable content digest or snapshot ID.

<details><summary>Answer</summary>

**B, C.** Content-addressed manifests (`DVC` / LakeFS) decouple large binary artifacts from Git while guaranteeing deterministic checkouts, and schema contracts (`Pydantic`) catch silent upstream column drift before training wastes GPU hours.

- Why not A: Checking multi-gigabyte binary shards into Git bloats packfiles and breaks repository clones.
- Why not D: Mutable `latest` pointers destroy reproducibility when rolling back or auditing past models.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://dvc.org/doc

</details>

### Q-MLF-007 · Numerical Computing, Pipelines & Data Lineage · difficulty 2 · single

Why does `numpy` `2.5.5` + `scipy` `1.18.1` force a minimum `requires-python = ">=3.12"` floor in `pyproject.toml` even though `dvc 3.67.1` supports `>=3.9`?

- A) `uv` always selects the lowest `requires-python` among dependencies.
- B) The effective Python floor for an environment is the **intersection** (maximum minimum bound) of all resolved runtime packages, and both `numpy 2.5.5` and `scipy 1.18.1` dropped Python `<3.12`.
- C) `pydantic 2.14.4` requires Python `>=3.14`.
- D) `dvc` blocks `numpy` upgrades unless `python = "3.9"` is pinned.

<details><summary>Answer</summary>

**B.** An environment must satisfy every installed package's `requires-python` constraint simultaneously, so the strictest lower bound (`>=3.12` from NumPy/SciPy) governs the environment.

- Why not A: Dependency resolvers enforce the intersection (highest minimum version), not the lowest.
- Why not C: `pydantic 2.14.4` requires `>=3.10`.
- Why not D: `dvc` requires `>=3.9`, which `3.12+` satisfies cleanly.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://packaging.python.org/en/latest/specifications/core-metadata/

</details>

### Q-MLF-008 · Numerical Computing, Pipelines & Data Lineage · difficulty 1 · single

Which NumPy indexing operation is guaranteed to return a **copy** rather than a view?

- A) `a[:, 1:5]` (basic slice)
- B) `a.T` (transpose)
- C) `a[a > 0]` (boolean mask indexing)
- D) `a[::2]` (strided slice)

<details><summary>Answer</summary>

**C.** Boolean masking and integer fancy indexing (`a[[0, 3]]`) select arbitrary non-uniform positions that cannot be described by a fixed `(shape, strides)` tuple, so NumPy always allocates and returns a new copy.

- Why not A: Basic contiguous or strided slices modify only `(offset, shape, strides)` and return views.
- Why not B: `.T` swaps shape and strides in $O(1)$ as a view.
- Why not D: Step `2` simply doubles the stride along axis 0, returning a view.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://numpy.org/doc/stable/user/basics.copies.html

</details>

### Q-MLF-009 · Numerical Computing, Pipelines & Data Lineage · difficulty 3 · ordering

Arrange the steps of a leakage-free time-series tabular ML pipeline in strict execution order:

- A) Compute rolling features strictly inside `[t - W, t)` via `ASOF` join -> Partition chronologically into train/val/test -> Fit `ColumnTransformer` on train fold only -> Evaluate frozen pipeline on future test window.
- B) Fit `StandardScaler` on full dataset -> Partition chronologically -> Compute global `GROUP BY` user averages -> Evaluate on random 5-fold CV.
- C) Partition randomly -> Fit `OneHotEncoder` on test set -> Train model -> Compute `ASOF` join.
- D) Compute `ASOF` join -> Train model on full dataset -> Split predictions into train/test -> Fit `SimpleImputer` on test.

<details><summary>Answer</summary>

**A.** Point-in-time `ASOF` joins first ensure zero lookahead inside row features; chronological partitioning prevents future regimes from leaking backward; fitting preprocessing strictly on the training split isolates validation/test moments; evaluating the frozen pipeline measures true out-of-time generalization.

- Why not B: Fitting `StandardScaler` globally and using global `GROUP BY` both leak future data, and random CV breaks temporal ordering.
- Why not C: Random partitioning and fitting encoders on test data both violate temporal and test isolation.
- Why not D: Training on the full dataset before splitting invalidates evaluation completely.
- Ref: [modules/01-python-for-ai-and-data-engineering.md](../modules/01-python-for-ai-and-data-engineering.md), https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html

</details>

---

## Domain 2: Classical ML Theory, Pipelines & Evaluation Metrics (`Q-MLF-010`–`Q-MLF-019`)

### Q-MLF-010 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 2 · single

In the bias-variance decomposition under squared loss $y = f(\mathbf{x}) + \epsilon$ ($\mathrm{Var}(\epsilon) = \sigma^2$), a depth-2 decision tree achieves `22%` training error and `23%` validation error. Which diagnosis and intervention is correct?

- A) High variance; collect 5x more training rows without changing the model.
- B) High bias (underfitting); increase model capacity (deeper trees / gradient boosting) or add nonlinear interaction features.
- C) High irreducible noise $\sigma^2$; increase $L_2$ regularization penalty $\lambda$.
- D) Severe data leakage; remove cross-validation.

<details><summary>Answer</summary>

**B.** Both training and validation errors are high with nearly zero generalization gap (`1%`), demonstrating **high bias**. More data or stronger regularization will not fix an under-parameterized hypothesis class; increasing expressiveness or feature interactions reduces bias.

- Why not A: Collecting more rows shrinks variance, not structural approximation bias.
- Why not C: Increasing regularization further restricts capacity and worsens high bias.
- Why not D: Leakage inflates validation metrics artificially rather than leaving both train and validation high.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://hastie.su.domains/ElemStatLearn/

</details>

### Q-MLF-011 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 2 · single

Why does $L_1$ (Lasso) regression drive irrelevant weights to exact zero while $L_2$ (Ridge) shrinks weights toward zero without exact sparsity?

- A) $L_1$ uses a spherical constraint ball that touches axes only at infinity.
- B) The $L_1$ norm diamond polytope places sharp vertices on coordinate axes (and its subgradient at $0$ is $[-\lambda, +\lambda]$ via soft thresholding), whereas $L_2$'s smooth hypersphere has gradient $\lambda w_j \to 0$ near the origin.
- C) $L_2$ is non-convex and therefore cannot converge to zero.
- D) $L_1$ ignores feature scaling while $L_2$ requires `OneHotEncoder`.

<details><summary>Answer</summary>

**B.** Tangency with the $L_1$ diamond vertices sets coordinates to exact zero, mirrored algebraically by soft thresholding in proximal/coordinate descent. $L_2$ is smooth and isotropic, distributing shrinkage proportionally across correlated predictors.

- Why not A: $L_2$ has the spherical ball; $L_1$ has the diamond polytope.
- Why not C: Ridge ($L_2$) is strictly convex and admits a unique closed-form solution $(X^\top X + \lambda I)^{-1}X^\top \mathbf{y}$.
- Why not D: Both $L_1$ and $L_2$ penalties depend directly on feature scale and require standardization (`StandardScaler`).
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/linear_model.html#lasso

</details>

### Q-MLF-012 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 3 · scenario

You train a fraud classifier on `100,000` transactions (`1%` fraud base rate = `1,000` positives, `99,000` negatives). At threshold $\tau = 0.60$, the model flags `850` true frauds and `990` false positives. What are its $\text{FPR}$, $\text{Recall}$, and $\text{Precision}$, and why does ROC-AUC stay above `0.95` despite noisy alerts?

- A) $\text{FPR} = 0.01$, $\text{Recall} = 0.85$, $\text{Precision} = 0.462$; ROC-AUC stays high because $\text{FPR} = \frac{FP}{FP+TN}$ divides by $99{,}000$ negatives, masking that over half of flagged alerts (`990 / 1840`) are false alarms.
- B) $\text{FPR} = 0.538$, $\text{Recall} = 0.85$, $\text{Precision} = 0.99$; ROC-AUC stays high because Precision is `99%`.
- C) $\text{FPR} = 0.01$, $\text{Recall} = 0.462$, $\text{Precision} = 0.85$; PR-AUC hides the false positives.
- D) $\text{FPR} = 0.001$, $\text{Recall} = 0.99$, $\text{Precision} = 0.85$; ROC-AUC and PR-AUC give identical rankings here.

<details><summary>Answer</summary>

**A.** $\text{FPR} = 990 / 99{,}000 = 0.01$, $\text{Recall} = 850 / 1{,}000 = 0.85$, and $\text{Precision} = 850 / (850 + 990) \approx 0.462$. Because $N_- = 99{,}000$ dominates the denominator of $\text{FPR}$, huge false-positive volumes move $\text{FPR}$ minimally, inflating ROC-AUC while PR-AUC exposes the `46.2%` precision drop.

- Why not B: Swaps FPR and Precision definitions.
- Why not C: Swaps Recall and Precision values, and PR-AUC is the metric that exposes (not hides) false positives.
- Why not D: Numerical values do not match confusion counts, and ROC/PR curves diverge sharply under skew.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0118432

</details>

### Q-MLF-013 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 2 · single

In `scikit-learn 1.9.1`, why should `OneHotEncoder(handle_unknown="ignore")` and `ColumnTransformer(..., remainder="drop")` be configured inside a `Pipeline` for production serving?

- A) `handle_unknown="ignore"` drops the entire row if an unseen category arrives, while `remainder="drop"` averages numeric columns.
- B) `handle_unknown="ignore"` encodes unseen production categories as all-zero indicator vectors instead of raising `ValueError`, and `remainder="drop"` prevents unvetted upstream columns (IDs/timestamps) from leaking into the estimator.
- C) Both flags are required solely for GPU acceleration in scikit-learn.
- D) `remainder="drop"` automatically performs $L_1$ feature selection during `.transform()`.

<details><summary>Answer</summary>

**B.** Production streams constantly introduce novel categorical tokens and upstream schema additions. `handle_unknown="ignore"` fails gracefully into zero-vectors rather than crashing inference, and `remainder="drop"` enforces an explicit feature allowlist.

- Why not A: Neither drops rows nor averages columns.
- Why not C: Scikit-learn `OneHotEncoder` and `ColumnTransformer` run on CPU arrays.
- Why not D: `remainder="drop"` excludes unlisted columns by name/index, not $L_1$ optimization.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/generated/sklearn.compose.ColumnTransformer.html

</details>

### Q-MLF-014 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 3 · single

A fraud review queue incurs a `\$10` false-positive inspection cost ($C_{FP} = 10$) and a `\$490` missed-fraud loss ($C_{FN} = 490$). Assuming well-calibrated predicted probabilities $\hat{p}$, what is the Bayes cost-optimal decision threshold $\tau^*$?

- A) `0.50`
- B) `0.02` ($\frac{10}{10 + 490}$)
- C) `0.98` ($\frac{490}{10 + 490}$)
- D) `0.002`

<details><summary>Answer</summary>

**B.** Flagging is optimal when expected loss of approving ($\hat{p}\cdot C_{FN}$) exceeds expected cost of blocking/reviewing ($(1 - \hat{p})\cdot C_{FP}$), giving $\tau^* = \frac{C_{FP}}{C_{FP} + C_{FN}} = \frac{10}{10 + 490} = 0.02$.

- Why not A: `0.50` assumes symmetric costs ($C_{FP} = C_{FN}$).
- Why not C: `0.98` inverts the ratio, blocking almost no fraud.
- Why not D: Off by a factor of `10x`.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/model_evaluation.html

</details>

### Q-MLF-015 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 2 · multi

Which **two** statements accurately describe probability calibration and proper scoring rules?

- A) A classifier with `0.95` ROC-AUC is guaranteed to have calibrated probabilities (`Brier score < 0.05`).
- B) **Log-loss** and **Brier score** are proper scoring rules minimized uniquely by the true conditional probabilities $P(Y=1\mid X)$.
- C) Fitting `CalibratedClassifierCV` on the training split of a random forest produces unbiased probability calibration.
- D) Ranking metrics (ROC-AUC, PR-AUC) are invariant to strictly increasing score transformations such as $p \mapsto p^{0.2}$, whereas Brier score and log-loss penalize miscalibration directly.

<details><summary>Answer</summary>

**B, D.** Proper scoring rules reward accurate probability magnitudes, whereas AUC metrics only measure rank ordering. Calibration must always be fit on out-of-fold or held-out validation splits.

- Why not A: Multiplying all scores by `0.01` preserves `0.95` ROC-AUC while destroying calibration.
- Why not C: Training predictions from expressive trees are overconfident; calibrating on them transfers overconfidence to test data.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/calibration.html

</details>

### Q-MLF-016 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 1 · single

For a home-price regression model where extreme luxury-home outliers (`5x` median) should **not** dominate gradient updates or evaluation, which metric optimizes the conditional median rather than the conditional mean?

- A) RMSE
- B) $R^2$
- C) MAE ($\frac{1}{n}\sum \lvert y_i - \hat{y}_i\rvert$)
- D) Log-loss

<details><summary>Answer</summary>

**C.** Minimizing expected absolute error $\mathbb{E}[\lvert Y - \hat{y}\rvert \mid X]$ yields the conditional median, making MAE robust to heavy-tailed target outliers compared to squared-error RMSE.

- Why not A: Squaring residuals makes RMSE highly sensitive to outliers and optimizes the conditional mean.
- Why not B: $R^2$ is a normalized squared-error ratio, equally sensitive to outliers.
- Why not D: Log-loss applies to probabilistic classification, not continuous regression.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/model_evaluation.html#regression-metrics

</details>

### Q-MLF-017 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 2 · single

How can test-set $R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$ become **negative** on a held-out evaluation split?

- A) Negative $R^2$ is mathematically impossible for any squared-error formula.
- B) When the model's test MSE exceeds the variance of test targets around $\bar{y}_{\text{test}}$ (worse than predicting a constant mean), $\text{SS}_{\text{res}} > \text{SS}_{\text{tot}}$, yielding $R^2 < 0$.
- C) Whenever `StandardScaler` is omitted from the pipeline.
- D) Only when targets $y_i$ are negative numbers.

<details><summary>Answer</summary>

**B.** While OLS with an intercept guarantees $R^2 \in [0, 1]$ on the training set, an overfit or shifted model evaluated out-of-sample can perform worse than the naive mean baseline $\bar{y}_{\text{test}}$, making $1 - \text{SS}_{\text{res}}/\text{SS}_{\text{tot}} < 0$.

- Why not A: The upper bound is `1`, but there is no lower bound at `0` out-of-sample.
- Why not C: Scaling alone does not prevent negative $R^2$ under distribution shift or overfitting.
- Why not D: $R^2$ depends on residuals $(y_i - \hat{y}_i)^2$, not the sign of $y_i$.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/generated/sklearn.metrics.r2_score.html

</details>

### Q-MLF-018 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 2 · single

Why is Elastic Net ($\alpha\lVert\mathbf{w}\rVert_1 + \frac{1-\alpha}{2}\lVert\mathbf{w}\rVert_2^2$) often preferred over pure Lasso ($L_1$) when features include strongly correlated pairs (e.g., `tx_1h` and `tx_2h`)?

- A) Pure Lasso selects at most $n$ features and arbitrarily picks one from a correlated cluster, whereas the $L_2$ term induces strict convexity so correlated predictors receive shared non-zero weights alongside $L_1$ sparsity.
- B) Elastic Net eliminates the need for regularization hyperparameter tuning.
- C) Elastic Net converts linear regression into a non-parametric tree ensemble.
- D) Pure Lasso diverges whenever $n > d$.

<details><summary>Answer</summary>

**A.** Pure $L_1$ has non-unique solutions across collinear features and caps selected features at $\min(n, d)$. Adding the $L_2$ quadratic term stabilizes correlated groups ("grouping effect") while keeping irrelevant features exactly zero.

- Why not B: Elastic Net actually introduces two hyperparameters ($\lambda$ and $\alpha$).
- Why not C: It remains a linear parametric model.
- Why not D: Pure Lasso is convex and well-behaved for $n > d$; instability arises mainly under collinearity or $d \gg n$.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/modules/linear_model.html#elastic-net

</details>

### Q-MLF-019 · Classical ML Theory, Pipelines & Evaluation Metrics · difficulty 3 · scenario

You run `cross_val_score(LogisticRegression(), X_scaled, y, cv=5)` where `X_scaled = StandardScaler().fit_transform(X)` was executed beforehand on a dataset whose test folds come from a higher-variance regime. Why is this a leakage bug even though `y` was not passed to `StandardScaler`?

- A) `StandardScaler` stores class labels inside `mean_`.
- B) Pre-fitting `StandardScaler` leaks test-split variance and mean into training fold normalization, distorting regularization strength and decision margins optimistically; wrapping `StandardScaler` inside `Pipeline` fits per training fold only.
- C) `cross_val_score` ignores `X_scaled` and refits on raw `X`.
- D) `LogisticRegression` fails to converge unless features are scaled globally.

<details><summary>Answer</summary>

**B.** Unsupervised feature statistics still encode out-of-sample distribution parameters ($\mu_{\text{test}}, \sigma_{\text{test}}$). Fitting inside `Pipeline` guarantees strict fold isolation for both supervised and unsupervised steps.

- Why not A: `StandardScaler.fit(X)` does not inspect `y`.
- Why not C: `cross_val_score` consumes whatever array is passed in.
- Why not D: Scaling per training fold achieves identical optimization conditioning without leakage.
- Ref: [modules/02-ml-fundamentals-and-metrics.md](../modules/02-ml-fundamentals-and-metrics.md), https://scikit-learn.org/stable/common_pitfalls.html#data-leakage

</details>

---

## Domain 3: Core Neural Architectures (MLP, CNN, LSTM) (`Q-MLF-020`–`Q-MLF-028`)

### Q-MLF-020 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 1 · single

What does Hornik's (1991) Universal Approximation Theorem prove, and what does it **not** guarantee?

- A) It proves any 2-layer network with polynomial activations can represent arbitrary functions in $\mathcal{O}(n)$ weights.
- B) It proves a single hidden layer with non-polynomial continuous activation is dense in $C(K)$ on compact $K$, but does **not** guarantee polynomial width (shallow parity/compositional functions can require $\mathcal{O}(2^n)$ units) or gradient-descent learnability.
- C) It proves MLPs are translation equivariant on images without convolutions.
- D) It proves deeper networks always overfit more than wide 2-layer networks.

<details><summary>Answer</summary>

**B.** Universal approximation is an existence result over compact sets; depth is required in practice for exponential parameter efficiency ($\mathcal{O}(\mathrm{poly}(n))$ vs $\mathcal{O}(2^n)$) on hierarchical structure.

- Why not A: Polynomial activations fail universal approximation (a depth-2 polynomial network only computes bounded-degree polynomials).
- Why not C: Dense MLP layers possess zero translation equivariance.
- Why not D: Parameter-efficient depth often generalizes better than exponentially wide shallow nets.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://www.sciencedirect.com/science/article/abs/pii/089360809190009T

</details>

### Q-MLF-021 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 2 · single

Why does reverse-mode automatic differentiation (backpropagation) dominate neural network training over forward-mode AD?

- A) Forward-mode AD cannot differentiate `ReLU` or `tanh`.
- B) Networks map millions/billions of parameters $\theta \in \mathbb{R}^P$ to a **scalar** loss $\mathcal{L} \in \mathbb{R}$; reverse-mode computes $\nabla_\theta \mathcal{L}$ in **one forward + one backward VJP pass**, whereas forward-mode requires $\mathcal{O}(P)$ passes.
- C) Reverse-mode requires zero memory for intermediate activations.
- D) Forward-mode requires second-order Hessians on every step.

<details><summary>Answer</summary>

**B.** For $f: \mathbb{R}^P \to \mathbb{R}^M$ with $P \gg M = 1$, reverse-mode computes vector-Jacobian products in $O(1)$ passes relative to parameter count $P$, trading activation memory for huge throughput savings.

- Why not A: Forward-mode handles subgradients/elementwise activations identically.
- Why not C: Reverse-mode **must** cache (or recompute via activation checkpointing) forward activations until the backward pass reaches each layer.
- Why not D: Forward-mode computes first-order Jacobian-vector products (JVPs), not Hessians.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://www.nature.com/articles/323533a0

</details>

### Q-MLF-022 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 2 · single

A deep ReLU MLP is initialized with Xavier/Glorot normal variance $\mathrm{Var}(W) = 1 / d_{\text{in}}$ instead of Kaiming/He variance $2 / d_{\text{in}}$. What happens to forward activation norms across 30 layers?

- A) Activation variance doubles at every layer, causing immediate `NaN` overflow.
- B) Activation variance shrinks by roughly $\frac{1}{2}$ per layer ($2^{-30} \approx 10^{-9}$), collapsing signal and gradients toward zero.
- C) Activation variance stays strictly `1.0` because ReLU is linear for positive inputs.
- D) `Kaiming` and `Xavier` give identical variances when $d_{\text{in}} = d_{\text{out}}$.

<details><summary>Answer</summary>

**B.** Symmetric pre-activations are zeroed for negative half-space by ReLU, halving expected squared magnitude ($\mathbb{E}[\mathrm{ReLU}(z)^2] = \frac{1}{2}\mathrm{Var}(z)$). Without Kaiming's factor-of-2 variance boost, deep ReLU MLPs collapse exponentially.

- Why not A: Factor-of-2 under-scaling shrinks variance, rather than exploding it.
- Why not C: Zeroing negative values halves variance compared to linear/identity activations.
- Why not D: Kaiming uses $2 / d_{\text{in}}$ vs Xavier's $2 / (d_{\text{in}} + d_{\text{out}}) = 1 / d_{\text{in}}$ when $d_{\text{in}} = d_{\text{out}}$ (still a `2x` ratio).
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://arxiv.org/abs/1502.01852

</details>

### Q-MLF-023 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 2 · single

Compute the output spatial height $H_{\text{out}}$ for an input feature map $H = 64$, kernel $k = 3$, padding $p = 2$, dilation $d = 2$, and stride $s = 2$.

- A) `32`
- B) `33`
- C) `31`
- D) `64`

<details><summary>Answer</summary>

**A.** Using $H_{\text{out}} = \lfloor \frac{H + 2p - d(k - 1) - 1}{s} \rfloor + 1$: $\lfloor \frac{64 + 4 - 2(2) - 1}{2} \rfloor + 1 = \lfloor \frac{63}{2} \rfloor + 1 = 31 + 1 = 32$.

- Why not B: `33` forgets dilation $d=2$ ($64 + 4 - 2 - 1 = 65 \implies 32 + 1$).
- Why not C: `31` forgets the `+ 1` term in the output formula.
- Why not D: `64` ignores stride $s=2$.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://arxiv.org/abs/1603.07285

</details>

### Q-MLF-024 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 3 · single

A CNN stem consists of three sequential layers (dilation $d=1$): Layer 1 ($k=5, s=2$), Layer 2 ($k=3, s=2$), Layer 3 ($k=3, s=1$). Using the recurrence $j_l = j_{l-1} s_l$ and $r_l = r_{l-1} + (k_l - 1)j_{l-1}$ ($r_0 = 1, j_0 = 1$), what is the receptive field $r_3$ after Layer 3?

- A) `9`
- B) `11`
- C) `17`
- D) `21`

<details><summary>Answer</summary>

**C.** Step-by-step: $L_1: r_1 = 1 + (5-1)\cdot 1 = 5,\ j_1 = 2$. $L_2: r_2 = 5 + (3-1)\cdot 2 = 9,\ j_2 = 4$. $L_3: r_3 = 9 + (3-1)\cdot 4 = 17$.

- Why not A: `9` is $r_2$, stopping one layer early (or ignoring stride scaling).
- Why not B: `11` sums $(k_l - 1)$ without multiplying by cumulative stride jump $j_{l-1}$.
- Why not D: `21` misapplies $j_l$ instead of $j_{l-1}$ inside $r_l$.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://arxiv.org/abs/1701.04128

</details>

### Q-MLF-025 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 2 · single

In an LSTM cell, which structural mechanism explains the **Constant-Error Carousel (CEC)** that alleviates vanishing gradients across long sequences?

- A) Replacing all `tanh` nonlinearities with `ReLU`.
- B) The additive linear cell update $\mathbf{c}_t = \mathbf{f}_t \odot \mathbf{c}_{t-1} + \mathbf{i}_t \odot \tilde{\mathbf{c}}_t$, whose direct path Jacobian $\frac{\partial \mathbf{c}_t}{\partial \mathbf{c}_{t-1}} = \mathrm{diag}(\mathbf{f}_t)$ preserves error flow whenever $\mathbf{f}_t \approx \mathbf{1}$.
- C) Multiplying $\mathbf{h}_t$ by a recurrent orthogonal matrix $U_h$ without gates.
- D) Computing attention weights over all past cell states $\mathbf{c}_1 \dots \mathbf{c}_{t-1}$.

<details><summary>Answer</summary>

**B.** Unlike vanilla RNNs that repeatedly multiply gradients through dense $U^\top$ and $\tanh'$, the LSTM cell state updates additively, allowing error signals to traverse hundreds of steps when forget gates remain near `1`.

- Why not A: ReLU alone inside a vanilla RNN causes exploding activations if $U$ eigenvalues exceed `1`.
- Why not C: Unitary/orthogonal RNNs are a distinct architecture family, not LSTM's CEC.
- Why not D: Standard LSTMs store fixed-size state $(\mathbf{h}_t, \mathbf{c}_t)$ and do not perform attention over history.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://www.bioinf.jku.at/publications/older/2604.pdf

</details>

### Q-MLF-026 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 2 · multi

Which **two** statements accurately compare 2D CNNs against MLPs on image tasks?

- A) Deep learning `Conv2d` layers compute mathematical cross-correlation $(I \star K)$ without flipping the kernel spatially.
- B) A CNN with global average pooling and `3x3` kernels has $\mathcal{O}(H^2 W^2)$ weights in its first layer.
- C) Stacking two `3x3` stride-1 convolutions matches a `5x5` receptive field using `28%` fewer parameters (`18` vs `25` per channel pair) and adds an intermediate nonlinearity.
- D) CNNs are inherently invariant to arbitrary 90-degree rotations without data augmentation or equivariant group convolutions.

<details><summary>Answer</summary>

**A, C.** `Conv2d` implements cross-correlation (kernel flipping is redundant when weights are learned), and VGG-style `3x3` factorization achieves identical receptive fields with fewer weights and deeper nonlinearity.

- Why not B: Weight count in `Conv2d` is $\mathcal{O}(C_{\text{in}} C_{\text{out}} k^2)$, independent of spatial $H, W$.
- Why not D: Standard 2D convolutions are translation-equivariant, **not** rotation-invariant.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://arxiv.org/abs/1409.1556

</details>

### Q-MLF-027 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 2 · single

Why is the LSTM forget-gate bias $\mathbf{b}_f$ commonly initialized to `+1.0` (Jozefowicz et al. 2015) instead of `0.0`?

- A) So $\sigma(b_f) \approx 0.73$ keeps the forget gate open early in training, preventing gradients along the cell carousel from vanishing at step 0.
- B) To force $\mathbf{c}_t = 0$ on the first epoch.
- C) To make $\mathbf{o}_t$ equal `1.0` deterministically.
- D) Because sigmoid is undefined at `0.0`.

<details><summary>Answer</summary>

**A.** At $\mathbf{b}_f = 0$, $\sigma(0) = 0.5$ shrinks cell state gradients by $0.5^T$ across $T$ steps before training begins. Setting $\mathbf{b}_f = +1$ pushes $\sigma(1) \approx 0.731$ (or $+2 \implies 0.88$), preserving long-horizon credit assignment on early batches.

- Why not B: Positive bias retains cell memory rather than zeroing it.
- Why not C: $\mathbf{b}_f$ shifts the forget gate $\mathbf{f}_t$, not the output gate $\mathbf{o}_t$.
- Why not D: $\sigma(0) = 0.5$ is well-defined.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://proceedings.mlr.press/v37/jozefowicz15.html

</details>

### Q-MLF-028 · Core Neural Architectures (MLP, CNN, LSTM) · difficulty 3 · scenario

You must deploy a low-latency anomaly detector on a `100 KB` SRAM microcontroller processing continuous `1 kHz` 8-channel sensor telemetry where latency per tick must stay under `0.5 ms` and memory cannot grow with uptime. Which architecture fits best?

- A) A standard Transformer decoder keeping full causal attention over the last 100,000 samples.
- B) A compact **LSTM** (or causal 1D CNN) maintaining fixed $\mathcal{O}(d_h)$ hidden/cell state per tick in constant SRAM.
- C) A 20-step DDPM diffusion model conditioned on sensor history.
- D) An $O(N^2)$ full-graph GAT over all historical ticks.

<details><summary>Answer</summary>

**B.** An LSTM updates $(\mathbf{h}_t, \mathbf{c}_t)$ in constant $\mathcal{O}(d_h)$ memory and constant $\mathcal{O}(d_h^2)$ compute per tick, fitting tiny SRAM budgets without sequence buffers growing over uptime.

- Why not A: Full self-attention requires $\mathcal{O}(n)$ KV memory and $\mathcal{O}(n d)$ per-step reads, blowing past `100 KB` SRAM.
- Why not C: 20 iterative denoising steps violate `<0.5 ms` latency and memory constraints.
- Why not D: Full-history graph attention scales quadratically with history length.
- Ref: [modules/03-neural-networks-mlp-cnn-lstm.md](../modules/03-neural-networks-mlp-cnn-lstm.md), https://www.bioinf.jku.at/publications/older/2604.pdf

</details>

---

## Domain 4: Modern Generative & Graph Architectures (`Q-MLF-029`–`Q-MLF-039`)

### Q-MLF-029 · Modern Generative & Graph Architectures · difficulty 1 · single

In Scaled Dot-Product Attention $\mathrm{softmax}(QK^\top / \sqrt{d_k})V$, why do we divide by $\sqrt{d_k}$?

- A) To ensure attention matrices are strictly symmetric.
- B) Because for independent zero-mean unit-variance entries in $\mathbf{q}, \mathbf{k} \in \mathbb{R}^{d_k}$, their dot product has variance $d_k$; dividing by $\sqrt{d_k}$ restores unit variance so softmax does not saturate into tiny gradients.
- C) To convert attention complexity from $\mathcal{O}(n^2 d)$ to $\mathcal{O}(n d)$.
- D) Because GPU Tensor Cores only execute FP16 division by powers of two.

<details><summary>Answer</summary>

**B.** $\mathrm{Var}(\sum_{i=1}^{d_k} q_i k_i) = d_k$. Without scaling by $\sqrt{d_k}$, large $d_k$ pushes dot products to extreme positive/negative values where softmax collapses near a one-hot vector with vanishing Jacobian gradients.

- Why not A: $QK^\top$ is generally non-symmetric even after scaling.
- Why not C: Scalar division does not alter $\mathcal{O}(n^2 d)$ matrix multiplication asymptotics.
- Why not D: Tensor Cores execute matrix multiply-accumulate regardless of $\sqrt{d_k}$ scaling.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1706.03762

</details>

### Q-MLF-030 · Modern Generative & Graph Architectures · difficulty 3 · single

How does Rotary Position Embedding (RoPE) guarantee that the inner product $\langle \mathbf{q}_m, \mathbf{k}_n \rangle$ depends solely on relative token offset $n - m$?

- A) It adds sinusoidal vectors $PE_m$ before $W_q$ and drops bias terms.
- B) It applies orthogonal 2D block-diagonal rotation matrices $R_{\Theta,m}^d$ to projected queries and keys; orthogonality gives $(R_{\Theta,m}^d)^\top R_{\Theta,n}^d = R_{\Theta,n-m}^d$, eliminating absolute positions $m$ and $n$.
- C) It masks all tokens with $\lvert n - m \rvert > 128$ prior to softmax.
- D) It applies RoPE to $V$ as well as $Q$ and $K$ so all three cancel.

<details><summary>Answer</summary>

**B.** $(R_{\Theta,m}^d \mathbf{u})^\top (R_{\Theta,n}^d \mathbf{v}) = \mathbf{u}^\top (R_{\Theta,m}^d)^\top R_{\Theta,n}^d \mathbf{v} = \mathbf{u}^\top R_{\Theta,n-m}^d \mathbf{v}$, making every attention logit purely a function of content and relative displacement $n - m$.

- Why not A: Additive positional vectors introduce content-position cross terms that do not reduce to $n - m$ alone.
- Why not C: Window masking restricts range rather than creating relative rotational invariance.
- Why not D: RoPE is applied strictly to $Q$ and $K$, never to $V$.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/2104.09864

</details>

### Q-MLF-031 · Modern Generative & Graph Architectures · difficulty 2 · single

In a Variational Autoencoder (VAE), what is the exact role of the reparameterization $\mathbf{z} = \boldsymbol{\mu} + \boldsymbol{\sigma} \odot \boldsymbol{\varepsilon}$ ($\boldsymbol{\varepsilon} \sim \mathcal{N}(\mathbf{0}, I)$)?

- A) It forces the KL divergence $D_{\mathrm{KL}}(q_\phi(\mathbf{z}\mid\mathbf{x}) \Vert p(\mathbf{z}))$ to equal zero identically.
- B) It removes stochasticity from the parameter-dependent computational graph so pathwise low-variance gradients $\nabla_\phi$ flow cleanly through $\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$ during backpropagation.
- C) It converts a VAE into an adversarial minimax game.
- D) It ensures reconstructions $\hat{\mathbf{x}}$ are sharper than diffusion models.

<details><summary>Answer</summary>

**B.** Direct sampling $\mathbf{z} \sim \mathcal{N}(\boldsymbol{\mu}, \boldsymbol{\sigma}^2)$ blocks pathwise backpropagation. Shifting noise into parameter-free $\boldsymbol{\varepsilon}$ enables deterministic gradient flow through $\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$.

- Why not A: $D_{\mathrm{KL}}$ depends on $\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$ and is minimized toward zero only in posterior collapse.
- Why not C: VAEs maximize the ELBO, not a minimax game.
- Why not D: VAEs typically yield blurrier samples than diffusion models under Gaussian pixel likelihoods.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1312.6114

</details>

### Q-MLF-032 · Modern Generative & Graph Architectures · difficulty 3 · scenario

You train a VAE with an autoregressive Transformer decoder on text, and observe that reconstruction loss drops while $D_{\mathrm{KL}}(q_\phi(\mathbf{z}\mid\mathbf{x}) \Vert p(\mathbf{z})) \to 0.001$ and latent interpolation produces unrelated outputs. What failure mode occurred?

- A) **Posterior collapse**: the powerful autoregressive decoder models $p_\theta(\mathbf{x})$ without using $\mathbf{z}$, allowing the encoder to collapse $q_\phi(\mathbf{z}\mid\mathbf{x}) \to p(\mathbf{z})$ to zero out the KL penalty.
- B) **Mode collapse**: the discriminator rejected all latent vectors $\mathbf{z}$.
- C) **Over-smoothing**: repeated normalized adjacency steps flattened $\mathbf{z}$.
- D) **Gradient explosion** from `b_f = +1`.

<details><summary>Answer</summary>

**A.** When the decoder is strong enough to explain $\mathbf{x}$ autoregressively on its own, the ELBO achieves a trivial local optimum by pushing $q_\phi(\mathbf{z}\mid\mathbf{x}) = \mathcal{N}(\mathbf{0}, I)$ ($D_{\mathrm{KL}} = 0$) and ignoring latent codes (mitigated by KL annealing, free-bits thresholds, or weaker decoders).

- Why not B: Mode collapse is a GAN pathology; VAEs have no discriminator.
- Why not C: Over-smoothing occurs in deep GCNs, not VAEs.
- Why not D: `b_f` is the LSTM forget-gate bias.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1511.06349

</details>

### Q-MLF-033 · Modern Generative & Graph Architectures · difficulty 2 · single

In Goodfellow et al.'s GAN analysis, what value does $V(D^*, G)$ reach at the global Nash equilibrium $p_g = p_{\text{data}}$, and why do practitioners replace $\min_G \mathbb{E}[\log(1 - D(G(\mathbf{z})))]$ with $\min_G -\mathbb{E}[\log D(G(\mathbf{z}))]$?

- A) $V(D^*, G) = 0$; non-saturating loss prevents $D$ from learning.
- B) $V(D^*, G) = -\log 4$; early in training when $D(G(\mathbf{z})) \approx 0$, $\log(1 - D(G(\mathbf{z})))$ has near-zero gradient, whereas $-\log D(G(\mathbf{z}))$ provides strong gradients while keeping the same fixed point.
- C) $V(D^*, G) = +\log 2$; non-saturating loss eliminates mode collapse completely.
- D) $V(D^*, G) = -\infty$; non-saturating loss turns the GAN into a DDPM.

<details><summary>Answer</summary>

**B.** At $p_g = p_{\text{data}}$, $D^* = \frac{1}{2}$ gives $V = \log\frac{1}{2} + \log\frac{1}{2} = -\log 4$. Minimizing $-\log D(G(\mathbf{z}))$ avoids gradient saturation when $D$ easily spots early synthetic samples.

- Why not A: $V(D^*, G) = -\log 4 + 2\,\mathrm{JSD}(p_{\text{data}} \Vert p_g) = -\log 4$ at $\mathrm{JSD}=0$.
- Why not C: Value is $-\log 4$, and non-saturating loss does not by itself eliminate mode collapse.
- Why not D: Non-saturating loss remains an adversarial generator objective.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1406.2661

</details>

### Q-MLF-034 · Modern Generative & Graph Architectures · difficulty 2 · single

Why can DDPM training compute a noisy sample $\mathbf{x}_t$ for step $t = 750$ directly from $\mathbf{x}_0$ in $O(1)$ without simulating steps $1 \dots 749$?

- A) Because DDPM uses a deterministic invertible flow network for the forward pass.
- B) Because composing $t$ linear Gaussian Markov steps $q(\mathbf{x}_s\mid\mathbf{x}_{s-1}) = \mathcal{N}(\sqrt{\alpha_s}\mathbf{x}_{s-1}, \beta_s I)$ yields the exact closed-form marginal $\mathbf{x}_t = \sqrt{\bar\alpha_t}\mathbf{x}_0 + \sqrt{1 - \bar\alpha_t}\boldsymbol{\varepsilon}$ with $\bar\alpha_t = \prod_{s=1}^t \alpha_s$.
- C) Because $\beta_t = 0$ for all $t < 750$.
- D) Because $\mathcal{L}_{\text{simple}}$ skips forward noising entirely.

<details><summary>Answer</summary>

**B.** Sums of independent Gaussians remain Gaussian with summed variances, collapsing the forward Markov chain into one closed-form linear combination of $\mathbf{x}_0$ and $\boldsymbol{\varepsilon} \sim \mathcal{N}(\mathbf{0}, I)$.

- Why not A: The forward process is a stochastic Markov chain, not a deterministic normalizing flow.
- Why not C: $\beta_t > 0$ at every step in the noise schedule.
- Why not D: $\mathcal{L}_{\text{simple}}$ evaluates $\boldsymbol{\varepsilon}_\theta(\mathbf{x}_t, t)$ directly on closed-form noisy samples $\mathbf{x}_t$.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/2006.11239

</details>

### Q-MLF-035 · Modern Generative & Graph Architectures · difficulty 3 · single

How does DDPM's simplified training loss $\mathcal{L}_{\text{simple}} = \mathbb{E}_{t,\mathbf{x}_0,\boldsymbol{\varepsilon}}[\lVert \boldsymbol{\varepsilon} - \boldsymbol{\varepsilon}_\theta(\mathbf{x}_t, t)\rVert_2^2]$ relate to the true variational bound $\mathcal{L}_{\text{vlb}}$?

- A) $\mathcal{L}_{\text{simple}}$ equals $\mathcal{L}_{\text{vlb}}$ identically at every timestep $t$.
- B) $\mathcal{L}_{\text{simple}}$ drops the step-dependent ELBO weighting factor $\lambda_t = \frac{\beta_t^2}{2\sigma_t^2 \alpha_t (1 - \bar\alpha_t)}$ on the noise-prediction MSE, down-weighting tiny-$t$ pixel details so the network learns multi-scale denoising better in practice.
- C) $\mathcal{L}_{\text{simple}}$ optimizes a discriminator instead of noise prediction.
- D) $\mathcal{L}_{\text{simple}}$ assumes $\boldsymbol{\varepsilon}_\theta$ predicts $\mathbf{x}_T$ instead of $\boldsymbol{\varepsilon}$.

<details><summary>Answer</summary>

**B.** Each KL term $D_{\mathrm{KL}}(q(\mathbf{x}_{t-1}\mid\mathbf{x}_t,\mathbf{x}*0) \Vert p*\theta(\mathbf{x}_{t-1}\mid\mathbf{x}_t))$ simplifies to a weighted MSE between true $\boldsymbol{\varepsilon}$ and $\boldsymbol{\varepsilon}_\theta$; Ho et al. showed dropping the $\lambda_t$ prefactor improves sample quality across scales.

- Why not A: $\mathcal{L}_{\text{vlb}}$ weights small-$t$ terms much more heavily than $\mathcal{L}_{\text{simple}}$.
- Why not C: DDPM has no adversarial discriminator.
- Why not D: $\boldsymbol{\varepsilon}_\theta$ predicts the injected Gaussian noise $\boldsymbol{\varepsilon}$.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/2006.11239

</details>

### Q-MLF-036 · Modern Generative & Graph Architectures · difficulty 2 · single

In Kipf & Welling's Graph Convolutional Network (GCN) update $H^{(l+1)} = \sigma(\tilde D^{-1/2}\tilde A \tilde D^{-1/2} H^{(l)} W^{(l)})$, what is $\tilde A$, and why is symmetric renormalization $\tilde D^{-1/2}\tilde A\tilde D^{-1/2}$ applied?

- A) $\tilde A = A - I$; normalization doubles gradients on hub nodes.
- B) $\tilde A = A + I$ adds self-loops so nodes retain their own features, and $\tilde D^{-1/2}\tilde A\tilde D^{-1/2}$ bounds eigenvalues in $[0, 2]$ (spectral stability) to prevent feature magnitudes from exploding or vanishing across layers on high-degree hubs.
- C) $\tilde A$ is a dense learned attention matrix over all $N^2$ node pairs.
- D) Symmetric normalization guarantees infinite-depth GCNs never over-smooth.

<details><summary>Answer</summary>

**B.** Adding self-loops ($\tilde A = A + I$) includes node $i$'s own previous embedding in the aggregation, while symmetric degree normalization rescales the spectral radius of the first-order Chebyshev approximation so repeated layer applications stay numerically bounded.

- Why not A: $\tilde A$ adds self-loops ($A + I$), not subtracts them.
- Why not C: GCN uses fixed graph structure $\tilde A$, unlike GAT's learned attention weights.
- Why not D: Repeated normalized diffusion still causes **over-smoothing** past 4–6 layers.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1609.02907

</details>

### Q-MLF-037 · Modern Generative & Graph Architectures · difficulty 2 · single

Why is a Graph Attention Network (GAT) **inductive** (able to generalize directly to unseen graphs with different node counts and topology at test time), unlike spectral Laplacian eigendecomposition GNNs?

- A) GAT learns attention weights $\alpha_{ij} = \mathrm{softmax}_j(\mathrm{LeakyReLU}(\mathbf{a}^\top [W\mathbf{h}_i \Vert W\mathbf{h}_j]))$ purely from shared local node-feature projections $W$ and edge neighborhoods $\mathcal{N}_i$ without relying on a fixed graph Laplacian eigenbasis.
- B) GAT memorizes the global adjacency matrix $A$ in its final linear head.
- C) GAT forbids edges between different node classes.
- D) GAT requires retraining $\mathbf{a}$ on every unseen test node.

<details><summary>Answer</summary>

**A.** GAT parameterizes edge importance via shared local parameters $(W, \mathbf{a})$ evaluated on arbitrary neighbor pairs $(i, j)$, requiring zero dependence on fixed global graph size or Laplacian eigenvectors.

- Why not B: Storing $A$ directly would make the model transductive, not inductive.
- Why not C: GAT handles arbitrary homophilic and heterophilic edges.
- Why not D: Frozen trained $(W, \mathbf{a})$ run inference directly on completely new graphs.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1710.10903

</details>

### Q-MLF-038 · Modern Generative & Graph Architectures · difficulty 2 · multi

Which **two** architectural statements are accurate?

- A) In a GAT, hidden layers concatenate multi-head outputs ($K d_h$ dims) while the final prediction layer averages heads instead of concatenating.
- B) Standard VAEs produce sharper high-frequency image textures than GANs or Diffusion models.
- C) Stacking 15 vanilla GCN layers improves node classification by expanding the receptive field across the entire graph without side effects.
- D) A standard Transformer block incurs $\mathcal{O}(n^2 d)$ prefill cost per layer because every query attends across all $n$ keys.

<details><summary>Answer</summary>

**A, D.** Veličković et al. concatenate multi-head representations in intermediate GAT layers and average across heads at the output layer; standard Transformer self-attention performs all-pairs $QK^\top$ multiplication in $\mathcal{O}(n^2 d)$ FLOPs.

- Why not B: VAEs under Gaussian pixel likelihoods blur high-frequency detail compared to GANs/Diffusion.
- Why not C: Deep vanilla GCNs suffer severe **over-smoothing**, collapsing node embeddings to indistinguishable vectors.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/1710.10903

</details>

### Q-MLF-039 · Modern Generative & Graph Architectures · difficulty 3 · scenario

You are designing a generative image-synthesis microservice requiring state-of-the-art photorealism and prompt diversity, where `1–2 s` latency is acceptable and mode collapse is unacceptable. Which model family is the standard choice, and why?

- A) Pure vanilla GAN, because minimax JSD guarantees zero mode collapse.
- B) **Latent Diffusion (VAE encoder/decoder + DiT/U-Net DDPM/flow model)**, because compressing images into a compact VAE latent space cuts diffusion FLOPs while iterative score denoising covers multimodal distributions without adversarial collapse.
- C) Unrolled LSTM pixel generator, because it generates 4K images in 1 pass.
- D) 2-layer GCN over image superpixels without a generator.

<details><summary>Answer</summary>

**B.** Latent diffusion combines a VAE's perceptual compression with diffusion's mode-covering stability and high sample fidelity, serving as the foundation of modern image/video generators.

- Why not A: Vanilla GANs notoriously suffer mode collapse and training instability.
- Why not C: Pixel-by-pixel sequential LSTMs scale terribly on megapixel grids.
- Why not D: A 2-layer GCN is not a generative image synthesis architecture.
- Ref: [modules/04-transformers-autoencoders-gans-diffusion-gnn.md](../modules/04-transformers-autoencoders-gans-diffusion-gnn.md), https://arxiv.org/abs/2112.10752

</details>

---

## Domain 5: LLM KV-Cache Compression & Inference Math (`Q-MLF-040`–`Q-MLF-050`)

### Q-MLF-040 · LLM KV-Cache Compression & Inference Math · difficulty 2 · single

Compute the BF16 ($b = 2$ bytes) KV-cache footprint **per token** for Llama-2-7B ($L = 32, n_{kv} = 32, d_h = 128$) versus Llama-3-8B GQA-8 ($L = 32, n_{kv} = 8, d_h = 128$).

- A) `256 KiB/token` vs `64 KiB/token`
- B) `512 KiB/token` vs `128 KiB/token`
- C) `1,024 KiB/token` vs `256 KiB/token`
- D) `512 KiB/token` vs `320 KiB/token`

<details><summary>Answer</summary>

**B.** $M_{\text{KV}}/\text{tok} = 2 L n_{kv} d_h b$. For Llama-2-7B MHA: $2 \cdot 32 \cdot 32 \cdot 128 \cdot 2 = 524{,}288\text{ B} = 512\text{ KiB/token}$. For Llama-3-8B GQA-8: $2 \cdot 32 \cdot 8 \cdot 128 \cdot 2 = 131{,}072\text{ B} = 128\text{ KiB/token}$ (`4x` smaller).

- Why not A: Off by `2x` (forgetting either K+V factor `2` or BF16 `b = 2`).
- Why not C: Overcounts by `2x`.
- Why not D: `320 KiB/token` is Llama-2-70B GQA-8 ($L = 80, n_{kv} = 8$), not Llama-3-8B.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2305.13245

</details>

### Q-MLF-041 · LLM KV-Cache Compression & Inference Math · difficulty 3 · scenario

You serve Llama-3-8B (`16 GiB` BF16 weights + `4 GiB` runtime/activation headroom) on a single `80 GiB` H100 GPU with `128 KiB/token` KV cache. What is the maximum batch concurrency $B_{\max}$ at context $T = 131{,}072$ tokens before eviction or compression?

- A) `1` session
- B) `3` sessions
- C) `12` sessions
- D) `64` sessions

<details><summary>Answer</summary>

**B.** Available KV VRAM is $80 - 16 - 4 = 60\text{ GiB}$. One `131,072`-token sequence consumes $131{,}072 \times 128\text{ KiB} = 16\text{ GiB}$. Thus $B_{\max} = \lfloor 60 / 16 \rfloor = 3$ concurrent sequences!

- Why not A: `16 GiB` leaves room for `3` sequences inside `60 GiB`, not `1`.
- Why not C: `12` sessions would require `192 GiB` of KV cache alone.
- Why not D: `64` sessions would require `1 TiB` of KV cache.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2309.06180

</details>

### Q-MLF-042 · LLM KV-Cache Compression & Inference Math · difficulty 2 · single

How does Ainslie et al.'s **GQA** convert an existing pretrained MHA checkpoint into Grouped-Query Attention without full pretraining from scratch?

- A) Randomly drop $(n_h - n_{kv})$ K/V projection heads with zero fine-tuning.
- B) Mean-pool the K and V projection head weights within each group of $G$ heads, then run uptraining for roughly `5%` of original pre-training compute.
- C) Quantize all K/V heads to 2-bit integers.
- D) Replace all attention layers with LSTM cells.

<details><summary>Answer</summary>

**B.** Mean-pooling preserves initial group representations better than selecting a single head or random init, and `5%` uptraining recovers MHA-level quality at MQA-like bandwidth savings.

- Why not A: Dropping heads without uptraining causes severe perplexity collapse.
- Why not C: Quantization is orthogonal (Method 8), not GQA uptraining.
- Why not D: GQA stays within the Transformer attention architecture.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2305.13245

</details>

### Q-MLF-043 · LLM KV-Cache Compression & Inference Math · difficulty 3 · single

In DeepSeek-V2's **Multi-Head Latent Attention (MLA)** ($L = 60, d_c = 512, d_h^R = 64$), how many elements per token per layer are cached in BF16, what is the total BF16 KiB/token across 60 layers, and what is the **matrix absorption** trick?

- A) `576` elements/layer (`67.5 KiB/token` total); because the content branch is RoPE-free, $W^{UK}$ and $W^{UV}$ are algebraically folded into $W^{UQ}$ and $W^O$ at inference so full $K$ and $V$ tensors are never materialized.
- B) `1,024` elements/layer (`120 KiB/token`); $W^{UK}$ is quantized to INT4 while $K$ is cached uncompressed.
- C) `576` elements/layer (`67.5 KiB/token`); RoPE is applied to $\mathbf{c}_t^{KV}$ before storing it in cache so $W^{UK}$ can still be absorbed.
- D) `32,768` elements/layer (`3,840 KiB/token`); MLA caches $Q$, $K$, and $V$ separately.

<details><summary>Answer</summary>

**A.** MLA stores $\mathbf{c}_t^{KV}$ (`512`) + $\mathbf{k}_t^R$ (`64`) = `576` elements/layer $\times 60 \times 2\text{ B} = 69{,}120\text{ B} = 67.5\text{ KiB/token}$. Decoupling RoPE keeps the content branch linear so $W^{UK}$ merges into $W^{UQ}$ and $W^{UV}$ merges into $W^O$.

- Why not B: $512 + 64 = 576$, not `1,024`, and MLA avoids materializing $K$ entirely.
- Why not C: Applying position-dependent RoPE inside $\mathbf{c}_t^{KV}$ would break associativity and **prevent** matrix absorption of $W^{UK}$!
- Why not D: `32,768` elements/layer is an MHA-128 baseline ($2 \times 128 \times 128$), not MLA.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2405.04434

</details>

### Q-MLF-044 · LLM KV-Cache Compression & Inference Math · difficulty 3 · single

Why did DeepSeek-V2 report `"93.3% KV reduction"` while comparing MLA (`576` elems/layer) analytically against MHA-128 (`32,768` elems/layer) yields `576 / 32,768 = 1.76%` (`~98.24%` reduction)?

- A) A typo in DeepSeek-V2's arithmetic.
- B) The `93.3%` headline is an end-to-end serving comparison against DeepSeek 67B (which uses GQA-8 and different layer/head dimensions), whereas `576 / 32,768 = 1.76%` is the single-layer ratio against MHA-128; the two figures reconcile only under their respective baselines.
- C) Because BF16 takes 4 bytes instead of 2 bytes in MLA.
- D) Because MLA also deletes half the transformer layers at inference.

<details><summary>Answer</summary>

**B.** Comparing KV cache footprints across models requires tracking exact baselines ($L, n_{kv}, d_h$). DeepSeek-V2's `93.3%` compares total model KV cache against DeepSeek 67B (GQA), not against an ungrouped 128-head MHA layer.

- Why not A: Both numbers are accurate under their stated baselines.
- Why not C: BF16 is 2 bytes per element in both baselines.
- Why not D: MLA preserves all transformer layers.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2405.04434

</details>

### Q-MLF-045 · LLM KV-Cache Compression & Inference Math · difficulty 2 · single

In **StreamingLLM** (Xiao et al. 2023), why does retaining just $n_{\text{sink}} = 4$ initial prompt tokens alongside a sliding window $W$ prevent perplexity collapse over 4M-token streams?

- A) The first 4 tokens store the model's weights.
- B) Because softmax outputs must sum to `1`, models learn to route surplus attention probability onto initial tokens ("attention sinks") whenever recent keys do not match; evicting them breaks softmax normalization across every layer.
- C) Retaining 4 initial tokens doubles the sliding window size $W$.
- D) StreamingLLM recomputes the entire prompt from $t=0$ on every generated token.

<details><summary>Answer</summary>

**B.** Pinning $n_{\text{sink}} = 4$ anchor tokens preserves the softmax probability dump without needing full KV history, enabling stable streaming past 4M tokens and `22.2x` speedup vs recomputation.

- Why not A: Weights reside in static GPU memory, not in token KV slots.
- Why not C: $4 + W$ adds 4 constant tokens, not $2W$.
- Why not D: Avoiding recomputation is precisely why StreamingLLM achieves its `22.2x` speedup.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2309.17453

</details>

### Q-MLF-046 · LLM KV-Cache Compression & Inference Math · difficulty 2 · single

What concrete GPU memory failure does **PagedAttention** (vLLM) eliminate compared to contiguous static pre-allocation?

- A) It eliminates `60–80%` internal/external fragmentation waste from reserving `max_seq_len` contiguous KV buffers per request, bounding waste to less than one partial `B_blk`-token block (`< 4%`) and enabling Copy-on-Write beam/prefix sharing.
- B) It compresses weights from FP16 to INT2 automatically.
- C) It replaces softmax with linear attention.
- D) It moves all KV cache tensors permanently to CPU disk swap.

<details><summary>Answer</summary>

**A.** Virtual paging via fixed-size physical KV blocks and per-sequence block tables eliminates pre-allocation waste and external fragmentation, unlocking `2–4x` higher batch sizes and throughput.

- Why not B: PagedAttention is a memory allocator/kernel design, not weight quantization.
- Why not C: PagedAttention computes exact standard softmax attention over non-contiguous blocks.
- Why not D: Blocks live in GPU HBM during active inference (swapping only on rare preemption).
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2309.06180

</details>

### Q-MLF-047 · LLM KV-Cache Compression & Inference Math · difficulty 2 · single

How does **RadixAttention** (SGLang) accelerate multi-turn conversations, few-shot prompts, and Tree-of-Thoughts agents?

- A) By discarding all previous conversation turns after each response.
- B) By indexing cached KV blocks in a **radix tree (compressed prefix trie)** over token sequences with LRU eviction and cache-aware request scheduling, sharing both KV VRAM and prefill computation across matching prefixes ($\lvert\bigcup_i \text{prefix}_i\rvert$).
- C) By hashing prompts into 128-bit Bloom filters and skipping decoding.
- D) By running inference on CPU instead of GPU for prefixes.

<details><summary>Answer</summary>

**B.** Any shared token prefix (system instructions, few-shot demos, multi-turn history) resolves to existing radix-tree nodes, skipping redundant prefill compute and duplicate KV storage (up to `6.4x` throughput).

- Why not A: Discarding history forces full recomputation on every turn.
- Why not C: Approximate Bloom filters cannot return exact KV vectors.
- Why not D: All KV blocks remain GPU-resident for fast attention execution.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2312.07104

</details>

### Q-MLF-048 · LLM KV-Cache Compression & Inference Math · difficulty 3 · single

Why does **KIVI** (2-bit KV-cache quantization, Liu et al. 2024) quantize **Keys per-channel** and **Values per-token**?

- A) Keys are stored on CPU while Values are stored on GPU.
- B) Key tensors exhibit persistent outlier magnitudes along fixed feature channels across all sequence tokens, whereas Value tensors exhibit outliers locally per token across channels; matching quantization granularity to each outlier axis minimizes 2-bit error.
- C) Hardware GPU registers only support per-channel division on even layers.
- D) Values do not affect attention scores, so per-token rounding error is ignored.

<details><summary>Answer</summary>

**B.** Per-token quantization on Keys would stretch every token's scale across fixed channel outliers; quantizing K per-channel and V per-token (with an `R = 128` FP16 residual window) preserves accuracy at 2 bits (`2.6x` lower peak VRAM, up to `4x` batch size).

- Why not A: Both K and V live in GPU HBM.
- Why not C: It is an empirical statistical property of Transformer activations, not a GPU hardware restriction.
- Why not D: Attention outputs $\sum_j \alpha_{ij} V_j$ depend linearly on Value precision.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2402.02750

</details>

### Q-MLF-049 · LLM KV-Cache Compression & Inference Math · difficulty 2 · multi

Which **two** KV-cache methods specifically bound memory as a function of **window size $W$** rather than growing linearly with total stream length $T$?

- A) Multi-Query Attention (MQA)
- B) Sliding-Window Attention (SWA)
- C) Attention Sinks / StreamingLLM
- D) PagedAttention

<details><summary>Answer</summary>

**B, C.** Both Sliding-Window Attention ($O(W)$) and StreamingLLM ($O(n_{\text{sink}} + W)$) bound active KV sequence length independently of total generated stream length $T$.

- Why not A: MQA shrinks $n_{kv} \to 1$, but memory still grows linearly with $T$.
- Why not D: PagedAttention eliminates fragmentation waste, but memory still scales as $\lceil T / B_{\text{blk}}\rceil B_{\text{blk}} = O(T)$.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2309.17453

</details>

### Q-MLF-050 · LLM KV-Cache Compression & Inference Math · difficulty 3 · scenario

You operate an interactive coding assistant serving `16k`-token shared repository prefixes across `32` concurrent developer queries on Llama-3-70B (`GQA-8`). Currently `75%` of GPU KV memory is wasted on duplicate repository prefills and static `max_seq_len=32k` reservations. Which **two** serving-engine techniques compose cleanly without retraining the weights?

- A) Uptrain Llama-3-70B to MQA and add Sliding-Window Attention $W=512$.
- B) Enable **RadixAttention** (or PagedAttention CoW prefix caching) to deduplicate the `16k` repository KV prefix across all `32` sessions + **PagedAttention** block paging to eliminate static reservation waste (optionally paired with **FP8 KV quantization**).
- C) Switch to an LSTM encoder-decoder model.
- D) Increase `max_seq_len` to `64k` with contiguous allocation.

<details><summary>Answer</summary>

**B.** RadixAttention + PagedAttention (+ FP8 KV) work strictly at the serving runtime with zero weight retraining, eliminating duplicate `16k`-token prefix storage/prefill and static block waste simultaneously.

- Why not A: Uptraining changes model weights and truncating to $W=512$ destroys `16k` repository context.
- Why not C: Switching to an LSTM discards the pretrained 70B LLM capabilities.
- Why not D: Doubling `max_seq_len` with contiguous pre-allocation doubles static fragmentation waste.
- Ref: [modules/05-kv-cache-compression-and-inference-math.md](../modules/05-kv-cache-compression-and-inference-math.md), https://arxiv.org/abs/2312.07104

</details>

---

## Domain 6: Quantization & Production Drift Monitoring (`Q-MLF-051`–`Q-MLF-060`)

### Q-MLF-051 · Quantization & Production Drift Monitoring · difficulty 1 · single

Why does **symmetric** uniform quantization ($z = 0, q \in [-(2^{b-1}-1), 2^{b-1}-1]$) simplify integer matrix multiplication compared to asymmetric quantization?

- A) Because symmetric quantization uses 16 bits instead of 4 bits.
- B) Because $z = 0$ eliminates the cross-term offset products $-z_w \sum x_i$ inside inner-loop GEMM kernels, whereas asymmetric quantization fits skewed post-ReLU activations more tightly.
- C) Because symmetric quantization guarantees zero rounding error on outliers.
- D) Because asymmetric quantization cannot represent positive numbers.

<details><summary>Answer</summary>

**B.** Expanding $(w_q - z_w)(x_q - z_x)$ creates extra offset summation overhead during MatMul; setting $z_w = 0$ for centered weights removes those terms at minimal range cost.

- Why not A: Symmetry determines zero-point placement, not bit-width.
- Why not C: Uniform rounding error still depends on scale $s$ and outliers.
- Why not D: Asymmetric ranges $[0, 2^b - 1]$ represent arbitrary shifted intervals $[w_{\min}, w_{\max}]$.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://arxiv.org/abs/2106.08295

</details>

### Q-MLF-052 · Quantization & Production Drift Monitoring · difficulty 2 · single

How does **Quantization-Aware Training (QAT)** backpropagate gradients through discrete rounding operations $\hat{w} = \lfloor w/s \rceil$ whose true derivative is zero almost everywhere?

- A) It replaces rounding with a cubic spline in the forward pass too.
- B) It applies the **Straight-Through Estimator (STE)** in the backward pass: $\frac{\partial \mathcal{L}}{\partial w} \approx \frac{\partial \mathcal{L}}{\partial \hat{w}} \cdot \mathbb{I}(w \in [q_{\min}s, q_{\max}s])$, passing upstream gradients unchanged inside the clamp bounds while preserving exact quantized values in the forward pass.
- C) It freezes all weights below `0.1` and only updates bias vectors.
- D) It computes finite-difference gradients across every weight sequentially.

<details><summary>Answer</summary>

**B.** STE decouples forward simulated quantization from backward gradient propagation, allowing optimizers (AdamW/SGD) to adapt weights around quantization noise.

- Why not A: Changing the forward pass to smooth splines means the network never experiences actual quantization discretization error during training.
- Why not C: All weights within clipping bounds receive gradients.
- Why not D: Finite differences would require $\mathcal{O}(\lvert\theta\rvert)$ forward passes per step.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://arxiv.org/abs/1308.3432

</details>

### Q-MLF-053 · Quantization & Production Drift Monitoring · difficulty 3 · single

In **GPTQ** (Frantar et al. 2022), after quantizing weight column $j$ with error $w_j - \hat{w}_j$, what does the second-order Hessian update $\boldsymbol{\delta} = -\frac{w_j - \hat{w}*j}{[\mathbf{H}^{-1}]*{jj}}\mathbf{H}^{-1}_{:,j}$ ($\mathbf{H} = 2XX^\top$) accomplish?

- A) It deletes column $j$ from the layer matrix permanently.
- B) It adjusts all remaining unquantized columns $W_{:,j+1:}$ to cancel out the layer output reconstruction error $\Delta(WX)$ caused by rounding column $j$, outperforming round-to-nearest dramatically at 3–4 bits.
- C) It trains the model for 10 epochs using QAT STE.
- D) It doubles activation precision to FP32 at runtime.

<details><summary>Answer</summary>

**B.** Pushing residual error onto remaining unquantized weights weighted by the inverse Hessian preserves $\lVert WX - \hat{W}X \rVert_F^2$ down to 3–4 bits in ~4 GPU-hours for a 175B model (`3.25x` A100 speedup).

- Why not A: Column $j$ stays quantized in $\hat{W}$.
- Why not C: GPTQ is purely post-training (PTQ) with zero gradient descent or backprop.
- Why not D: Runtime executes fast dequantized `W4A16` / `W3A16` kernels, not FP32 activations.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://arxiv.org/abs/2210.17323

</details>

### Q-MLF-054 · Quantization & Production Drift Monitoring · difficulty 3 · single

How does **AWQ** (Lin et al. 2023) avoid mixed-precision hardware complexity while still protecting the `~1%` most important weights during INT4 PTQ?

- A) It keeps `1%` of weights in FP16 and uses sparse CSR indexing.
- B) It identifies salient channels from **activation magnitudes** ($s_j = (\max\lvert X_{:,j}\rvert)^\alpha$) rather than weight magnitudes, then multiplies those salient weight columns by $s_j$ and scales runtime activations by $1/s_j$ ($y = (W\,\mathrm{diag}(\mathbf{s}))(\mathrm{diag}(\mathbf{s})^{-1}\mathbf{x})$) so all weights remain uniform INT4.
- C) It clips the top `1%` largest activations to zero.
- D) It runs full Cholesky Hessian inversion on every token.

<details><summary>Answer</summary>

**B.** Scaling salient weight columns upward lowers their relative rounding error inside uniform INT4 groups while keeping memory layout dense (`>3x` TinyChat speedup) and avoiding calibration overfitting.

- Why not A: Mixed FP16+INT4 irregular sparsity degrades GPU coalesced memory bandwidth.
- Why not C: Zeroing large activation channels destroys model accuracy.
- Why not D: Hessian inversion belongs to GPTQ; AWQ uses a simple per-channel grid search over $\alpha \in [0, 1]$.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://arxiv.org/abs/2306.00978

</details>

### Q-MLF-055 · Quantization & Production Drift Monitoring · difficulty 2 · scenario

You must deploy a `70B`-parameter LLM (`~140 GB` BF16 weights) onto a single `80 GB` H100 GPU with `30+ GB` headroom for concurrent KV cache. Which weight format satisfies both constraints?

- A) BF16 (`140 GB`) with PagedAttention
- B) FP8 E4M3 (`~70 GB` weights)
- C) **INT4 group-128 AWQ/GPTQ (`~39–42 GB` weights)** leaving `~35+ GB` for KV cache and activations
- D) FP32 (`280 GB` weights)

<details><summary>Answer</summary>

**C.** INT4 (`0.5 B/param` + `g=128` scale metadata $\approx 39\text{–}42\text{ GB}$) fits easily on one `80 GB` H100 while leaving `~35+ GB` for active KV-cache batches.

- Why not A: `140 GB` weights exceed a single `80 GB` GPU before loading any KV cache.
- Why not B: `~70 GB` FP8 weights fit on `80 GB` with almost zero room (`< 6 GB`) for long-context KV batches.
- Why not D: `280 GB` requires 4+ GPUs.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://arxiv.org/abs/2306.00978

</details>

### Q-MLF-056 · Quantization & Production Drift Monitoring · difficulty 2 · single

Which drift category occurs when `PSI` across all input features stays `< 0.05` ($P_t(X) \approx P_{\text{ref}}(X)$), yet precision on verified labels drops from `92%` to `64%` because fraudsters adapted their behavior?

- A) Covariate drift
- B) Label / prior drift only
- C) **Concept drift** ($P_t(Y\mid X) \neq P_{\text{ref}}(Y\mid X)$)
- D) Missing-value schema drift

<details><summary>Answer</summary>

**C.** Concept drift changes the conditional relationship $P(Y \mid X)$ even when marginal input feature distributions $P(X)$ look unchanged. Only delayed ground-truth label monitoring or human audits catch pure concept drift.

- Why not A: Covariate drift alters $P(X)$, which would raise feature PSI.
- Why not B: Prior drift shifts $P(Y)$ while keeping $P(X\mid Y)$ constant.
- Why not D: Schema drift breaks input types/null rates directly in $X$.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://dl.acm.org/doi/10.1145/2523813

</details>

### Q-MLF-057 · Quantization & Production Drift Monitoring · difficulty 2 · single

Under the standard credit-risk convention (Siddiqi 2006), how are **Population Stability Index (PSI)** values interpreted, and how must bins be defined?

- A) `< 0.10` no meaningful shift, `0.10–0.25` moderate shift (investigate), `> 0.25` major shift (retrain); bins are fixed **reference quantile edges** (typically 10 deciles) reused on live windows with $\varepsilon \approx 10^{-6}$ floor.
- B) `< 0.05` triggers immediate emergency rollback; bins must be recomputed from fresh quantiles on every live batch.
- C) `> 0.25` indicates `p < 0.05` statistical significance via Student's t-test.
- D) PSI can be negative when production variance shrinks below reference variance.

<details><summary>Answer</summary>

**A.** PSI is symmetric KL divergence ($\ge 0$), evaluated against fixed reference quantile boundaries so live mass shifts appear directly as bin proportion deltas.

- Why not B: Recomputing quantile edges on live data hides global mean/scale shifts!
- Why not C: PSI carries no $p$-value; `0.10 / 0.25` are empirical heuristics that vary with bin count.
- Why not D: Because $(p_i - q_i)\ln(p_i/q_i) \ge 0$ term-by-term, PSI is always non-negative.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html

</details>

### Q-MLF-058 · Quantization & Production Drift Monitoring · difficulty 3 · scenario

Your monitoring job runs `scipy.stats.ks_2samp(ref, act, method="asymp")` daily on `n = 1,000,000` reference and `m = 1,000,000` live inference predictions. Yesterday it reported $D_{n,m} = 0.004$ with $p = 2.4 \times 10^{-7}$ and paged on-call to retrain. Should you retrain?

- A) Yes, because $p < 0.001$ proves severe production model decay.
- B) No: at `n = m = 1,000,000`, the KS rejection threshold $1.358\sqrt{\frac{n+m}{nm}} \approx 0.0019$ makes microscopic, operationally meaningless shifts statistically significant; gate alerts on **effect size $D\_{n,m}$**, **PSI**, and business metric impact instead of raw $p$-value.
- C) Switch `method="asymp"` to `method="exact"` to make the $p$-value larger at `N = 1,000,000`.
- D) Replace KS with `StandardScaler` on the predictions.

<details><summary>Answer</summary>

**B.** High sample counts drive statistical power so high that $0.4\%$ CDF separation ($D = 0.004$) triggers tiny $p$-values despite negligible practical drift (`PSI < 0.01`). Report $D_{n,m}$ as effect size and threshold on practical significance.

- Why not A: Statistical significance at $N=10^6$ does not imply practical or business significance.
- Why not C: Exact and asymptotic KS tests agree closely at $N = 10^6$ (and exact combinatorial DP is slow at huge $N$).
- Why not D: KS is scale/shift sensitive on purpose; normalizing live batches independently hides actual drift.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html

</details>

### Q-MLF-059 · Quantization & Production Drift Monitoring · difficulty 2 · multi

Which **two** rollout controls protect live traffic before promoting a retrained candidate model to `100%`?

- A) **Shadow (dark launch) evaluation** mirroring live traffic asynchronously to verify feature parity, latency, and score distributions with zero user blast radius.
- B) **Automated retraining gates** enforcing Pydantic schema checks, golden slice non-regression, and sustained drift windows before staged **canary rollout** (`5% -> 25% -> 100%`).
- C) Promoting any model whose training-set accuracy exceeds `99%` directly to `100%` without holdout checks.
- D) Disabling drift monitors during peak traffic to reduce latency.

<details><summary>Answer</summary>

**A, B.** Shadowing validates real-world feature parity without risking live decisions, and automated schema/holdout/canary gates stop silent regressions from hitting `100%` of users.

- Why not C: Training accuracy detects neither overfitting nor feature-pipeline mismatch.
- Why not D: Drift monitoring runs asynchronously on logged telemetry/batches off the critical serving path.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://docs.aws.amazon.com/sagemaker/latest/dg/model-monitor.html

</details>

### Q-MLF-060 · Quantization & Production Drift Monitoring · difficulty 3 · ordering

Arrange the end-to-end production drift remediation loop in the correct operational sequence:

- A) Detect sustained `PSI > 0.25` + KS effect size $D > 0.10$ -> Validate fresh snapshot via Pydantic contract & `ASOF` point-in-time joins -> Retrain inside isolated `Pipeline` & verify holdout PR-AUC/Brier -> Deploy in shadow mode for parity -> Promote via canary (`5% -> 100%`).
- B) Page on KS `p < 0.05` -> Retrain on `latest.parquet` with global `StandardScaler` -> Push directly to `100%` production -> Run schema checks afterward.
- C) Deploy candidate to `100%` -> Compute reference decile bins from live traffic -> Run shadow mode after rollback.
- D) Quantize weights to INT4 -> Skip validation -> Recompute PSI bins hourly.

<details><summary>Answer</summary>

**A.** Operational ML safety requires effect-size-gated drift detection, schema/leakage-verified data lineage, isolated offline validation, zero-impact shadow parity verification, and progressive canary promotion.

- Why not B: Raw $p$-values trigger false alarms, global scaling leaks, and unvalidated `100%` rollouts break production.
- Why not C: Recomputing reference bins from live traffic destroys baseline comparison, and shadowing after `100%` rollout defeats its purpose.
- Why not D: Skips validation and misuses PSI reference bins.
- Ref: [modules/06-quantization-and-ml-monitoring.md](../modules/06-quantization-and-ml-monitoring.md), https://docs.aws.amazon.com/sagemaker/latest/dg/shadow-tests.html

</details>

---

## Timed Mock Exam (40 Questions · 60 Minutes)

Simulate a Senior ML Engineer written screen or `MLA-C01` technical sprint using this **40-question proportional subset** drawn from the bank above.

- **Time limit**: **60 minutes** (`90 seconds` per question). Complete all 40 questions before opening any `<details>` answer block.
- **Scoring & Readiness Key** (`1 point` per exact match; `multi` questions require all correct options with no wrong options):
  - **Fail / Review needed**: `< 26 / 40` (`< 65%`)
  - **Pass / Senior ML Engineer Ready (`MLA-C01` 720-equivalent)**: `29 – 33 / 40` (`72.5% – 82.5%`)
  - **Distinction / Staff ML Level**: `>= 34 / 40` (`>= 85%`)

| Domain | Weight | Mock Count | Selected Question IDs |
| --- | :-: | :-: | --- |
| 1. Numerical Computing, Pipelines & Data Lineage | 15% | 6 | `Q-MLF-001`, `Q-MLF-002`, `Q-MLF-004`, `Q-MLF-005`, `Q-MLF-006`, `Q-MLF-009` |
| 2. Classical ML Theory, Pipelines & Evaluation Metrics | 17% | 7 | `Q-MLF-010`, `Q-MLF-011`, `Q-MLF-012`, `Q-MLF-013`, `Q-MLF-014`, `Q-MLF-015`, `Q-MLF-019` |
| 3. Core Neural Architectures (MLP, CNN, LSTM) | 15% | 6 | `Q-MLF-020`, `Q-MLF-021`, `Q-MLF-022`, `Q-MLF-024`, `Q-MLF-025`, `Q-MLF-028` |
| 4. Modern Generative & Graph Architectures | 18% | 7 | `Q-MLF-029`, `Q-MLF-030`, `Q-MLF-031`, `Q-MLF-032`, `Q-MLF-033`, `Q-MLF-035`, `Q-MLF-036` |
| 5. LLM KV-Cache Compression & Inference Math | 18% | 7 | `Q-MLF-040`, `Q-MLF-041`, `Q-MLF-043`, `Q-MLF-044`, `Q-MLF-045`, `Q-MLF-046`, `Q-MLF-048` |
| 6. Quantization & Production Drift Monitoring | 17% | 7 | `Q-MLF-052`, `Q-MLF-053`, `Q-MLF-054`, `Q-MLF-055`, `Q-MLF-056`, `Q-MLF-058`, `Q-MLF-060` |
