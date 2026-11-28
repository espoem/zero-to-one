# ML Dossier — Versions, Architecture Math, KV-Cache Compression, Quantization & Drift

Verification: PyPI JSON API (`pypi.org/pypi/<pkg>/json`) and arXiv API (`export.arxiv.org/api/query`), fetched 2026-11-28. Every arXiv ID below was resolved and title-matched; author lists truncated.

## 1. Python ML stack — latest stable on PyPI

| Package        | Latest stable | Uploaded   | `requires-python` |
| -------------- | ------------- | ---------- | ----------------- |
| `numpy`        | **2.5.5**     | 2026-11-15 | `>=3.12`          |
| `pydantic`     | **2.14.4**    | 2026-11-19 | `>=3.10`          |
| `scipy`        | **1.18.1**    | 2026-08-21 | `>=3.12`          |
| `scikit-learn` | **1.9.1**     | 2026-09-10 | `>=3.11`          |
| `dvc`          | **3.67.1**    | 2026-03-31 | `>=3.9`           |

Compatibility consequence: `numpy` 2.5.x and `scipy` 1.18.x both require Python ≥ 3.12, so the effective interpreter floor for the full stack is **3.12**, even though `scikit-learn` and `dvc` advertise 3.11/3.9. Single-source-of-truth pin:

```toml
# pyproject.toml
requires-python = ">=3.12"
dependencies = [
  "numpy==2.5.5",
  "scipy==1.18.1",
  "scikit-learn==1.9.1",
  "pydantic==2.14.4",
  "dvc==3.67.1",
]
```

`dvc` is the only laggard (last release 2026-03-31); treat it as the constraint on upgrade cadence, not `numpy`.

## 2. Architecture math (KaTeX-ready)

### 2.1 MLP

$$ \mathbf{h}^{(0)}=\mathbf{x},\qquad \mathbf{h}^{(l)}=\sigma\!\left(W^{(l)}\mathbf{h}^{(l-1)}+\mathbf{b}^{(l)}\right),\quad l=1,\dots,L-1 $$ $$ f(\mathbf{x})=W^{(L)}\mathbf{h}^{(L-1)}+\mathbf{b}^{(L)} $$ With $\sigma$ non-constant, bounded and monotone (Cybenko 1989) or merely non-polynomial (Hornik 1991), a single hidden layer is dense in $C(K)$ for compact $K$; depth buys $\mathcal{O}(\mathrm{poly}(n))$ width what would otherwise need $\mathcal{O}(2^{n})$ units.

### 2.2 CNN — 2D convolution and receptive field

Implemented operator is cross-correlation: $$ (I\star K)(i,j)=\sum_{m=0}^{k-1}\sum_{n=0}^{k-1} I\!\left(i+md,\; j+nd\right)K(m,n)+b $$ Output extent with padding $p$, stride $s$, dilation $d$: $$ H_{\text{out}}=\left\lfloor\frac{H+2p-d(k-1)-1}{s}\right\rfloor+1 $$ Receptive field and jump, layer by layer ($r_0=1,\; j_0=1$): $$ j_l = j_{l-1}s_l,\qquad r_l = r_{l-1}+(k_l-1)\,j_{l-1} $$ closed form: $$ r_L = 1+\sum_{l=1}^{L}(k_l-1)\prod_{i=1}^{l-1}s_i $$ Check: two $3\times3$, $s=1$ → $r=1+2+2=5$; $3\times3/s2$ then $3\times3/s1$ → $r=1+2+2\cdot2=7$.

### 2.3 LSTM (Hochreiter & Schmidhuber 1997; Graves 2013 form)

$$ \mathbf{i}_t=\sigma\!\left(W_i\mathbf{x}_t+U_i\mathbf{h}_{t-1}+\mathbf{b}_i\right),\quad
\mathbf{f}_t=\sigma\!\left(W_f\mathbf{x}_t+U_f\mathbf{h}_{t-1}+\mathbf{b}_f\right) $$
$$ \mathbf{o}_t=\sigma\!\left(W_o\mathbf{x}_t+U_o\mathbf{h}_{t-1}+\mathbf{b}_o\right),\quad
\tilde{\mathbf{c}}_t=\tanh\!\left(W_c\mathbf{x}_t+U_c\mathbf{h}_{t-1}+\mathbf{b}_c\right) $$
$$ \mathbf{c}_t=\mathbf{f}_t\odot\mathbf{c}_{t-1}+\mathbf{i}_t\odot\tilde{\mathbf{c}}_t,\qquad
\mathbf{h}_t=\mathbf{o}_t\odot\tanh(\mathbf{c}_t) $$
The cell path has Jacobian $\partial\mathbf{c}_t/\partial\mathbf{c}_{t-1}=\mathrm{diag}(\mathbf{f}_t)$, so error flows backward multiplicatively by gate values alone — the constant-error carousel that kills vanishing gradients when $f_t\approx 1$.

### 2.4 Transformer (Vaswani et al. 2017, arXiv:1706.03762)
$$ \mathrm{Attn}(Q,K,V)=\mathrm{softmax}\!\left(\frac{QK^{\top}}{\sqrt{d_k}}\right)V $$
$$ \mathrm{head}_i=\mathrm{Attn}(QW_i^{Q},\,KW_i^{K},\,VW_i^{V}),\qquad
\mathrm{MHA}(X)=\big[\,\mathrm{head}_1;\dots;\mathrm{head}_h\,\big]W^{O} $$
Sinusoidal positions: $PE_{(pos,2i)}=\sin\!\big(pos/10000^{2i/d_{\text{model}}}\big)$, $PE_{(pos,2i+1)}=\cos(\cdot)$. Cost $O(n^2 d)$ per layer — the term every method in §3 attacks from the $n$ side.

RoPE (Su et al. 2021, arXiv:2104.09864): with $\theta_i=10000^{-2(i-1)/d}$ and $R(\theta)=\begin{pmatrix}\cos\theta&-\sin\theta\\ \sin\theta&\cos\theta\end{pmatrix}$,
$$ R^{d}_{\Theta,m}=\mathrm{diag}\!\left(R(m\theta_1),\dots,R(m\theta_{d/2})\right),\qquad
\mathbf{q}_m=R^{d}_{\Theta,m}W_q\mathbf{x}_m,\quad \mathbf{k}_n=R^{d}_{\Theta,n}W_k\mathbf{x}_n $$
$$ \langle \mathbf{q}_m,\mathbf{k}_n\rangle=\langle W_q\mathbf{x}_m,\;R^{d}_{\Theta,n-m}W_k\mathbf{x}_n\rangle $$
i.e. the score depends only on $n-m$; implemented as the complex product $(W_q\mathbf{x}_m)e^{im\theta}$.

### 2.5 Autoencoder / VAE (Kingma & Welling 2013, arXiv:1312.6114)
$$ \log p_\theta(\mathbf{x})\ \ge\ \mathcal{L}(\theta,\phi;\mathbf{x})=
\mathbb{E}_{q_\phi(\mathbf{z}\mid\mathbf{x})}\!\left[\log p_\theta(\mathbf{x}\mid\mathbf{z})\right]
-D_{\mathrm{KL}}\!\left(q_\phi(\mathbf{z}\mid\mathbf{x})\,\Vert\,p(\mathbf{z})\right) $$
Gaussian case, $q_\phi=\mathcal{N}(\boldsymbol{\mu},\mathrm{diag}(\boldsymbol{\sigma}^2))$, $p(\mathbf{z})=\mathcal{N}(\mathbf{0},I)$:
$$ D_{\mathrm{KL}}=-\tfrac12\sum_{j=1}^{d_z}\left(1+\log\sigma_j^2-\mu_j^2-\sigma_j^2\right),\qquad
\mathbf{z}=\boldsymbol{\mu}+\boldsymbol{\sigma}\odot\boldsymbol{\varepsilon},\ \ \boldsymbol{\varepsilon}\sim\mathcal{N}(\mathbf{0},I) $$
The reparameterization makes $\nabla_\phi$ low-variance; a plain autoencoder is the $\sigma\to0$ degenerate limit where the KL term disappears.

### 2.6 GAN (Goodfellow et al. 2014, arXiv:1406.2661)
$$ \min_G\max_D V(D,G)=\mathbb{E}_{\mathbf{x}\sim p_{\text{data}}}\!\left[\log D(\mathbf{x})\right]
+\mathbb{E}_{\mathbf{z}\sim p_z}\!\left[\log\!\left(1-D(G(\mathbf{z}))\right)\right] $$
$$ D^{*}(\mathbf{x})=\frac{p_{\text{data}}(\mathbf{x})}{p_{\text{data}}(\mathbf{x})+p_g(\mathbf{x})},\qquad
V(D^{*},G)=-\log 4+2\,\mathrm{JSD}\!\left(p_{\text{data}}\,\Vert\,p_g\right) $$
so the global optimum $p_g=p_{\text{data}}$ has $V=-\log 4$. In practice $G$ minimises $-\mathbb{E}[\log D(G(\mathbf{z}))]$ (non-saturating) to avoid vanishing gradients.

### 2.7 Diffusion — DDPM (Ho et al. 2020, arXiv:2006.11239)
Forward Markov chain, $\alpha_t=1-\beta_t$, $\bar\alpha_t=\prod_{s=1}^{t}\alpha_s$:
$$ q(\mathbf{x}_t\mid\mathbf{x}_{t-1})=\mathcal{N}\!\left(\mathbf{x}_t;\sqrt{\alpha_t}\,\mathbf{x}_{t-1},\,\beta_t I\right)
\;\Longrightarrow\;
q(\mathbf{x}_t\mid\mathbf{x}_0)=\mathcal{N}\!\left(\mathbf{x}_t;\sqrt{\bar\alpha_t}\,\mathbf{x}_0,\,(1-\bar\alpha_t)I\right) $$
$$ \mathbf{x}_t=\sqrt{\bar\alpha_t}\,\mathbf{x}_0+\sqrt{1-\bar\alpha_t}\,\boldsymbol{\varepsilon},\qquad \boldsymbol{\varepsilon}\sim\mathcal{N}(\mathbf{0},I) $$
Reverse model and its mean (fixed $\Sigma_\theta=\sigma_t^2 I$):
$$ p_\theta(\mathbf{x}_{t-1}\mid\mathbf{x}_t)=\mathcal{N}\!\left(\mathbf{x}_{t-1};\boldsymbol{\mu}_\theta(\mathbf{x}_t,t),\Sigma_\theta(\mathbf{x}_t,t)\right),\qquad
\boldsymbol{\mu}_\theta=\frac{1}{\sqrt{\alpha_t}}\left(\mathbf{x}_t-\frac{\beta_t}{\sqrt{1-\bar\alpha_t}}\boldsymbol{\varepsilon}_\theta(\mathbf{x}_t,t)\right) $$
$$ \mathcal{L}_{\text{simple}}=\mathbb{E}_{t,\mathbf{x}_0,\boldsymbol{\varepsilon}}\!\left[\left\lVert\boldsymbol{\varepsilon}-\boldsymbol{\varepsilon}_\theta\!\left(\sqrt{\bar\alpha_t}\mathbf{x}_0+\sqrt{1-\bar\alpha_t}\boldsymbol{\varepsilon},\,t\right)\right\rVert_2^2\right] $$
$\mathcal{L}_{\text{simple}}$ is the $\lambda_t$-reweighted form of the true ELBO
$$ \mathcal{L}_{\text{vlb}}=\mathbb{E}_q\!\left[-\log p_\theta(\mathbf{x}_T)+\sum_{t=2}^{T}D_{\mathrm{KL}}\!\left(q(\mathbf{x}_{t-1}\mid\mathbf{x}_t,\mathbf{x}_0)\,\Vert\,p_\theta(\mathbf{x}_{t-1}\mid\mathbf{x}_t)\right)-\log p_\theta(\mathbf{x}_0\mid\mathbf{x}_1)\right] $$
with posterior $q(\mathbf{x}_{t-1}\mid\mathbf{x}_t,\mathbf{x}_0)=\mathcal{N}(\tilde{\boldsymbol{\mu}}_t,\tilde\beta_t I)$,
$\tilde{\boldsymbol{\mu}}_t=\frac{\sqrt{\bar\alpha_{t-1}}\beta_t}{1-\bar\alpha_t}\mathbf{x}_0+\frac{\sqrt{\alpha_t}(1-\bar\alpha_{t-1})}{1-\bar\alpha_t}\mathbf{x}_t$, $\tilde\beta_t=\frac{1-\bar\alpha_{t-1}}{1-\bar\alpha_t}\beta_t$.
Ancestral sampling: $\mathbf{x}_{t-1}=\frac{1}{\sqrt{\alpha_t}}\big(\mathbf{x}_t-\frac{1-\alpha_t}{\sqrt{1-\bar\alpha_t}}\boldsymbol{\varepsilon}_\theta\big)+\sigma_t\mathbf{z}$.

### 2.8 GNN — GCN and GAT
GCN (Kipf & Welling 2017, arXiv:1609.02907), renormalised first-order spectral truncation with $\tilde A=A+I$, $\tilde D_{ii}=\sum_j\tilde A_{ij}$:
$$ H^{(l+1)}=\sigma\!\left(\tilde D^{-1/2}\tilde A\,\tilde D^{-1/2}H^{(l)}W^{(l)}\right) $$
Justification: $g_\theta\star\mathbf{x}\approx\theta\left(I+D^{-1/2}AD^{-1/2}\right)\mathbf{x}$ from $T_1$ Chebyshev truncation; the renormalisation trick ($\tilde A$) tames exploding/vanishing scale at high degree. Depth is capped in practice by over-smoothing.

GAT (Veličković et al. 2018, arXiv:1710.10903):
$$ e_{ij}=\mathrm{LeakyReLU}\!\left(\mathbf{a}^{\top}\left[W\mathbf{h}_i\,\Vert\,W\mathbf{h}_j\right]\right),\qquad
\alpha_{ij}=\frac{\exp(e_{ij})}{\sum_{k\in\mathcal{N}_i}\exp(e_{ik})} $$
$$ \mathbf{h}_i'=\sigma\!\left(\sum_{j\in\mathcal{N}_i}\alpha_{ij}W\mathbf{h}_j\right) $$
Multi-head: concatenate in hidden layers, average at the output. Attention weights are per-edge, so the model is inductive (unseen graphs at test time).

## 3. KV-cache compression — 8 methods

Baseline bytes per token, $L$ layers, $n_h$ heads, head dim $d_h$, $b$ bytes/element, batch $B$, context $T$:
$$ M_{\text{KV}}=2\,L\,n_h\,d_h\,b\,T\,B $$
Per-token figure for $b=2$ (BF16): $4\,L\,n_h\,d_h$ bytes. Calibration: Llama-2-7B MHA ($L{=}32$, $n_h{=}32$, $d_h{=}128$) → **512 KiB/token**; Llama-2-70B GQA-8 ($L{=}80$) → **320 KiB/token**; Llama-3-8B GQA-8 → **128 KiB/token**.

| # | Method | Primary source | Bytes/token (batch $B$, ctx $T$) | Core mechanic |
|---|---|---|---|---|
| 1 | **MQA** | Shazeer 2019, [arXiv:1911.02150](https://arxiv.org/abs/1911.02150) | $2L\,d_h\,b\,TB$ | All $n_h$ query heads share one K/V head. $\times n_h$ reduction vs MHA; decode becomes bandwidth-bound on the (now tiny) KV load. Quality degradation is real but "minor". |
| 2 | **GQA** | Ainslie et al. 2023, [arXiv:2305.13245](https://arxiv.org/abs/2305.13245) | $2L\,(n_h/G)\,d_h\,b\,TB$ | $G$ query groups per KV head; interpolates MHA ($G{=}n_h$) ↔ MQA ($G{=}1$). Uptraining recipe: mean-pool K/V heads, then 5% of original pre-training compute. |
| 3 | **MLA** | DeepSeek-V2 2024, [arXiv:2405.04434](https://arxiv.org/abs/2405.04434) | $L\,(d_c+d_h^{R})\,b\,TB$ | Cache the *latent*, not K/V. $d_c{=}512$, $d_h^{R}{=}64$, $L{=}60$ → 576 elems/layer = **67.5 KiB/token BF16**. |
| 4 | **Sliding-window attention** | Beltagy et al. 2020, [arXiv:2004.05150](https://arxiv.org/abs/2004.05150); Mistral 7B [arXiv:2310.06825](https://arxiv.org/abs/2310.06825) | $2L\,n_{kv}d_h\,b\,\min(T,W)\,B$ | Each token attends to a window $W$; rolling buffer makes memory $O(W)$, independent of $T$. Longformer: $O(n\!\cdot\!w)$ attention, dilated windows stack receptive field. Mistral: $W{=}4096$. |
| 5 | **Attention sinks / StreamingLLM** | Xiao et al. 2023, [arXiv:2309.17453](https://arxiv.org/abs/2309.17453) | $2L\,n_{kv}d_h\,b\,(n_{\text{sink}}+W)\,B$ | Keep the first $n_{\text{sink}}{=}4$ tokens plus a rolling window. Softmax must sum to 1; initial tokens act as a "sink" absorbing surplus attention, so evicting them destroys window attention. Reported: stable to 4M tokens, **22.2×** faster than sliding-window recompute. |
| 6 | **PagedAttention** | Kwon et al. 2023 (vLLM), [arXiv:2309.06180](https://arxiv.org/abs/2309.06180) | $2L\,n_{kv}d_h\,b\cdot\lceil T/B_{\text{blk}}\rceil B_{\text{blk}}\cdot B$ | OS-style paging: fixed-size physical blocks + per-sequence block table, so allocation is on demand and waste is bounded by one partial block. Copy-on-write enables prefix/beam sharing. Reported: near-zero waste (<4%), **2–4×** throughput at equal latency. |
| 7 | **Prefix caching / RadixAttention** | Zheng et al. 2024 (SGLang), [arXiv:2312.07104](https://arxiv.org/abs/2312.07104) | $2L\,n_{kv}d_h\,b\cdot\lvert\bigcup_i \text{prefix}_i\rvert\cdot$ (unique tokens) | Radix tree over token sequences; a request walks the tree, reuses matched-prefix KV, only computes the suffix. LRU eviction; cache-aware scheduling orders requests to raise hit rate. Reported: up to **6.4×** throughput. |
| 8 | **KV quantization** | Liu et al. 2024 (KIVI), [arXiv:2402.02750](https://arxiv.org/abs/2402.02750); FP8 E4M3 | $2L\,n_{kv}d_h\,(b_q)\,TB+\text{scale/zero overhead}$ | FP8/INT8 halves bytes; 2-bit quarters them. KIVI: **keys per-channel, values per-token** (key outliers are channel-persistent, value outliers are token-local), group-wise affine quantisation, last $R{=}128$ tokens kept FP16. Reported: 2.6× lower peak memory, up to 4× batch size, 2.35–3.47× throughput. |

Worked consequences: on a single 80 GB H100 with Llama-3-8B (16 GB BF16 weights), $B_{\max}\approx(80-16-4)\,\text{GiB}/(131072\,\text{B}\times T)$. At $T{=}131072$ that is ~16 GiB of KV for **one** sequence — hence every method above except 4/5 is about $B$, and 4/5 are about $T$.

MLA correctness note: $W^{UK},W^{UV}$ can be folded into $W^{UQ}$/output projection at inference (matrix absorption), so $K$ and $V$ are never materialised — only $\mathbf{c}^{KV}_t$ and the RoPE key $\mathbf{k}^{R}_t$:
$$ \mathbf{c}_t^{KV}=W^{DKV}\mathbf{h}_t,\quad \mathbf{k}_t^{C}=W^{UK}\mathbf{c}_t^{KV},\quad \mathbf{v}_t^{C}=W^{UV}\mathbf{c}_t^{KV},\quad \mathbf{k}_t^{R}=\mathrm{RoPE}(W^{KR}\mathbf{h}_t) $$
$$ \mathrm{score}_{t,s}=\frac{\left[\mathbf{q}_{t,i}^{C};\mathbf{q}_{t,i}^{R}\right]^{\top}\left[\mathbf{k}_{s,i}^{C};\mathbf{k}_s^{R}\right]}{\sqrt{d_h+d_h^{R}}} $$
Analytically this is $576/(2\cdot128\cdot128)=1.76\%$ of an MHA-128 cache ($\approx56.9\times$). The paper's headline "reduces the KV cache by 93.3%" is an end-to-end serving comparison against DeepSeek 67B, not this per-token ratio; the two numbers reconcile only under different baseline geometries, so quote them separately.

## 4. Quantization and production drift

### 4.1 PTQ vs QAT
Affine uniform quantiser:
$$ \hat w=\mathrm{clamp}\!\left(\left\lfloor\frac{w}{s}\right\rceil+z,\;q_{\min},q_{\max}\right),\qquad
s=\frac{w_{\max}-w_{\min}}{2^{b}-1}\ \ (\text{asym}),\quad s=\frac{\lVert w\rVert_\infty}{2^{b-1}-1}\ \ (\text{sym}) $$

- **PTQ**: minimise $\lVert WX-\hat W X\rVert_F^2$ layer-wise on a small calibration set; no retraining, cheap, degrades below ~4 bits for LLMs.
- **QAT**: simulate quantisation in the forward pass, backprop through the rounding with a straight-through estimator $\partial\mathcal{L}/\partial w\approx\partial\mathcal{L}/\partial\hat w$; recovers accuracy at very low bit-widths but costs full fine-tuning and needs the training pipeline.
- **GPTQ** (Frantar et al., [arXiv:2210.17323](https://arxiv.org/abs/2210.17323)): PTQ with approximate second-order information. Per layer, $\mathbf{H}=2XX^{\top}$; quantise column $j$, then push the residual into the remaining columns:
$$ \boldsymbol{\delta}=-\frac{w_j-\hat w_j}{[\mathbf{H}^{-1}]_{jj}}\,\mathbf{H}^{-1}_{:,j},\qquad W_{:,j+1:}\leftarrow W_{:,j+1:}+\boldsymbol{\delta}^{\top} $$
Lazy batched updates + Cholesky reformulation give 175B in ~4 GPU hours at 3–4 bits, 3.25× (A100) / 4.5× (A6000) end-to-end speedup. The compensation step is why GPTQ ≫ round-to-nearest at equal bits.
- **AWQ** (Lin et al., [arXiv:2306.00978](https://arxiv.org/abs/2306.00978)): weight-only, activation-aware. Not all weights matter — ~1% salient channels dominate error, and saliency is read from *activation* magnitude, not weight magnitude. Per-input-channel scale $s_j=s_{X,j}^{\alpha}$, $\alpha\in[0,1]$ grid-searched:
$$ y=(W\mathrm{diag}(\mathbf{s}))\,(\mathrm{diag}(\mathbf{s})^{-1}\mathbf{x}),\qquad
s_j=\left(\max|X_{:,j}|\right)^{\alpha} $$
No backprop, no reconstruction → generalises across calibration domains; TinyChat gives >3× over FP16 on desktop/mobile GPUs, 70B on a mobile GPU.

### 4.2 PSI (Population Stability Index)
$$ \mathrm{PSI}=\sum_{i=1}^{B}\left(p_i^{\text{act}}-p_i^{\text{ref}}\right)\ln\frac{p_i^{\text{act}}}{p_i^{\text{ref}}}
= D_{\mathrm{KL}}\!\left(P_{\text{act}}\Vert P_{\text{ref}}\right)+D_{\mathrm{KL}}\!\left(P_{\text{ref}}\Vert P_{\text{act}}\right) $$
i.e. a symmetric KL — non-negative, zero iff distributions match. Bins are quantiles of the **reference** window (typically 10, deciles), fixed once and reused, with $\varepsilon\approx10^{-6}$ substituted for empty bins.

| PSI | Interpretation |
|---|---|
| < 0.10 | no meaningful shift |
| 0.10 – 0.25 | moderate shift, investigate |
| > 0.25 | major shift, retrain / re-calibrate |

These cut-offs are a credit-risk convention (Siddiqi, *Credit Risk Scorecards*, 2006), not a statistical theorem — they carry no p-value, and PSI grows mechanically with bin count and sample size. Always pair with a shape plot and a per-feature breakdown.

### 4.3 Two-sample Kolmogorov–Smirnov
$$ D_{n,m}=\sup_{x\in\mathbb{R}}\left|F_{1,n}(x)-F_{2,m}(x)\right| $$
Under $H_0$ (same continuous distribution), with $n_{\text{eff}}=nm/(n+m)$:
$$ \Pr\!\left(D_{n,m}>\lambda\right)\approx 2\sum_{j=1}^{\infty}(-1)^{j-1}e^{-2j^{2}\lambda^{2}},
\qquad \lambda=\left(\sqrt{n_{\text{eff}}}+0.12+\frac{0.11}{\sqrt{n_{\text{eff}}}}\right)D_{n,m} $$
Reject at level $\alpha$ when $D_{n,m}>c(\alpha)\sqrt{(n+m)/(nm)}$, $c(0.05)=1.358$. Use `scipy.stats.ks_2samp(ref, act, method="asymp")`; prefer `"exact"` below ~10⁴ samples. Caveat: with production-scale $n$, a drift of no practical consequence is still "significant" — report $D$ itself as the effect size, and complement with PSI on the same bins.

## Reference index

- Vaswani et al., *Attention Is All You Need* — arXiv:1706.03762
- Su et al., *RoFormer / RoPE* — arXiv:2104.09864
- Kingma & Welling, *Auto-Encoding Variational Bayes* — arXiv:1312.6114
- Goodfellow et al., *GANs* — arXiv:1406.2661
- Ho et al., *DDPM* — arXiv:2006.11239
- Kipf & Welling, *GCN* — arXiv:1609.02907
- Veličković et al., *GAT* — arXiv:1710.10903
- Shazeer, *Fast Transformer Decoding (MQA)* — arXiv:1911.02150
- Ainslie et al., *GQA* — arXiv:2305.13245
- DeepSeek-AI, *DeepSeek-V2 (MLA)* — arXiv:2405.04434
- Beltagy et al., *Longformer* — arXiv:2004.05150; Jiang et al., *Mistral 7B* — arXiv:2310.06825
- Xiao et al., *StreamingLLM* — arXiv:2309.17453
- Kwon et al., *PagedAttention / vLLM* — arXiv:2309.06180
- Zheng et al., *SGLang / RadixAttention* — arXiv:2312.07104
- Liu et al., *KIVI* — arXiv:2402.02750
- Frantar et al., *GPTQ* — arXiv:2210.17323
- Lin et al., *AWQ* — arXiv:2306.00978
$$
