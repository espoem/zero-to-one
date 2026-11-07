# Certification Coverage Matrix (`technologies/argocd/exams/README.md`)

Comprehensive domain coverage mapping for the **Certified GitOps Associate (CGOA)** and **Certified Argo Project Associate (CAPA)** certifications. Every official domain and objective maps to track modules and verified test suites.

## 1. Certified GitOps Associate (CGOA) Coverage Matrix

| Domain ID | Domain Title | Official Weight | Target Questions | Modules Covered | Example Test Suites | Coverage Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **CGOA-D1** | GitOps Principles | 30% | 10 | [`modules/01-gitops-principles-and-architecture-comparison.md`](../modules/01-gitops-principles-and-architecture-comparison.md) | `examples/ts/01-gitops-principles-and-architecture-comparison.test.ts` | ✅ Full |
| **CGOA-D2** | GitOps Terminology | 20% | 7 | [`modules/01-gitops-principles-and-architecture-comparison.md`](../modules/01-gitops-principles-and-architecture-comparison.md), [`modules/02-argocd-architecture-and-controllers.md`](../modules/02-argocd-architecture-and-controllers.md) | `examples/ts/02-argocd-architecture-and-controllers.test.ts` | ✅ Full |
| **CGOA-D3** | GitOps Patterns | 20% | 7 | [`modules/04-sync-mechanics-waves-and-hooks.md`](../modules/04-sync-mechanics-waves-and-hooks.md), [`modules/05-drift-reconciliation-and-app-of-apps.md`](../modules/05-drift-reconciliation-and-app-of-apps.md), [`modules/08-repo-structure-promotion-and-hydrator.md`](../modules/08-repo-structure-promotion-and-hydrator.md) | `examples/ts/04-sync-mechanics-waves-and-hooks.test.ts` | ✅ Full |
| **CGOA-D4** | Related Practices | 16% | 5 | [`modules/07-multi-tenancy-rbac-and-secrets.md`](../modules/07-multi-tenancy-rbac-and-secrets.md), [`modules/08-repo-structure-promotion-and-hydrator.md`](../modules/08-repo-structure-promotion-and-hydrator.md) | `examples/ts/07-multi-tenancy-rbac-and-secrets.test.ts` | ✅ Full |
| **CGOA-D5** | Tooling | 14% | 5 | [`modules/01-gitops-principles-and-architecture-comparison.md`](../modules/01-gitops-principles-and-architecture-comparison.md), [`modules/03-applications-and-manifest-sources.md`](../modules/03-applications-and-manifest-sources.md), [`modules/06-applicationsets-and-generators.md`](../modules/06-applicationsets-and-generators.md) | `examples/ts/06-applicationsets-and-generators.test.ts` | ✅ Full |

## 2. Certified Argo Project Associate (CAPA) Coverage Matrix

| Domain ID | Domain Title | Official Weight | Target Questions | Modules Covered | Example Test Suites | Coverage Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **CAPA-D1** | Argo Workflows | 36% | 12 | [`modules/11-argo-workflows-events-and-version-history.md`](../modules/11-argo-workflows-events-and-version-history.md) | `examples/ts/11-argo-workflows-events-and-version-history.test.ts` | ✅ Full |
| **CAPA-D2** | Argo CD | 34% | 11 | [`modules/02-argocd-architecture-and-controllers.md`](../modules/02-argocd-architecture-and-controllers.md), [`modules/03-applications-and-manifest-sources.md`](../modules/03-applications-and-manifest-sources.md), [`modules/04-sync-mechanics-waves-and-hooks.md`](../modules/04-sync-mechanics-waves-and-hooks.md), [`modules/05-drift-reconciliation-and-app-of-apps.md`](../modules/05-drift-reconciliation-and-app-of-apps.md), [`modules/10-operating-argocd-at-scale.md`](../modules/10-operating-argocd-at-scale.md) | `examples/ts/10-operating-argocd-at-scale.test.ts` | ✅ Full |
| **CAPA-D3** | Argo Rollouts | 18% | 6 | [`modules/09-progressive-delivery-argo-rollouts.md`](../modules/09-progressive-delivery-argo-rollouts.md) | `examples/ts/09-progressive-delivery-argo-rollouts.test.ts` | ✅ Full |
| **CAPA-D4** | Argo Events | 12% | 4 | [`modules/11-argo-workflows-events-and-version-history.md`](../modules/11-argo-workflows-events-and-version-history.md) | `examples/ts/11-argo-workflows-events-and-version-history.test.ts` | ✅ Full |

## 3. Exam Delta Notes

- **Argo CD 3.x Resource Tracking**: Exams referencing legacy 2.x versions assume label-based tracking (`app.kubernetes.io/instance`). Argo CD 3.5 default tracking uses annotation tracking (`argocd.argoproj.io/tracking-id`) to prevent label collision.
- **Helm 4 Integration**: Modern Argo CD v3.5 natively supports Helm 4 chart specifications and dependency management alongside legacy Helm 3 charts.
- **Fine-Grained RBAC**: Argo CD 3.x enforces strict sub-resource permission checks (e.g., log access requires explicit resource rules in Casbin `argocd-rbac-cm` unlike permissive 2.x defaults).
