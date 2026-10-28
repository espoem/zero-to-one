# Brief: Containers (`technologies/containers`)

| | |
|---|---|
| Phase | 3 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · Claude Code** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/containers` · `../zto-containers` |
| Depends on | phase 2 foundations |
| Research dossier | `.agents/research/E-platform.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- None beyond the dossier and AGENTS.md.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Linux processes, signals, filesystems, namespaces, cgroups v2, overlayfs, seccomp
- OCI image/runtime/distribution specs, BuildKit, rootless, Docker vs Podman
- Shared compose-stack conventions (`examples/_compose`)

**Cross-link only (do not re-explain):**
- TCP/IP, UDP, routing/BGP/anycast, NAT, DNS, congestion control → owned by `architecture/networking`
- Linux network tooling (ss, tcpdump, iproute2, nftables, netns) → owned by `architecture/networking`
- CI/CD pipelines, SBOM, signing (cosign), SLSA provenance, OIDC-to-cloud from CI → owned by `technologies/gitlab-ci`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Containers (Docker + Podman) — `technologies/containers`

- **Current stable version(s)** (tag dates from upstream repos):
  - Docker Engine **29.9.2** (tag `docker-v29.9.2`, 2026-10-20; moby/moby now tags engine releases as `docker-vX`; docker/cli v29.9.2). v29 baseline changes: min API 1.44, **containerd image store default for new installs**, graph drivers deprecated, experimental `--firewall-backend=nftables`, Go module path moved to `github.com/moby/moby` — https://www.docker.com/blog/docker-engine-version-29/ , https://docs.docker.com/engine/release-notes/29/
  - Docker Compose **v5.6.1** (2026-10-21). v5 is "functionally identical to Compose v2"; adds official Go SDK; version jump to avoid confusion with legacy file-format "v2/v3" — https://docs.docker.com/compose/intro/history/
  - BuildKit **v0.34.1** (2026-10-20); buildx v0.38.1.
  - Podman **6.1.4** (2026-10-12; 6.0.0 tagged 2026-06-24). 6.0 breaking: slirp4netns removed (pasta only), **cgroups v1 removed**, BoltDB removed (SQLite only; upgrade via 5.8 first), Netavark drops iptables → nftables, containers.conf/storage.conf parsing reworked — https://fedoraproject.org/wiki/Changes/Podman6 . (Search results mention a `podman-container-tools/podman` GitHub org — possible repo move, unverified.)
  - Buildah **1.46.0**, Skopeo **1.24.1**, runc **1.5.2**, crun **1.30.1**, containerd **2.4.2** (2026-10-13).
  - OCI specs: image-spec **v1.1.1** (2025-03-03), runtime-spec **v1.3.0** (2025-11-04), distribution-spec **v1.1.1** (2025-01-29) — https://github.com/opencontainers
- **Authoritative syllabi used**:
  - OCI specs (primary definitions): https://github.com/opencontainers/image-spec , /runtime-spec , /distribution-spec
  - Linux man pages: namespaces(7), cgroups(7), user_namespaces(7), capabilities(7), seccomp(2); kernel cgroup v2 doc https://docs.kernel.org/admin-guide/cgroup-v2.html ; overlayfs https://docs.kernel.org/filesystems/overlayfs.html
  - Docker docs ToC (build, engine, compose, security): https://docs.docker.com/ ; Dockerfile reference https://docs.docker.com/reference/dockerfile/ ; Compose spec https://github.com/compose-spec/compose-spec
  - Podman docs https://docs.podman.io/ ; Quadlet `podman-systemd.unit(5)`
  - Docker Certified Associate (DCA, Mirantis) is legacy and not worth targeting (unverified current status); CKAD "Application Design and Build 20%" (define/build/modify images) and CKS "Supply Chain Security 20%" + "Minimize base image footprint" overlap — curricula at https://github.com/cncf/curriculum
- **Proposed modules** (12):
  1. **What a container is (and isn't)** — process + namespaces + cgroups + rootfs; VM vs container; why Mac/Windows run a Linux VM (Docker Desktop, Colima/Lima, podman machine); OCI layering of the ecosystem (CLI → daemon → containerd → shim → runc/crun).
  2. **Linux namespaces** — pid, mnt, net, uts, ipc, user, cgroup, time; `unshare`/`nsenter`/`setns`; PID 1 semantics (signal handling, zombie reaping, `--init`/tini); user-ns UID mapping (`/proc/self/uid_map`, subuid/subgid).
  3. **cgroups v2** — unified hierarchy, controllers (cpu.max, cpu.weight, memory.max/high/low, pids.max, io.max); OOM killer & `memory.events`; PSI; CPU throttling (CFS quota period); systemd as cgroup manager; v1 removal (Podman 6, K8s 1.35 FailCgroupV1).
  4. **Filesystems & storage** — overlayfs lowerdir/upperdir/workdir, whiteouts, copy-up cost; storage drivers vs containerd snapshotters; volumes vs bind mounts vs tmpfs; SELinux `:z/:Z` relabeling; idmapped mounts.
  5. **OCI image spec** — manifest, image index (multi-arch), config, layers (tar+gzip/zstd), content-addressable digests, annotations, artifacts & `subject`/referrers (v1.1); tags vs digests; reproducibility (SOURCE_DATE_EPOCH).
  6. **OCI runtime spec & runtimes** — `config.json`, bundle, lifecycle (create/start/kill/delete), hooks; runc vs crun vs gVisor/Kata (sandboxed); containerd shim v2; CRI preview.
  7. **OCI distribution spec & registries** — pull/push API, blob mounts, chunked uploads, auth token flow, rate limits, mirrors/pull-through caches; Skopeo copy/inspect; `crane`/`oras`.
  8. **Building images: Dockerfile + BuildKit** — instruction semantics (RUN/COPY/ADD, shell vs exec form, ENTRYPOINT+CMD), cache keys & invalidation, multi-stage, `--mount=type=cache|secret|ssh`, heredocs, `.dockerignore`, buildx multi-platform (QEMU vs native nodes), bake, cache export (registry/gha/local), Buildah alternative (scripts, `buildah unshare`).
  9. **Container networking** — veth pairs, bridges, NAT/iptables→nftables, port publishing, DNS on user-defined networks, host/none/macvlan; rootless networking (pasta, slirp4netns removed in Podman 6); Netavark/aardvark-dns; CNI preview for K8s.
  10. **Docker vs Podman/Buildah/Skopeo** — daemon vs fork/exec, socket API compatibility (`podman system service`), pods, Quadlet/systemd integration, `podman kube play/generate`, rootless defaults, compose (docker compose vs podman compose), Desktop/machine VMs on macOS.
  11. **Compose in depth** — Compose spec, merge/override/`include`, profiles, `depends_on` conditions + healthchecks, project name collisions, watch/develop, env interpolation precedence, Compose v5 SDK; when Compose stops being enough.
  12. **Security & supply chain** — rootless vs userns-remap, capabilities drop, seccomp/AppArmor/SELinux profiles, read-only rootfs, no-new-privileges, socket exposure risk, image minimisation (distroless/scratch/chainguard-style), scanning (Trivy), SBOM (syft), signing (cosign v3), provenance attestations (SLSA via BuildKit), CVE triage.
- **Gotchas & production failure modes**:
  - `ENTRYPOINT` in shell form → app is not PID 1, never gets SIGTERM, killed after 10 s grace (SIGKILL); exit code 137 misread as OOM.
  - Exit 137 ≠ always OOM: check `memory.events oom_kill` / `docker inspect .State.OOMKilled`.
  - Mounting `/var/run/docker.sock` into a container = root on the host.
  - `COPY . .` before `RUN npm ci` busts the dependency cache on every source change; missing `.dockerignore` ships `.git`/`node_modules`/secrets into context and layers.
  - Secrets via `ARG`/`ENV` persist in image history/config; use `RUN --mount=type=secret`.
  - Deleting a file in a later layer doesn't shrink the image (whiteout); `rm` must be in the same `RUN`.
  - `latest` + `imagePullPolicy` / mutable tags → non-reproducible deploys; pin by digest.
  - Docker publishes ports by inserting iptables rules **ahead of** ufw/firewalld rules → "firewalled" ports exposed; `DOCKER-USER` chain needed (and must be migrated under nftables backend).
  - JVM/Node/Go runtimes not cgroup-aware in old versions → heap sized to host RAM → OOM kills; CPU quota throttling with high thread counts (GOMAXPROCS).
  - overlayfs copy-up on large files (DB files written in image layer) — huge latency/space; use volumes.
  - Bind-mount UID mismatch in rootless mode (files owned by subuid 100999 on host); `--userns=keep-id` (Podman).
  - Docker Hub pull rate limits break CI; configure a mirror/pull-through cache.
  - Multi-arch: building amd64 on Apple Silicon via QEMU is 5–20x slower and can segfault on some toolchains; image index missing a platform → `exec format error`.
  - Upgrading to Podman 6 with BoltDB state → containers unusable unless migrated via 5.8 first.
  - Docker 29 raised minimum API to 1.44 → old CI clients/SDKs (e.g. older Testcontainers/docker-py) fail with "client version too old".
  - Zombie processes accumulate when PID 1 is a shell script without `exec`/init.
  - Log driver `json-file` without rotation fills the disk.
- **Interview hot topics**:
  - Container vs VM; what isolation actually exists (shared kernel).
  - Namespaces + cgroups explanation, and how rootless works (user namespaces, subuid).
  - Image layers, digests, multi-stage builds, cache invalidation rules.
  - PID 1 / signal handling / graceful shutdown.
  - CMD vs ENTRYPOINT, shell vs exec form.
  - How `docker run` flows through containerd/shim/runc.
  - Docker vs Podman architectural differences.
  - Image hardening and supply chain (SBOM, signing, scanning).
  - Container networking (bridge, NAT, port publishing).
  - Debugging a crashing/OOM-killed container.
- **Executable-proof strategy**:
  - Mac host: namespaces/cgroups/overlayfs labs must run **inside a Linux VM** — Lima **v2.2.1** or Colima **v0.10.3** (or `podman machine`); scripts executed via `limactl shell`. Flag: kernel primitives cannot be demonstrated natively on macOS.
  - Bats or pytest suites that assert observable kernel facts (e.g. `readlink /proc/$pid/ns/pid` differs; `cat memory.max` equals the `--memory` flag; OOM test: allocate > limit → assert `oom_kill` counter incremented, exit 137).
  - Build tests: `docker buildx build --check` (Dockerfile lint rules), hadolint **v2.15.1**, assert image size budget and layer count via `docker image inspect`/`skopeo inspect`; dive **v0.13.1** CI mode for wasted-space thresholds; reproducibility test: build twice with `SOURCE_DATE_EPOCH` → identical digest.
  - Registry tests: local `registry:3` (distribution) container; skopeo copy/inspect; negative tests (pull by wrong digest fails, unsigned image rejected by `cosign verify`, cosign **v3.1.4**).
  - Security negatives: container without CAP_NET_RAW cannot ping; read-only rootfs write fails; seccomp profile blocks `unshare`.
  - Testcontainers (Node **v12.2.1**) for app-level integration.
  - mise pins: docker CLI, buildx, compose, podman (CLI via brew/mise aqua — verify registry), hadolint, dive, trivy **v0.76.1**, cosign, skopeo (Linux-only binaries → install inside VM).
- **Overlaps / dedupe**:
  - Linux process model, signals, filesystems, networking basics (iptables/nftables, veth, bridges) → a `foundations/linux` (or `foundations/networking`) track; containers cross-links.
  - CRI/containerd-in-K8s, Pod security contexts → kubernetes track.
  - SBOM/signing/SLSA pipeline mechanics → gitlab-ci track (containers explains the artifacts; CI shows enforcement).
  - Compose-based local stacks reused by observability/terraform examples — keep a shared `examples/_compose` convention, not duplicated content.

---

#### Context from `E-platform.md`

##### Structural decisions (summary)

| Question | Recommendation | Rationale |
|---|---|---|
| Docker vs Podman | **One track `technologies/containers`** | Both are front-ends over the same OCI image/runtime/distribution specs, same kernel primitives (namespaces, cgroups v2, overlayfs, seccomp), same runtimes (runc/crun). Splitting would duplicate ~70% of content. Tool differences (daemon vs daemonless, rootless defaults, Quadlet vs compose, Buildah/Skopeo) fit in 2 modules. |
| Kubernetes | **`technologies/kubernetes`**, prerequisite = containers | Single narrative covering CKA+CKAD; CKS content as late modules (security). |
| Argo CD | **Standalone `technologies/argocd`, scoped as "GitOps with Argo CD (+ Argo Rollouts)"** | Too deep (controller internals, sharding, ApplicationSets, hydrator, RBAC, multi-tenancy) to be one K8s module; but should not become an "all of Argo" track — CAPA is 36% Workflows + 12% Events, which are a different problem (batch/DAG). Cover CGOA (100%) + CAPA's Argo CD 34% + Rollouts 18%; Workflows/Events = one optional appendix module. Flux only as comparison. A separate `gitops` track is not justified (principles = 1 module). |
| Grafana / Kibana | **One track `technologies/observability`** (vendor-neutral spine: OTel + signals + SLOs; two backends: Grafana LGTM and Elastic) | The concepts (signals, cardinality, sampling, alerting, SLOs) are tool-independent; Grafana and Kibana are UIs over different stores. Boundary: the Elasticsearch track owns ES storage/indexing/mappings/query DSL/ES|QL internals/ILM; observability owns Kibana dashboards/Lens/Discover, alerting rules, Elastic Observability (APM, EDOT, Synthetics), and only cross-links ES internals. |
| CI/CD | **Yes: `technologies/gitlab-ci`** (smaller, 9–10 modules) | User uses GitLab; pipelines are where containers, Terraform, K8s and GitOps meet (build → scan → sign → push → update GitOps repo). Supply-chain security (SBOM, cosign, SLSA) lives here and is cross-linked from containers + CKS module. |

Suggested order: containers → kubernetes → (terraform in parallel) → argocd → gitlab-ci → observability.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Podman **6.1.4** (2026-10-12; 6.0.0 tagged 2026-06-24). 6.0 breaking: slirp4netns removed (pasta only), **cgroups v1 removed**, BoltDB removed (SQLite only; upgrade via 5.8 first), Netavark drops iptables → nftables, containers.conf/storage.conf parsing reworked — https://fedoraproject.org/wiki/Changes/Podman6 . (Search results mention a `podman-container-tools/podman` GitHub org — possible repo move, unverified.)
- Docker Certified Associate (DCA, Mirantis) is legacy and not worth targeting (unverified current status); CKAD "Application Design and Build 20%" (define/build/modify images) and CKS "Supply Chain Security 20%" + "Minimize base image footprint" overlap — curricula at https://github.com/cncf/curriculum

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/containers` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(containers)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/containers.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/containers.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
