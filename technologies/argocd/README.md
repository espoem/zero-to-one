# Argo CD & GitOps Curriculum (`technologies/argocd`)

Verified against Argo CD 3.5.6, Argo Rollouts 1.10.1, Argo Workflows 4.1.6, Flux 2.10.0, OpenGitOps 1.0.0, Helm 4.3.1, Kustomize 5.8.3, kind 0.33.0, Chainsaw 0.2.15, Node 26.13.0, TypeScript 7.0.2 on 2026-11-07.

## Prerequisites

Before diving into Argo CD and declarative GitOps delivery, ensure you have mastered the foundational tracks:

- [`../kubernetes/README.md`](../kubernetes/README.md): Kubernetes API server, CRDs, controllers, workload primitives, RBAC, and client-side vs server-side apply.
- [`../containers/README.md`](../containers/README.md): OCI container images, namespaces, cgroups v2, and container runtimes.
- [`../gitlab-ci/README.md`](../gitlab-ci/README.md): Continuous integration pipelines, artifact generation, container registry integration, and Git handoffs.
- [`../terraform/README.md`](../terraform/README.md): Infrastructure as Code principles, state management, and policy-as-code foundations.
- [`../../architecture/security-identity/README.md`](../../architecture/security-identity/README.md): PKI, X.509 certificates, mTLS, OIDC authentication, and Casbin authorization models.

## Syllabus

| Module | Title | Core Topics |
| :-- | :-- | :-- |
| [`modules/01-gitops-principles-and-architecture-comparison.md`](modules/01-gitops-principles-and-architecture-comparison.md) | GitOps Principles and Architecture Comparison | OpenGitOps 4 axioms, push CI/CD vs pull GitOps, Argo CD vs Flux, failure modes. |
| [`modules/02-argocd-architecture-and-controllers.md`](modules/02-argocd-architecture-and-controllers.md) | Argo CD Architecture and Internals | API server, repo-server caching, application-controller, Redis, Dex/OIDC, CRDs. |
| [`modules/03-applications-and-manifest-sources.md`](modules/03-applications-and-manifest-sources.md) | Applications and Manifest Sources | Plain manifests, Helm 4, Kustomize, multi-source apps, config management plugins. |
| [`modules/04-sync-mechanics-waves-and-hooks.md`](modules/04-sync-mechanics-waves-and-hooks.md) | Sync Mechanics, Waves, and Hooks | Live vs desired normalization, SSA, sync waves, lifecycle hooks, custom health. |
| [`modules/05-drift-reconciliation-and-app-of-apps.md`](modules/05-drift-reconciliation-and-app-of-apps.md) | Drift Detection and Reconciliation Patterns | Refresh/hard refresh, webhooks vs polling, app-of-apps pattern, finalizers. |
| [`modules/06-applicationsets-and-generators.md`](modules/06-applicationsets-and-generators.md) | ApplicationSets at Scale | List, cluster, git, matrix, merge generators, progressive synchronization. |
| [`modules/07-multi-tenancy-rbac-and-secrets.md`](modules/07-multi-tenancy-rbac-and-secrets.md) | Multi-Tenancy, Security, and GitOps Secrets | AppProjects, Casbin 3.x fine-grained RBAC, impersonation, SOPS, External Secrets. |
| [`modules/08-repo-structure-promotion-and-hydrator.md`](modules/08-repo-structure-promotion-and-hydrator.md) | Repository Topology and Environment Promotion | Monorepo vs polyrepo, folder-per-env, Source Hydrator, image updater automation. |
| [`modules/09-progressive-delivery-argo-rollouts.md`](modules/09-progressive-delivery-argo-rollouts.md) | Progressive Delivery with Argo Rollouts | Rollout CRD, blue/green vs canary, Gateway API routing, AnalysisTemplate. |
| [`modules/10-operating-argocd-at-scale.md`](modules/10-operating-argocd-at-scale.md) | Operating Argo CD at Scale | HA installation, controller sharding, repo-server tuning, exclusions, Redis HA. |
| [`modules/11-argo-workflows-events-and-version-history.md`](modules/11-argo-workflows-events-and-version-history.md) | The Wider Argo Ecosystem and Version History | Argo Workflows DAGs, Argo Events sensors, CAPA synthesis, release history. |

## Out of Scope

- Core Kubernetes cluster administration (covered in [`../kubernetes/README.md`](../kubernetes/README.md)).
- Raw container image building and vulnerability scanning (covered in [`../containers/README.md`](../containers/README.md) and [`../gitlab-ci/README.md`](../gitlab-ci/README.md)).
- Low-level network routing, CNI packet forwarding, and Envoy mesh configuration (covered in [`../../architecture/networking/README.md`](../../architecture/networking/README.md)).

## Certifications & Exams

This track prepares candidates for two official Linux Foundation and CNCF certifications:

1. **Certified GitOps Associate (CGOA)**:
   - **Vendor**: Linux Foundation / CNCF
   - **Official Guide**: [`https://www.cncf.io/certification/cgoa/`](https://www.cncf.io/certification/cgoa/)
   - **Curriculum Spec**: [`https://github.com/cncf/curriculum`](https://github.com/cncf/curriculum)
   - **Guide Date Verified**: 2026-11-07
   - **Status**: Active
   - **Format**: 60 multiple-choice questions, 90 minutes, 75% passing score.
   - **Domain Weighting**:
     - GitOps Principles: 30%
     - GitOps Terminology: 20%
     - GitOps Patterns: 20%
     - Related Practices: 16%
     - Tooling: 14%

2. **Certified Argo Project Associate (CAPA)**:
   - **Vendor**: Linux Foundation / CNCF
   - **Official Guide**: [`https://www.cncf.io/certification/capa/`](https://www.cncf.io/certification/capa/)
   - **Curriculum Spec**: [`https://github.com/cncf/curriculum`](https://github.com/cncf/curriculum)
   - **Guide Date Verified**: 2026-11-07
   - **Status**: Active
   - **Format**: 60 multiple-choice questions, 90 minutes, 75% passing score.
   - **Domain Weighting**:
     - Argo Workflows: 36%
     - Argo CD: 34%
     - Argo Rollouts: 18%
     - Argo Events: 12%

See [`exams/README.md`](exams/README.md) for complete domain coverage matrices and [`exams/cgoa-and-capa.md`](exams/cgoa-and-capa.md) for the 65-question preparation bank and mock exam.
