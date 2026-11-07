# Fast-Lookup Reference: GitLab CI/CD & Supply-Chain Security

## 1. Core `.gitlab-ci.yml` Keywords

| Keyword | Syntax & Example | Description |
| :-- | :-- | :-- |
| `stages` | `stages: [build, test, deploy]` | Defines the global stage sequence of the pipeline. |
| `workflow:rules` | `workflow: { rules: [{ if: '$CI_PIPELINE_SOURCE == "merge_request_event"' }] }` | Controls whether the entire pipeline is created based on conditions. |
| `rules` | `rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'always' }]` | Conditional execution rules for individual jobs (`if`, `changes`, `exists`, `when`). |
| `needs` | `needs: [{ job: "build", artifacts: true }]` | Builds a Directed Acyclic Graph (DAG) dependency, bypassing stage barriers. |
| `artifacts` | `artifacts: { paths: ["dist/"], expire_in: "7 days" }` | Preserves files after job completion for downstream jobs or download. |
| `cache` | `cache: { key: "$CI_COMMIT_REF_SLUG", paths: [".npm/"] }` | Caches project dependencies across pipeline runs. |
| `resource_group` | `resource_group: production` | Serializes job execution to prevent concurrent deployments to the same environment. |
| `interruptible` | `interruptible: true` | Allows a job to be cancelled automatically when a newer pipeline runs on the same branch. |
| `parallel: matrix` | `parallel: { matrix: [{ PLATFORM: ["linux", "windows"] }] }` | Generates combinatorial job instances across specified matrix dimensions. |
| `id_tokens` | `id_tokens: { OIDC_JWT: { aud: "https://iam.amazonaws.com" } }` | Generates ephemeral OIDC JWT tokens for secure keyless cloud authentication. |

## 2. CI/CD Component Header (`spec:inputs`)

```yaml
spec:
  inputs:
    environment:
      type: string
      default: staging
      description: Target deployment environment
    enable_cache:
      type: boolean
      default: true
---
stages:
  - deploy
deploy-$[[ inputs.environment ]]:
  stage: deploy
  script:
    - echo "Deploying to $[[ inputs.environment ]] (cache: $[[ inputs.enable_cache ]])"
```

## 3. Predefined Variables Reference

| Variable | Description | Example Value |
| :-- | :-- | :-- |
| `CI_COMMIT_SHA` | The full commit hash of the current commit. | `2b1a3f9...` |
| `CI_COMMIT_REF_NAME` | The branch or tag name for which project is built. | `main` |
| `CI_PIPELINE_SOURCE` | How the pipeline was triggered (`push`, `merge_request_event`, `schedule`, `api`). | `merge_request_event` |
| `CI_DEFAULT_BRANCH` | The default branch configured for the project (e.g. `main`). | `main` |
| `CI_OPEN_MERGE_REQUESTS` | List of open merge requests for the current branch/ref. | `42` |
| `CI_REGISTRY_IMAGE` | The base image path for project container registry. | `registry.example.com/group/project` |

## 4. Variable Precedence Order

Variables are evaluated from highest to lowest precedence (earlier overrides later):

1. Trigger variables / Pipeline API variables (highest).
2. Scheduled pipeline execution variables.
3. Manual pipeline trigger variables via GitLab Web UI.
4. Project-level CI/CD variables (Settings > CI/CD > Variables).
5. Group-level CI/CD variables (inherited down tree).
6. Instance-level CI/CD variables (admin settings).
7. Job-level `variables:` defined in YAML (`job: variables:`).
8. Pipeline root `variables:` defined in YAML (`variables:` global).
9. Inherited variables via `extends`, `!reference`, or components.
10. Predefined runner variables (`CI_COMMIT_SHA`, etc. - lowest).

## 5. Security & Supply-Chain CLI Cheatsheet

### Syft (SBOM Generation)

```bash
# Generate CycloneDX JSON SBOM for a container image
syft packages oci-registry:registry.example.com/app:v1.0.0 -o cyclonedx-json=sbom.cdx.json

# Generate SPDX JSON SBOM for local directory
syft packages dir:. -o spdx-json=sbom-spdx.json
```

### Trivy (Vulnerability & Artifact Scanning)

```bash
# Scan container image for vulnerabilities
trivy image --severity HIGH,CRITICAL registry.example.com/app:v1.0.0

# Scan SBOM file for vulnerabilities
trivy sbom sbom.cdx.json
```

### Cosign v3 (Keyless Signing & Attestation)

```bash
# Keyless sign immutable container image digest using GitLab OIDC token
cosign sign --yes --identity-token="$SIGSTORE_ID_TOKEN" registry.example.com/app@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Attach CycloneDX SBOM and SLSA Provenance v1.0 attestation to image digest
cosign attest --yes --identity-token="$SIGSTORE_ID_TOKEN" --type cyclonedx --predicate sbom.cdx.json registry.example.com/app@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
cosign attest --yes --identity-token="$SIGSTORE_ID_TOKEN" --type slsaprovenance1 --predicate provenance.json registry.example.com/app@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

# Verify signed image digest and attestations
cosign verify --certificate-identity-regexp "https://gitlab.com/*" --certificate-issuer "https://gitlab.com" registry.example.com/app@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

### `gitlab-ci-local` (Local Pipeline Execution)

```bash
# Run entire pipeline locally
gitlab-ci-local

# Run specific job locally with variable override
gitlab-ci-local build_job --variable ENVIRONMENT=staging
```
