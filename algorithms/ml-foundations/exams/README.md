# Machine Learning Foundations: Exam & Interview Coverage Matrix

No single vendor-neutral certification covers numerical ML internals, classical statistical pipelines, eight neural architectures, LLM KV-cache compression, quantization, and production drift detection together. This track prepares engineers for the **Senior / Staff ML Engineer Interview Loop** alongside overlapping domains of **AWS Certified Machine Learning Engineer – Associate (`MLA-C01`)**, mapping every competency domain to modules, runnable proofs, and the 60-question bank in [`ml-foundations.md`](ml-foundations.md).

---

## 1. Competency & `MLA-C01` Coverage Matrix

| Competency Domain & Objectives | Weight | Target Modules | Runnable Proofs / Examples | Questions | Status |
| --- | :-: | --- | --- | :-: | :-: |
| **1. Numerical Computing, Pipelines & Data Lineage**<br>NumPy strided `ndarray` memory (C/F-order, views vs copies, zero-stride broadcasting, SIMD), feature leakage prevention, chronological/grouped splits, Pydantic schema contracts, `DVC 3.67.1` / LakeFS versioning. (`MLA-C01` Domain 1 overlap) | 15% | Module 01 | `examples/py/test_ml_pipeline_and_drift.py` | `Q-MLF-001`–`Q-MLF-009` | ✅ full |
| **2. Classical ML Theory, Pipelines & Evaluation Metrics**<br>ERM, bias-variance decomposition, $L_1$/$L_2$/Elastic Net geometry, `scikit-learn 1.9.1` `Pipeline` + `ColumnTransformer`, Precision/Recall/$F_\beta$, PR-AUC vs ROC-AUC under extreme skew, Brier/log-loss calibration, cost-optimal Bayes thresholding, RMSE/MAE/$R^2$. (`MLA-C01` Domain 2 overlap) | 17% | Module 02 | `examples/py/test_ml_pipeline_and_drift.py` | `Q-MLF-010`–`Q-MLF-019` | ✅ full |
| **3. Core Neural Architectures (MLP, CNN, LSTM)**<br>Universal approximation, reverse-mode AD VJP chain rule, Xavier/Kaiming initialization, 2D CNN cross-correlation, receptive-field recurrence, LSTM constant-error carousel & gate equations. | 15% | Module 03 | `examples/ts/02-nn-and-quantization.test.ts` | `Q-MLF-020`–`Q-MLF-028` | ✅ full |
| **4. Modern Generative & Graph Architectures**<br>Scaled dot-product & MHA, RoPE relative dot-product invariance, VAE ELBO + reparameterization + posterior collapse, GAN minimax JSD equilibrium + mode collapse, DDPM forward closed-form + $\mathcal{L}_{\text{simple}}$, GCN spectral renormalization + over-smoothing, GAT inductive attention. | 18% | Module 04 | `examples/ts/02-nn-and-quantization.test.ts` | `Q-MLF-029`–`Q-MLF-039` | ✅ full |
| **5. LLM KV-Cache Compression & Inference Math**<br>Exact VRAM bound $M_{\text{KV}} = 2 L n_{kv} d_h b T B$, H100 batch sizing, and all 8 compression techniques: MQA, GQA, DeepSeek-V2 MLA (RoPE decoupling + matrix absorption), Sliding-Window Attention, Attention Sinks (StreamingLLM), PagedAttention, RadixAttention, and FP8/INT8/KIVI KV quantization. | 18% | Module 05 | `examples/ts/01-kv-cache-compression.test.ts` | `Q-MLF-040`–`Q-MLF-050` | ✅ full |
| **6. Quantization & Production Drift Monitoring**<br>Affine symmetric/asymmetric quantization, PTQ vs QAT (STE), GPTQ Hessian compensation, AWQ salient-channel scaling, FP8/INT4 trade-offs, covariate/label/concept drift, PSI bins & conventions, two-sample KS $D_{n,m}$ & large-$N$ $p$-value trap, shadow vs canary gates. (`MLA-C01` Domain 4 overlap) | 17% | Module 06 | `examples/ts/02-nn-and-quantization.test.ts`, `examples/py/test_ml_pipeline_and_drift.py` | `Q-MLF-051`–`Q-MLF-060` | ✅ full |

---

## 2. Exam Preparation Resources

- **60-Question Bank**: [`ml-foundations.md`](ml-foundations.md) (`Q-MLF-001`–`Q-MLF-060`), proportional to domain weights (`9`–`11` questions per domain, mixing `single`, `multi`, `scenario`, and `ordering` formats across difficulty levels `1`–`3`, with full distractor rationales and primary paper/doc citations).
- **Timed Mock Exam**: 40-question, 60-minute weighted simulation with explicit passing threshold (`72%` / `29/40`) and domain diagnostic rubric inside [`ml-foundations.md`](ml-foundations.md#timed-mock-exam-40-questions--60-minutes).
