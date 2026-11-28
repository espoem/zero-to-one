# Machine Learning Foundations: Bilingual Glossary (EN ↔ CZ)

Standardized English-to-Czech terminology for numerical computing, statistical learning, neural architectures, KV-cache optimization, quantization, and production monitoring. Shared computer science concepts preserve the definitions established in the [Root Glossary](../../GLOSSARY.md).

---

## 1. Numerical Computing & Data Engineering

| English Term | Czech Term | Definition & Context | Primary Reference |
| --- | --- | --- | --- |
| **Time Complexity** | **Časová složitost** | An asymptotic measure quantifying the amount of time an algorithm takes as a function of the input length `n`. | Cormen, Leiserson, Rivest, Stein (CLRS) |
| **Space Complexity** | **Paměťová složitost** | An asymptotic measure quantifying the memory storage an algorithm consumes relative to the input length `n`. | CLRS |
| **Strided Array (`ndarray`)** | **Pole s krokovým adresováním (strided ndarray)** | Contiguous raw byte buffer paired with `shape` and `strides` tuples mapping multi-dimensional indices $(i_0, \dots, i_{d-1})$ to byte offsets $\sum_k i_k s_k$. | NumPy Reference (`ndarray` Memory Layout) |
| **Broadcasting** | **Vysílání tvarů (broadcasting)** | Virtual stride-0 replication along unit or missing leading dimensions so elementwise tensor arithmetic avoids materializing copies. | NumPy Broadcasting Specification |
| **Data Leakage** | **Únik dat (data leakage)** | Contamination of training features or preprocessing statistics (e.g., scaler mean/variance, target encoding) by validation, test, or future-time records. | Kaufman et al. (2012); scikit-learn User Guide |
| **Content-Addressed Storage** | **Adresování podle obsahu** | Storing immutable dataset artifacts by cryptographic digest (e.g., MD5/SHA-256) so manifests decouple Git metadata from binary blobs. | DVC Architecture Specification |

---

## 2. Classical ML, Optimization & Metrics

| English Term | Czech Term | Definition & Context | Primary Reference |
| --- | --- | --- | --- |
| **Empirical Risk Minimization (ERM)** | **Minimalizace empirického rizika** | Selecting hypothesis $h \in \mathcal{H}$ minimizing average loss over a finite sample $\frac{1}{n}\sum_{i=1}^n \ell(h(\mathbf{x}_i), y_i)$ as a proxy for expected population risk. | Vapnik (Statistical Learning Theory) |
| **Bias-Variance Trade-off** | **Kompromis mezi vychýlením a rozptylem** | Decomposition of expected squared error into irreducible noise $\sigma^2$, squared approximation bias $(\mathbb{E}[\hat f]-f)^2$, and estimation variance $\mathrm{Var}(\hat f)$. | Hastie, Tibshirani & Friedman (ESL) |
| **Regularization ($L_1$ / $L_2$)** | **Regularizace ($L_1$ / $L_2$)** | Adding a norm penalty ($\lambda\lVert\mathbf{w}\rVert_1$ Lasso for sparsity, $\lambda\lVert\mathbf{w}\rVert_2^2$ Ridge for shrinkage) to constrain hypothesis capacity. | Hastie et al. (ESL) |
| **Precision / Recall** | **Přesnost (precision) / Úplnost (recall)** | Precision is positive predictive value $\frac{TP}{TP+FP}$; recall (sensitivity) is true positive rate $\frac{TP}{TP+FN}$. | Manning et al.; Powers (2011) |
| **PR-AUC vs. ROC-AUC** | **Plocha pod PR křivkou vs. ROC-AUC** | PR-AUC integrates Precision vs. Recall and remains sensitive to false positives under heavy class skew; ROC-AUC integrates TPR vs. FPR and can mask low precision when negatives dominate. | Saito & Rehmsmeier (2015) |
| **Brier Score** | **Brierovo skóre** | Proper scoring rule measuring mean squared error of predicted probabilities $\frac{1}{n}\sum_{i=1}^n (p_i - y_i)^2$ against binary outcomes. | Brier (1950) |

---

## 3. Neural Architectures & Generative Models

| English Term | Czech Term | Definition & Context | Primary Reference |
| --- | --- | --- | --- |
| **Backpropagation (Reverse-Mode AD)** | **Zpětné šíření chyby (reverse-mode autodiff)** | Computing vector-Jacobian products backward from scalar loss $\mathcal{L}$ to all parameters in one forward + one backward pass. | Rumelhart, Hinton & Williams (1986) |
| **Receptive Field** | **Receptivní pole** | Spatial extent of the input map influencing a single unit in layer $l$, governed by $r_l = r_{l-1} + (k_l - 1)\prod_{i=1}^{l-1} s_i$. | Luo et al. (2016) |
| **Constant-Error Carousel (CEC)** | **Karusel konstantní chyby** | Additive linear cell state path $\mathbf{c}_t = \mathbf{f}_t \odot \mathbf{c}_{t-1} + \mathbf{i}_t \odot \tilde{\mathbf{c}}_t$ in an LSTM whose Jacobian $\mathrm{diag}(\mathbf{f}_t)$ prevents vanishing gradients. | Hochreiter & Schmidhuber (1997) |
| **Scaled Dot-Product Attention** | **Škálovaná skalární pozornost** | Attention weights $\mathrm{softmax}(QK^\top / \sqrt{d_k})V$ where $\sqrt{d_k}$ normalization keeps softmax logits in a non-saturating variance regime. | Vaswani et al. (2017) |
| **Rotary Position Embedding (RoPE)** | **Rotační poziční vnoření (RoPE)** | Applying block-diagonal 2D rotation matrices $R_{\Theta,m}^d$ to query and key vectors so inner products depend strictly on relative offset $n-m$. | Su et al. (2021) |
| **Evidence Lower Bound (ELBO)** | **Dolní mez věrohodnosti (ELBO)** | Variational objective $\mathbb{E}_{q}[\log p_\theta(\mathbf{x}\mid\mathbf{z})] - D_{\mathrm{KL}}(q_\phi(\mathbf{z}\mid\mathbf{x}) \Vert p(\mathbf{z}))$ lower-bounding marginal log-likelihood $\log p_\theta(\mathbf{x})$. | Kingma & Welling (2013) |
| **Reparameterization Trick** | **Reparametrizační trik** | Expressing $\mathbf{z} = \boldsymbol{\mu} + \boldsymbol{\sigma} \odot \boldsymbol{\varepsilon}$ with $\boldsymbol{\varepsilon} \sim \mathcal{N}(\mathbf{0}, I)$ so gradients propagate through stochastic sampling nodes. | Kingma & Welling (2013) |
| **Mode Collapse** | **Kolaps módů** | GAN failure mode where generator $G(\mathbf{z})$ concentrates probability mass on a narrow subset of data modes rather than covering $p_{\text{data}}$. | Goodfellow et al. (2014) |
| **Denoising Diffusion (DDPM)** | **Denoising difuzní pravděpodobnostní model** | Generative Markov chain that progressively adds Gaussian noise $q(\mathbf{x}_t\mid\mathbf{x}*0)$ and learns reverse denoising transitions $p*\theta(\mathbf{x}_{t-1}\mid\mathbf{x}_t)$. | Ho et al. (2020) |
| **Over-Smoothing (GNN)** | **Přehlazování grafových příznaků** | Degeneration of node embeddings toward indistinguishable stationary vectors as graph convolutional layers $L$ stack beyond graph diameter. | Li et al. (2018); Kipf & Welling (2017) |

---

## 4. Inference Memory, Quantization & Drift Monitoring

| English Term | Czech Term | Definition & Context | Primary Reference |
| --- | --- | --- | --- |
| **KV Cache** | **Mezipaměť klíčů a hodnot (KV cache)** | Persisted per-layer key and value tensors across autoregressive decode steps, consuming $M_{\text{KV}} = 2 L n_{kv} d_h b T B$ bytes. | Vaswani et al. (2017); Kwon et al. (2023) |
| **Multi-Head Latent Attention (MLA)** | **Vícehlavá latentní pozornost (MLA)** | Compressing K/V into a low-rank joint latent vector $\mathbf{c}_t^{KV}$ with decoupled RoPE keys and matrix absorption into $W^{UQ}$/$W^O$. | DeepSeek-V2 (2024) |
| **Attention Sink** | **Jímka pozornosti (attention sink)** | Initial prompt tokens retained alongside a sliding window because softmax normalization forces surplus probability mass onto early positions. | Xiao et al. (2023, StreamingLLM) |
| **PagedAttention** | **Stránkovaná pozornost (PagedAttention)** | Virtual-memory paging of KV cache into fixed-size blocks with sequence block tables and Copy-on-Write prefix sharing. | Kwon et al. (2023, vLLM) |
| **Post-Training Quantization (PTQ)** | **Kvantizace po tréninku (PTQ)** | Compressing weights/activations from FP16/BF16 to INT8/FP8/INT4 using a small calibration set without gradient-based retraining. | Nagel et al. (2021); Frantar et al. (2022) |
| **Quantization-Aware Training (QAT)** | **Trénink s vědomím kvantizace (QAT)** | Simulating rounding in the forward pass while passing gradients via a straight-through estimator (STE) during training. | Bengio et al. (2013); Jacob et al. (2018) |
| **Covariate Drift** | **Posun distribuce vstupů (covariate drift)** | Change in input feature marginal distribution $P_t(X) \neq P_{\text{ref}}(X)$ while conditional label mechanism $P(Y \mid X)$ stays invariant. | Moreno-Torres et al. (2012) |
| **Concept Drift** | **Posun konceptu (concept drift)** | Change in the conditional target relationship $P_t(Y \mid X) \neq P_{\text{ref}}(Y \mid X)$ caused by changing real-world behavior or adversary adaptation. | Gama et al. (2014) |
| **Population Stability Index (PSI)** | **Index stability populace (PSI)** | Symmetric KL divergence $\sum_i (p_i^{\text{act}} - p_i^{\text{ref}})\ln(p_i^{\text{act}}/p_i^{\text{ref}})$ over fixed reference quantile bins. | Siddiqi (2006) |
