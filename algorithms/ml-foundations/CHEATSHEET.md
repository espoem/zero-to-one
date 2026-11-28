# Machine Learning Foundations: Fast-Lookup Cheatsheet

High-density reference for neural architecture equations, the 8 KV-cache compression methods, quantization trade-offs, classical ML metrics, and production drift thresholds.

---

## 1. Eight Neural Architectures at a Glance

| Architecture | Core Update / Objective | Complexity / Inductive Bias | Primary Failure Mode |
| --- | --- | --- | --- |
| **MLP** | $\mathbf{h}^{(l)} = \sigma(W^{(l)}\mathbf{h}^{(l-1)}+\mathbf{b}^{(l)})$ | Dense all-to-all; $O(d^2)$ weights/layer; no spatial/order bias | Overfitting tabular/raw grids; vanishing gradients without norms/residuals |
| **CNN** | $(I \star K)(i,j) = \sum_{m,n} I(i+md,j+nd)K(m,n)+b$ | Translation equivariant; local receptive field $r_l = r_{l-1}+(k_l-1)j_{l-1}$ | Fixed local kernel misses long-range context without depth/dilation |
| **LSTM** | $\mathbf{c}_t = \mathbf{f}_t\odot\mathbf{c}_{t-1} + \mathbf{i}_t\odot\tilde{\mathbf{c}}_t$, $\mathbf{h}_t=\mathbf{o}_t\odot\tanh(\mathbf{c}_t)$ | Sequential $O(n)$ depth; CEC Jacobian $\mathrm{diag}(\mathbf{f}_t)$ | Non-parallelizable across time; effective context degrades past ~1k tokens |
| **Transformer** | $\mathrm{Attn}(Q,K,V)=\mathrm{softmax}(QK^\top/\sqrt{d_k})V$ + RoPE | $O(1)$ path length, $O(n^2 d)$ prefill, $O(n)$ decode KV load | Quadratic prefill memory/compute & linear KV-cache VRAM bottleneck |
| **VAE** | $\mathcal{L} = \mathbb{E}_q[\log p_\theta(\mathbf{x}\mid\mathbf{z})] - D_{\mathrm{KL}}(q_\phi(\mathbf{z}\mid\mathbf{x}) \Vert p(\mathbf{z}))$ | Smooth latent manifold via $\mathbf{z}=\boldsymbol{\mu}+\boldsymbol{\sigma}\odot\boldsymbol{\varepsilon}$ | Posterior collapse ($D_{\mathrm{KL}}\to 0$) and blurry pixel reconstructions |
| **GAN** | $\min_G\max_D \mathbb{E}[\log D(\mathbf{x})] + \mathbb{E}[\log(1-D(G(\mathbf{z})))]$ | Implicit density; optimum $V(D^*,G) = -\log 4 + 2\,\mathrm{JSD}$ | Mode collapse, non-convergence, discriminator overpowering $G$ |
| **Diffusion (DDPM)** | $\mathcal{L}_{\text{simple}} = \mathbb{E}[\lVert\boldsymbol{\varepsilon}-\boldsymbol{\varepsilon}_\theta(\sqrt{\bar\alpha_t}\mathbf{x}_0+\sqrt{1-\bar\alpha_t}\boldsymbol{\varepsilon}, t)\rVert_2^2]$ | Iterative $T$-step ancestral/DDIM denoising; stable likelihoods | Slow multi-step sampling latency vs single-pass GANs/VAEs |
| **GNN (GCN / GAT)** | $H^{(l+1)}=\sigma(\tilde D^{-1/2}\tilde A\tilde D^{-1/2}H^{(l)}W^{(l)})$ | Permutation equivariant over graph edges; $O(\lvert E\rvert d)$ | Over-smoothing beyond 4–6 layers; neighbor explosion on hubs |

---

## 2. Eight Ways to Shrink the KV Cache

Baseline VRAM equation ($L$ layers, $n_{kv}$ KV heads, head dim $d_h$, $b$ bytes/elem, context $T$, batch $B$):

$$M_{\text{KV}} = 2\,L\,n_{kv}\,d_h\,b\,T\,B$$

| # | Method | Target Factor | Bytes / Formula | Headline Calibration / Impact |
| --- | --- | --- | --- | --- |
| 1 | **MQA** | $n_{kv} \to 1$ | $2 L d_h b T B$ | $\times n_h$ KV savings; slight perplexity drop |
| 2 | **GQA** | $n_{kv} \to n_h / G$ | $2 L (n_h/G) d_h b T B$ | Llama-3-8B GQA-8: **128 KiB/tok** (4× vs MHA-32) |
| 3 | **MLA** | $2 n_{kv} d_h \to d_c + d_h^R$ | $L(d_c + d_h^R) b T B$ | DeepSeek-V2 ($576$ elems, $L=60$): **67.5 KiB/tok BF16** |
| 4 | **Sliding Window** | $T \to \min(T, W)$ | $2 L n_{kv} d_h b \min(T, W) B$ | Mistral $W=4096$; $O(W)$ rolling buffer |
| 5 | **Attention Sinks** | $T \to n_{\text{sink}} + W$ | $2 L n_{kv} d_h b (n_{\text{sink}} + W) B$ | Keeps first 4 sinks; stable to 4M tokens, **22.2×** faster vs recompute |
| 6 | **PagedAttention** | Fragmentation $\to <4\%$ | $2 L n_{kv} d_h b \lceil T/B_{\text{blk}}\rceil B_{\text{blk}} B$ | Eliminates 60–80% static reservation waste; **2–4×** throughput |
| 7 | **RadixAttention** | Shared prefixes | $2 L n_{kv} d_h b \lvert\bigcup_i \text{prefix}_i\rvert$ | Radix-tree LRU prefix reuse; up to **6.4×** throughput |
| 8 | **KV Quantization** | $b: 2\text{B} \to 1\text{B} \to 0.25\text{B}$ | $2 L n_{kv} d_h b_q T B + \text{meta}$ | KIVI 2-bit (K per-channel, V per-token): **2.6×** lower peak VRAM |

---

## 3. Quantization Methods Matrix

| Method | Precision | Mechanism | Compute Cost | Quality / Failure Boundary |
| --- | --- | --- | --- | --- |
| **RTN PTQ** | INT8 / FP8 | Uniform affine $\mathrm{clamp}(\lfloor w/s \rceil + z, q_{\min}, q_{\max})$ | Seconds (no grad) | Near-lossless at 8-bit; collapses sharply below 4-bit |
| **QAT (STE)** | INT4 / INT2 | Forward fake-quant + backward $\partial\mathcal{L}/\partial w \approx \partial\mathcal{L}/\partial \hat w$ | Full training / FT budget | Best <4-bit accuracy, expensive pipeline |
| **GPTQ** | INT4 / INT3 | Layer-wise Hessian $\mathbf{H}=2XX^\top$; push residual $\boldsymbol{\delta}$ to unquantized columns | ~4 GPU-h for 175B | Overfits calibration domain if set too narrow |
| **AWQ** | INT4 | Activation-salient scaling $s_j = (\max\lvert X_{:,j}\rvert)^\alpha$, protect ~1% salient weights | Minutes (grid search $\alpha$) | Zero weight reconstruction; generalizes OOD cleanly |

---

## 4. Metrics & Production Drift Thresholds

| Metric / Test | Formula / Condition | Thresholds & Actionable Rule |
| --- | --- | --- |
| **Precision / Recall / $F_1$** | $P=\frac{TP}{TP+FP}$, $R=\frac{TP}{TP+FN}$, $F_1=\frac{2PR}{P+R}$ | Tune probability threshold $\tau$ on PR curve, never hardcode `0.5` under skew |
| **Log-Loss / Brier** | $-\frac{1}{n}\sum [y\ln p + (1-y)\ln(1-p)]$; $\frac{1}{n}\sum (p-y)^2$ | Proper scoring rules; evaluate calibration before threshold routing |
| **PSI** | $\sum_{i=1}^B (p_i^{\text{act}} - p_i^{\text{ref}})\ln(p_i^{\text{act}} / p_i^{\text{ref}})$ | `< 0.10` stable; `0.10–0.25` moderate shift (investigate); `> 0.25` major shift (retrain) |
| **Two-Sample KS** | $D_{n,m} = \sup_x \lvert F_{1,n}(x) - F_{2,m}(x)\rvert$ | Reject $H_0$ at $\alpha=0.05$ if $D_{n,m} > 1.358\sqrt{\frac{n+m}{nm}}$; always report $D$ effect size |
