# Certification Examination Question Bank: GitLab CI/CD, Runners, and Supply-Chain Security

This question bank contains **65 original examination questions** (`Q-GLCI-001` through `Q-GLCI-065`) covering all six domains of the GitLab CI/CD and Software Supply-Chain Security curriculum, followed by a full timed **Mock Exam**.

---

## Domain 1: CI/CD Fundamentals, DORA Metrics & GitLab Pipeline DAG Architecture (12 Questions)

### Q-GLCI-001 · D1 · difficulty 1 · single

Which of the following best defines Lead Time for Changes, a core DORA metric?

- A) The total number of pull requests opened per developer per week.
- B) The duration from code commit entering version control to successful production deployment.
- C) The time required to restore service after a production outage.
- D) The percentage of deployments that cause a production failure.

<details><summary>Answer</summary>

**B.** Lead Time for Changes measures the elapsed time from a developer committing code to that code running successfully in production, reflecting end-to-end software delivery velocity.

- Why not A: PR count is an activity metric, not a delivery velocity metric.
- Why not C: Service restoration time is Mean Time to Recovery (MTTR).
- Why not D: Deployment failure rate is Change Failure Rate (CFR).
- Ref: [modules/01-cicd-fundamentals-and-dora.md](../modules/01-cicd-fundamentals-and-dora.md), https://dora.dev/research/

</details>

### Q-GLCI-002 · D1 · difficulty 2 · single

What distinguishes trunk-based development from traditional GitFlow branching models in a CI/CD context?

- A) Developers work on long-lived feature branches for months before merging.
- B) Code is merged frequently (at least daily) into a shared central branch with automated testing gating every commit.
- C) Releases are performed manually by a release manager once a quarter.
- D) Feature branches are never merged into main without explicit VP approval.

<details><summary>Answer</summary>

**B.** Trunk-based development relies on short-lived branches merged frequently into the trunk, enabling rapid continuous integration feedback loops.

- Why not A: Long-lived branches characterize GitFlow, violating CI principles.
- Why not C: Releases in CI/CD pipelines are automated.
- Why not D: Gate automation replaces manual VP approvals in modern pipelines.
- Ref: [modules/01-cicd-fundamentals-and-dora.md](../modules/01-cicd-fundamentals-and-dora.md), https://trunkbaseddevelopment.com/

</details>

### Q-GLCI-003 · D1 · difficulty 1 · single

In GitLab CI/CD YAML parsing, what is the primary function of the `stages` keyword?

- A) To define environment variable scope for runner jobs.
- B) To define the global ordered sequence of execution phases across the pipeline.
- C) To configure SSH authentication credentials for remote runners.
- D) To specify container registry authentication secrets.

<details><summary>Answer</summary>

**B.** The `stages` keyword defines the global order of stages in a pipeline; all jobs assigned to a stage execute in parallel (up to concurrency limits) and must complete before the next stage begins.

- Why not A: Variables are configured via `variables:`, not `stages`.
- Why not C: SSH keys are managed via CI/CD secrets or settings.
- Why not D: Registry credentials are configured in GitLab Project Settings or CI variables.
- Ref: [modules/01-cicd-fundamentals-and-dora.md](../modules/01-cicd-fundamentals-and-dora.md), https://docs.gitlab.com/ee/ci/yaml/

</details>

### Q-GLCI-004 · D1 · difficulty 2 · scenario

An engineering team notices that their CI/CD pipeline stage barrier causes `build-backend` (taking 2 seconds) and `lint-docs` (taking 10 minutes) to block a fast integration test job. How can this bottleneck be resolved using GitLab CI/CD features?

- A) Increase runner machine CPU cores.
- B) Convert the pipeline stage dependency into a Directed Acyclic Graph (DAG) using the `needs` keyword.
- C) Disable all linting jobs permanently.
- D) Split the repository into 50 separate Git repositories.

<details><summary>Answer</summary>

**B.** The `needs` keyword allows jobs to start as soon as their explicit predecessor jobs finish, bypassing strict stage barrier sequencing.

- Why not A: Hardware upgrades do not eliminate structural stage barriers.
- Why not C: Disabling checks degrades code quality.
- Why not D: Splitting repos is an extreme architecture change when DAG execution solves the scheduling bottleneck natively.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md), https://docs.gitlab.com/ee/ci/yaml/#needs

</details>

### Q-GLCI-005 · D1 · difficulty 2 · multi

Which of the following are recognized DORA core metrics? (Select all that apply)

- A) Deployment Frequency
- B) Lead Time for Changes
- C) Lines of Code Written per Day
- D) Mean Time to Recovery (MTTR)
- E) Change Failure Rate

<details><summary>Answer</summary>

**A, B, D, E.** The four core DORA metrics are Deployment Frequency, Lead Time for Changes, Mean Time to Recovery, and Change Failure Rate.

- Why not C: Lines of code is an anti-pattern metric that does not measure software delivery performance.
- Ref: [modules/01-cicd-fundamentals-and-dora.md](../modules/01-cicd-fundamentals-and-dora.md), https://dora.dev/

</details>

### Q-GLCI-006 · D1 · difficulty 3 · ordering

Order the following pipeline execution lifecycle events from first to last:

1. Job transitions to `pending` queue state.
2. GitLab Runner polls and acquires job.
3. Pipeline triggered by git push event.
4. Runner executes script commands and uploads artifacts.

- A) 3 -> 1 -> 2 -> 4
- B) 1 -> 3 -> 2 -> 4
- C) 3 -> 2 -> 1 -> 4
- D) 4 -> 3 -> 2 -> 1

<details><summary>Answer</summary>

**A.** First a push event creates the pipeline (3), jobs enter the pending queue (1), a runner polls and acquires the job (2), and finally the runner executes the script and uploads artifacts (4).

- Why not B, C, D: Incorrect chronological order of job scheduling and execution.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md), https://docs.gitlab.com/ee/ci/pipelines/

</details>

### Q-GLCI-007 · D1 · difficulty 2 · single

What is the primary purpose of `workflow:rules` in a GitLab CI/CD pipeline?

- A) To restrict which developers can push to the main branch.
- B) To determine whether an entire pipeline should be created or skipped when a git event occurs.
- C) To define container registry image tag formats.
- D) To configure Kubernetes RBAC permissions for runners.

<details><summary>Answer</summary>

**B.** Top-level `workflow:rules` evaluate rules to control pipeline creation, preventing duplicate or unwanted pipelines (such as duplicate branch and merge request pipelines).

- Why not A: Branch permissions are managed in GitLab Protected Branches settings.
- Why not C: Image tags are defined in job script commands.
- Why not D: Runner RBAC is configured in Kubernetes cluster manifests.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md), https://docs.gitlab.com/ee/ci/yaml/#workflowrules

</details>

### Q-GLCI-008 · D1 · difficulty 1 · single

Which variable precedence scope overrides instance, group, project, and YAML global variables in GitLab CI/CD when name collisions occur?

- A) Group-level variables
- B) Project-level variables
- C) Job-level YAML variables and trigger / scheduled pipeline variables
- D) Pipeline predefined variables (e.g., `CI_COMMIT_SHA`)

<details><summary>Answer</summary>

**C.** Trigger / scheduled pipeline variables and job-level YAML variables take higher precedence than project, group, instance, and root YAML global variables (with trigger and pipeline api variables at the absolute top). Predefined variables have the lowest precedence.

- Why not A, B, D: Group, project, and predefined variables rank lower in the 10-tier precedence hierarchy.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md#4-variable-precedence-hierarchy), https://docs.gitlab.com/ci/variables/

</details>

### Q-GLCI-009 · D1 · difficulty 2 · scenario

A team wants to ensure that CI jobs on feature branches are automatically cancelled when a newer commit is pushed to the same branch. Which keyword enables this behavior?

- A) `retry: 3`
- B) `interruptible: true`
- C) `allow_failure: true`
- D) `resource_group: main`

<details><summary>Answer</summary>

**B.** Setting `interruptible: true` on a job tells GitLab to cancel that job if a newer pipeline starts on the same branch, saving runner compute resources.

- Why not A: `retry` re-runs failed jobs.
- Why not C: `allow_failure` allows pipeline to pass even if the job fails.
- Why not D: `resource_group` serializes deployments.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md), https://docs.gitlab.com/ee/ci/yaml/#interruptible

</details>

### Q-GLCI-010 · D1 · difficulty 3 · single

How do explicit DAG dependencies (`needs`) interact with traditional stages in GitLab CI/CD?

- A) `needs` completely disables stages, causing all jobs to execute simultaneously.
- B) Jobs using `needs` can execute as soon as their required predecessor jobs complete, regardless of stage boundaries.
- C) `needs` only works within the same stage; it cannot cross stage boundaries.
- D) `needs` enforces that predecessor jobs must be in a later stage.

<details><summary>Answer</summary>

**B.** The `needs` keyword allows a job to start as soon as its listed dependencies finish, bypassing traditional stage barrier order.

- Why not A: Stages still govern overall pipeline grouping; jobs without `needs` follow stage order.
- Why not C: Cross-stage dependencies are the primary use case of `needs`.
- Why not D: Predecessors must be in earlier or same stages, never later.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md), https://docs.gitlab.com/ee/ci/yaml/#needs

</details>

### Q-GLCI-011 · D1 · difficulty 1 · single

What is the main advantage of Pipeline-as-Code stored in `.gitlab-ci.yml` compared to external UI-driven CI configurations?

- A) It eliminates the need for GitLab Runners.
- B) Version control history tracks pipeline definition changes alongside application source code changes.
- C) It guarantees 100% test coverage on all pull requests.
- D) It prevents YAML syntax errors from ever occurring.

<details><summary>Answer</summary>

**B.** Pipeline-as-Code stores CI/CD definitions in git version control, ensuring auditability, reviewability, and version alignment with application code.

- Why not A: Runners are still required to execute jobs.
- Why not C: Test coverage depends on test suites, not YAML storage.
- Why not D: YAML syntax errors are still possible.
- Ref: [modules/01-cicd-fundamentals-and-dora.md](../modules/01-cicd-fundamentals-and-dora.md), https://docs.gitlab.com/ee/ci/

</details>

### Q-GLCI-012 · D1 · difficulty 2 · multi

Which of the following artifact behaviors are true in GitLab CI/CD? (Select all that apply)

- A) Artifacts are automatically uploaded to object storage after a job succeeds by default.
- B) Downstream jobs in later stages download upstream artifacts by default unless `dependencies: []` is set.
- C) Artifacts persist indefinitely without expiration unless explicitly deleted.
- D) Artifacts can be configured with an expiration time using `expire_in`.

<details><summary>Answer</summary>

**A, B, D.** Artifacts are uploaded to storage, passed downstream by default, and configured via `expire_in`.

- Why not C: Artifacts have default retention periods and expire unless configured otherwise.
- Ref: [modules/02-gitlab-ci-execution-model-and-dag.md](../modules/02-gitlab-ci-execution-model-and-dag.md), https://docs.gitlab.com/ee/ci/yaml/#artifacts

</details>

---

## Domain 2: Pipeline Composition, CI/CD Components (`spec:inputs`) & Dynamic Child Pipelines (10 Questions)

### Q-GLCI-013 · D2 · difficulty 2 · single

What is the primary role of CI/CD Components in GitLab 19?

- A) To replace Kubernetes cluster nodes.
- B) To provide self-contained, reusable, parameterized pipeline templates published in the CI/CD Catalog.
- C) To compile TypeScript code inside runner containers.
- D) To authenticate Docker container registries.

<details><summary>Answer</summary>

**B.** CI/CD components use `spec:inputs` to provide modular, versioned, and reusable pipeline configuration blocks published to the GitLab CI/CD Catalog.

- Why not A: Components configure CI pipelines, not Kubernetes nodes.
- Why not C: Compilation is performed by job script commands.
- Why not D: Registry auth is handled by credentials.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/components/

</details>

### Q-GLCI-014 · D2 · difficulty 2 · scenario

An engineering platform team wants to require all microservice repositories to use a standardized security scanning pipeline template with a configurable vulnerability severity threshold. How should this be implemented?

- A) Copy-paste the YAML file into all 500 repositories manually.
- B) Author a CI/CD Component with `spec:inputs` defining `severity_threshold`, and have repositories include it via `include: component`.
- C) Use shell scripts executed via SSH.
- D) Disable all security scans.

<details><summary>Answer</summary>

**B.** CI/CD components with `spec:inputs` enable centralized maintenance and parameterized reuse across hundreds of repositories.

- Why not A: Manual copy-pasting violates DRY and platform governance principles.
- Why not C: Shell scripts lack native GitLab CI composition features.
- Why not D: Disabling scans creates security vulnerabilities.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/components/

</details>

### Q-GLCI-015 · D2 · difficulty 3 · single

In a CI/CD Component header, how do you define a required string input named `environment`?

- A) `inputs: environment: string`
- B)

```yaml
spec:
  inputs:
    environment:
      type: string
```

- C) `spec:inputs: [environment]`
- D) `parameters: { environment: type: string }`

<details><summary>Answer</summary>

**B.** CI/CD components use the `spec:inputs` block with `type: string` (and optional `default` or `required: true`) to define inputs.

- Why not A, C, D: Incorrect syntax structure for component input specifications.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/components/#define-inputs-for-a-component

</details>

### Q-GLCI-016 · D2 · difficulty 2 · single

What is the difference between `include:local` and `include:project` in GitLab CI?

- A) `include:local` references files in the same repository, while `include:project` references files in another GitLab project.
- B) `include:local` runs on runners, while `include:project` runs on the GitLab server.
- C) There is no difference; both are aliases.
- D) `include:local` requires external API tokens.

<details><summary>Answer</summary>

**A.** `include:local` loads files from the current repository branch, whereas `include:project` retrieves configuration files from a different repository within GitLab.

- Why not B, C, D: Incorrect definitions of include mechanisms.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/yaml/#includelocal

</details>

### Q-GLCI-017 · D2 · difficulty 3 · scenario

A monorepo contains 30 independent microservices. A parent pipeline needs to dynamically generate a child pipeline containing only the build and test jobs for microservices that have changed in the current commit. How is this achieved?

- A) Run all 30 microservice pipelines every time regardless of changes.
- B) Use a job to analyze git diffs, generate a dynamic YAML file as an artifact, and trigger a child pipeline using `trigger: include: artifact`.
- C) Use shell `if` statements inside a single monolithic job.
- D) Configure GitLab PR review bots.

<details><summary>Answer</summary>

**B.** Dynamic child pipelines generated via artifact handoff (`trigger: include: artifact`) allow pipelines to dynamically build execution graphs based on runtime discovery (such as monorepo change detection).

- Why not A: Running all pipelines wastes massive compute resources.
- Why not C: Monolithic jobs cannot dynamically spawn scalable sub-pipelines.
- Why not D: Review bots do not construct pipeline graphs.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/pipelines/downstream_pipelines.html#dynamic-child-pipelines

</details>

### Q-GLCI-018 · D2 · difficulty 1 · single

How are CI/CD component inputs referenced inside the component template body?

- A) `$INPUT_NAME`
- B) `$[[ inputs.input_name ]]`
- C) `{{ inputs.input_name }}`
- D) `${{ inputs.input_name }}`

<details><summary>Answer</summary>

**B.** CI/CD components use the interpolation syntax `$[[ inputs.input_name ]]` to evaluate and substitute input values into the YAML configuration.

- Why not A, C, D: Incorrect interpolation syntax for components.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/components/#use-inputs-in-a-component

</details>

### Q-GLCI-019 · D2 · difficulty 2 · multi

Which of the following are valid `include` types supported in GitLab CI/CD? (Select all that apply)

- A) `local`
- B) `project`
- C) `template`
- D) `remote`
- E) `database`

<details><summary>Answer</summary>

**A, B, C, D.** GitLab supports `include` types: `local`, `project`, `template` (pre-configured GitLab templates), and `remote` (via HTTP/HTTPS URLs).

- Why not E: `database` is not a valid include source.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/yaml/#include

</details>

### Q-GLCI-020 · D2 · difficulty 2 · single

What happens if an `include` file referenced in `.gitlab-ci.yml` cannot be found or fails to parse?

- A) The pipeline runs normally and ignores the missing file.
- B) The pipeline creation fails with a YAML configuration error before any jobs are scheduled.
- C) GitLab sends an email to the administrator and proceeds.
- D) The runner enters a crash loop.

<details><summary>Answer</summary>

**B.** GitLab validates all included configuration files during pipeline creation; missing or malformed include files cause pipeline creation to fail immediately.

- Why not A, C, D: Invalid YAML or missing includes block pipeline creation entirely.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/yaml/#include

</details>

### Q-GLCI-021 · D2 · difficulty 3 · single

What is the relationship between parent pipelines and downstream child pipelines in GitLab?

- A) Downstream child pipelines execute completely isolated without reporting status back to the parent.
- B) Downstream child pipelines report their execution status back to the parent bridge job, allowing the parent pipeline to succeed or fail based on child outcome.
- C) Child pipelines can only be triggered manually by administrators.
- D) Child pipelines run on the same runner process synchronously.

<details><summary>Answer</summary>

**B.** Parent-child pipelines establish a bridge where the parent pipeline waits for the child pipeline status, providing unified visibility and gate control.

- Why not A: Parent pipelines track child status.
- Why not C: Triggers can be automated.
- Why not D: Child pipelines execute asynchronously.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/pipelines/downstream_pipelines.html

</details>

### Q-GLCI-022 · D2 · difficulty 2 · scenario

An organization wants to publish internal CI/CD templates so that any project in the organization can consume them without copying files. Where should these templates be hosted?

- A) On public GitHub repositories.
- B) In a designated GitLab project configured as a CI/CD Component catalog source.
- C) On local developer laptops.
- D) Inside `.git/config`.

<details><summary>Answer</summary>

**B.** GitLab CI/CD components are published from projects within the GitLab instance or GitLab.com, allowing organization-wide catalog discovery and versioning.

- Why not A, C, D: Incorrect hosting locations for internal catalog components.
- Ref: [modules/03-pipeline-reuse-components-and-child-pipelines.md](../modules/03-pipeline-reuse-components-and-child-pipelines.md), https://docs.gitlab.com/ee/ci/components/

</details>

---

## Domain 3: GitLab Runner Architecture, Executors, Autoscaling & Rootless Image Builds (10 Questions)

### Q-GLCI-023 · D3 · difficulty 2 · single

What is the primary function of GitLab Runner?

- A) To store git commit history and manage merge requests.
- B) A lightweight Go daemon that polls GitLab instances for pending jobs, executes them in configured executors, and reports status.
- C) To provide database persistence for GitLab Rails application.
- D) To serve web pages for GitLab UI.

<details><summary>Answer</summary>

**B.** GitLab Runner is the worker agent that polls the GitLab API for pending jobs, provisions the execution environment, runs scripts, and returns logs and artifacts.

- Why not A, C, D: These are core GitLab Rails/Gitaly functions, not runner functions.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/

</details>

### Q-GLCI-024 · D3 · difficulty 3 · scenario

A platform security engineer discovers that a CI job running Docker-in-Docker (DinD) with privileged container mode enabled allowed a compromised workload to escape container isolation and access the underlying Kubernetes node kernel. How should this risk be mitigated?

- A) Add more CPU cores to the worker nodes.
- B) Replace privileged DinD with rootless BuildKit daemon architecture or Kaniko for building container images without privileged mode.
- C) Disable all container builds.
- D) Run GitLab Runner directly on developer laptops.

<details><summary>Answer</summary>

**B.** Privileged DinD disables container isolation mechanisms; migrating to rootless BuildKit, Kaniko, or Podman eliminates the need for privileged container execution.

- Why not A: Hardware scaling does not address kernel privilege escalation risks.
- Why not C: Stopping container builds halts software delivery.
- Why not D: Local laptops are insecure for enterprise pipelines.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/ee/ci/docker/using_docker_build.html

</details>

### Q-GLCI-025 · D3 · difficulty 2 · single

What is the role of the `docker-autoscaler` executor in GitLab Runner 17/19?

- A) To run shell scripts directly on the GitLab server host.
- B) To dynamically provision and autoscale container worker instances on cloud or Kubernetes infrastructure based on job queue depth.
- C) To manage PostgreSQL database backups.
- D) To build static HTML documentation.

<details><summary>Answer</summary>

**B.** The `docker-autoscaler` executor (replacing deprecated `docker-machine`) dynamically provisions ephemeral runner instances to scale compute capacity up and down with job demand.

- Why not A, C, D: Incorrect descriptions of the autoscaler executor.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/executors/docker_autoscaler.html

</details>

### Q-GLCI-026 · D3 · difficulty 2 · multi

Which of the following are supported GitLab Runner executors? (Select all that apply)

- A) Kubernetes
- B) Docker
- C) Shell
- D) SSH
- E) MS-DOS Batch

<details><summary>Answer</summary>

**A, B, C, D.** GitLab Runner natively supports Kubernetes, Docker, Shell, SSH, and VirtualBox executors.

- Why not E: MS-DOS Batch is not a runner executor (though shell scripts can run on Windows).
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/executors/

</details>

### Q-GLCI-027 · D3 · difficulty 3 · single

How does distributed caching work across multiple ephemeral GitLab Runners?

- A) Runners share local hard drives via NFS.
- B) Runners upload and download cache archives to a centralized object storage backend (e.g., AWS S3, MinIO) configured in runner settings.
- C) Caching is impossible across multiple runners.
- D) Caching is handled entirely by git commit hashes in the repository.

<details><summary>Answer</summary>

**B.** Distributed caching relies on object storage (S3 compatible) so that ephemeral runners spun up on different nodes can retrieve and store dependency caches.

- Why not A: NFS does not scale efficiently across distributed ephemeral cloud runners.
- Why not C: Object storage enables distributed caching.
- Why not D: Git stores version history, not build dependency caches.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/configuration/advanced-configuration.html#the-caches3-section

</details>

### Q-GLCI-028 · D3 · difficulty 1 · single

What security improvement does rootless BuildKit provide over legacy privileged Docker daemon builds?

- A) It runs container image building processes without requiring root privileges inside the container or host daemon, preventing root container escapes.
- B) It compiles code 100 times faster.
- C) It eliminates the need for internet access.
- D) It automatically signs git commits.

<details><summary>Answer</summary>

**A.** Rootless BuildKit runs without root user privileges, neutralizing kernel vulnerability exploitation vectors associated with root-privileged daemon socket sharing.

- Why not B, C, D: Performance, network access, and git signing are separate concerns.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/ee/ci/docker/using_docker_build.html

</details>

### Q-GLCI-029 · D3 · difficulty 2 · scenario

An enterprise runner cluster in Kubernetes experiences severe pod scheduling delays during peak hours because jobs request static runner pods. How can runner responsiveness and resource efficiency be optimized?

- A) Set up cluster autoscaling combined with GitLab Runner Kubernetes executor ephemeral pod provisioning (`pod_selector` and concurrency tuning).
- B) Delete all runners and run everything locally.
- C) Increase job timeout limits to 24 hours.
- D) Disable all build logs.

<details><summary>Answer</summary>

**A.** Configuring the GitLab Runner Kubernetes executor to dynamically provision ephemeral pods on demand leverages Kubernetes cluster autoscaling for efficient queue management.

- Why not B, C, D: Incorrect troubleshooting and scaling approaches.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/executors/kubernetes.html

</details>

### Q-GLCI-030 · D3 · difficulty 3 · ordering

Order the steps of a GitLab Runner job acquisition and execution cycle:

1. Runner polls GitLab server via long-polling API.
2. Runner receives job payload and provisions executor container/pod.
3. Runner clones git repository and executes script steps.
4. Runner uploads job logs, artifacts, and status (success/failure) back to GitLab.

- A) 1 -> 2 -> 3 -> 4
- B) 2 -> 1 -> 3 -> 4
- C) 1 -> 3 -> 2 -> 4
- D) 4 -> 3 -> 2 -> 1

<details><summary>Answer</summary>

**A.** Polling occurs first (1), followed by job acquisition and container provisioning (2), repository cloning and script execution (3), and final status/artifact upload (4).

- Why not B, C, D: Incorrect sequence.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/

</details>

### Q-GLCI-031 · D3 · difficulty 2 · single

What is the purpose of runner tags (e.g., `tags: [linux, GPU]`) in GitLab CI/CD?

- A) To encrypt environment variables.
- B) To match jobs to specific runners or runner pools capable of executing specialized hardware or software requirements.
- C) To format Markdown documentation.
- D) To name git branches automatically.

<details><summary>Answer</summary>

**B.** Tags route jobs to specific runners possessing matching capabilities (such as GPU nodes, specialized OS environments, or internal network access).

- Why not A, C, D: Tags are routing selectors, not encryption, formatting, or branch tools.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/ee/ci/yaml/#tags

</details>

### Q-GLCI-032 · D3 · difficulty 2 · single

What happens to a GitLab Runner when its registration token is revoked or rotated?

- A) The runner continues functioning indefinitely.
- B) The runner fails to authenticate with the GitLab instance and cannot poll for new jobs until re-registered with the new token.
- C) The GitLab server crashes.
- D) All git repositories are deleted.

<details><summary>Answer</summary>

**B.** Token revocation terminates runner authentication authorization, requiring token refresh or re-registration.

- Why not A, C, D: Revocation halts runner polling; it does not crash servers or delete repos.
- Ref: [modules/04-runners-executors-and-container-builds.md](../modules/04-runners-executors-and-container-builds.md), https://docs.gitlab.com/runner/register/

</details>

---

## Domain 4: Quality Gates, Matrix Parallelism, Flaky Tests & Merge Trains (9 Questions)

### Q-GLCI-033 · D4 · difficulty 2 · single

What is the primary benefit of using `parallel: matrix` in GitLab CI/CD?

- A) It runs infinite jobs simultaneously without resource limits.
- B) It generates combinatorial job variants across multiple environmental axes (e.g., Node versions, OS platforms) from a single job template.
- C) It automatically fixes syntax errors in source code.
- D) It bypasses code review requirements.

<details><summary>Answer</summary>

**B.** Matrix parallelism multiplies job execution across specified parameter sets (e.g., OS and browser combinations), reducing YAML duplication.

- Why not A: Concurrency limits still apply.
- Why not C, D: Matrix parallelism is for test/build matrix expansion, not code repair or review bypass.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/yaml/#parallelmatrix

</details>

### Q-GLCI-034 · D4 · difficulty 3 · scenario

An engineering team is plagued by "flaky" integration tests that fail intermittently due to external network latency. Rerunning failed jobs manually slows down delivery. How should this be handled robustly in GitLab CI/CD?

- A) Disable all tests permanently.
- B) Configure automatic job retries using the `retry` keyword while investigating and quarantining flaky tests.
- C) Increase runner memory to 1TB.
- D) Remove all network connections from test containers.

<details><summary>Answer</summary>

**B.** The `retry` keyword automatically re-runs transient job failures, while test telemetry identifies and quarantines flaky tests.

- Why not A: Disabling tests reduces code confidence.
- Why not C: Memory size does not fix race conditions or network latency.
- Why not D: Integration tests require network access.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/yaml/#retry

</details>

### Q-GLCI-035 · D4 · difficulty 2 · single

How does GitLab process JUnit test report XML files generated during test execution?

- A) It stores them as raw binary attachments without indexing.
- B) It parses the XML to display test failure summaries, trends, and failed test tabs directly in the Merge Request UI.
- C) It converts them into PDF technical reports.
- D) It deletes them immediately after the job finishes.

<details><summary>Answer</summary>

**B.** GitLab ingests JUnit XML reports (`artifacts:reports:junit`) to render test failure summaries directly in Merge Requests for fast triage.

- Why not A, C, D: JUnit reports drive MR test summary UI integration.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/yaml/artifacts_reports.html#artifactsreportsjunit

</details>

### Q-GLCI-036 · D4 · difficulty 3 · single

What is a Merge Train in GitLab, and what problem does it solve?

- A) A physical train used to transport server hardware.
- B) An automated queuing mechanism that tests multiple merge requests sequentially against the target branch HEAD to prevent broken master builds caused by race conditions.
- C) A tool for formatting git commit messages.
- D) A method for encrypting git commits.

<details><summary>Answer</summary>

**B.** Merge trains queue approved merge requests and test them in order against the target branch HEAD, ensuring that concurrent merges do not break main.

- Why not A, C, D: Unrelated to physical transit or commit formatting.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/merge_trains/

</details>

### Q-GLCI-037 · D4 · difficulty 2 · single

How is code coverage percentage parsed and displayed in GitLab Merge Requests?

- A) Developers enter the percentage manually into a text box.
- B) GitLab parses job logs using regular expressions defined in the `coverage` keyword.
- C) GitLab executes a Python script on the server.
- D) Code coverage cannot be displayed in GitLab.

<details><summary>Answer</summary>

**B.** The `coverage` keyword uses regex to extract test coverage figures from job output logs, displaying coverage trends in MR widgets.

- Why not A, C, D: Coverage is extracted automatically via regex from runner logs.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/yaml/#coverage

</details>

### Q-GLCI-038 · D4 · difficulty 2 · multi

Which quality gate artifacts are natively parsed by GitLab CI/CD? (Select all that apply)

- A) JUnit test reports (`artifacts:reports:junit`)
- B) Code quality reports (`artifacts:reports:codequality`)
- C) Security vulnerability reports (`artifacts:reports:sast`)
- D) Performance benchmark video recordings (`artifacts:reports:video`)

<details><summary>Answer</summary>

**A, B, C.** GitLab natively parses JUnit test reports, code quality JSON, and security scanning (SAST, secret detection, container scanning) reports.

- Why not D: Video recordings are not natively parsed security/quality artifacts.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/yaml/artifacts_reports.html

</details>

### Q-GLCI-039 · D4 · difficulty 3 · scenario

Two developers merge their independent MRs into `main` within seconds of each other. Both MR pipelines passed individually, but combined they introduce a broken build on `main`. Which GitLab feature prevents this race condition?

- A) Protected branches
- B) Merge Trains
- C) Git commit signing
- D) Fork synchronization

<details><summary>Answer</summary>

**B.** Merge trains test MRs in a serial queue against the latest cumulative state of the target branch, preventing race-condition regressions on `main`.

- Why not A: Protected branches restrict who can push, not race conditions between concurrent merges.
- Why not C, D: Commit signing and forks do not queue concurrent test runs.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/merge_trains/

</details>

### Q-GLCI-040 · D4 · difficulty 2 · single

What happens when a quality gate job fails (e.g., SAST finds a Critical vulnerability) and `allow_failure` is set to `false` (default)?

- A) The pipeline continues and merges automatically.
- B) The pipeline status becomes failed, blocking merge execution.
- C) An email is sent to the CEO while merging proceeds.
- D) The runner shuts down.

<details><summary>Answer</summary>

**B.** A failed mandatory quality gate job fails the pipeline and blocks merge requests from being merged until resolved.

- Why not A, C, D: Mandatory job failures block pipelines and merges.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/yaml/#allow_failure

</details>

### Q-GLCI-041 · D4 · difficulty 1 · single

What is the purpose of test report badge generation in GitLab CI?

- A) To encrypt build logs.
- B) To display real-time test pass/fail status badges in README files or project dashboards.
- C) To authenticate runner nodes.
- D) To allocate cloud credits.

<details><summary>Answer</summary>

**B.** Test badges provide visual status indicators (passing/failing) that can be embedded in documentation READMEs.

- Why not A, C, D: Unrelated to badges.
- Ref: [modules/05-testing-quality-gates-and-merge-trains.md](../modules/05-testing-quality-gates-and-merge-trains.md), https://docs.gitlab.com/ee/ci/pipelines/badges.html

</details>

---

## Domain 5: Software Supply-Chain Security: SBOMs, Keyless Cosign v3 Signing & SLSA Provenance (13 Questions)

### Q-GLCI-042 · D5 · difficulty 2 · single

What is a Software Bill of Materials (SBOM), and why is it critical for supply-chain security?

- A) An invoice of cloud computing costs.
- B) A formal inventory containing all software components, libraries, licenses, and dependency relationships used in an application artifact.
- C) A manual list of developer names.
- D) A database backup script.

<details><summary>Answer</summary>

**B.** An SBOM provides a machine-readable catalog of all dependencies in a software artifact, enabling rapid vulnerability impact assessment during zero-day CVE disclosures.

- Why not A, C, D: Unrelated to SBOMs.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://www.cisa.gov/sbom

</details>

### Q-GLCI-043 · D5 · difficulty 3 · scenario

A platform engineer needs to generate a CycloneDX SBOM for a built container image inside a GitLab CI job without installing heavy dependencies. Which tool and command are standard for this task?

- A) `gcc -o sbom.json main.c`
- B) `syft packages oci-registry:myimage:latest -o cyclonedx-json=sbom.json`
- C) `git clone sbom`
- D) `docker commit sbom`

<details><summary>Answer</summary>

**B.** Anchore Syft (`syft packages ... -o cyclonedx-json=...`) is the industry-standard tool for generating CycloneDX and SPDX SBOMs from container images and filesystems.

- Why not A, C, D: Incorrect tools for SBOM generation.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md https://github.com/anchore/syft

</details>

### Q-GLCI-044 · D5 · difficulty 3 · hands-on

**[Hands-on Task]** Write a GitLab CI job stage in TypeScript / YAML using Cosign v3 keyless signing authenticated via GitLab OIDC `id_tokens`. Which of the following script blocks correctly performs keyless container signing?

- A) `cosign sign --private-key key.pem myimage:v1`
- B) `cosign sign --yes --identity-token="$SIGSTORE_ID_TOKEN" registry.example.com/app@sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- C) `docker login && docker push`
- D) `echo "signing" > signed.txt`

<details><summary>Answer</summary>

**B.** Cosign keyless signing uses `--yes`, `--identity-token="$SIGSTORE_ID_TOKEN"` (using the active OIDC token since `CI_JOB_JWT_V2` was removed), and signs immutable `@sha256:...` digests to authenticate against Sigstore Fulcio and Rekor.

- Why not A: Static private keys require manual key management and lack transparency log bindings.
- Why not C, D: Pushing images or writing text files does not cryptographically sign container images using Sigstore.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md https://docs.sigstore.dev/cosign/overview/

</details>

### Q-GLCI-045 · D5 · difficulty 2 · single

What does SLSA (Supply-chain Levels for Software Artifacts) Level 3 provenance guarantee?

- A) That the software has zero bugs.
- B) That the build process is tamper-proof, non-falsifiable, and generated by an isolated, verifiable CI/CD platform recording all build inputs.
- C) That the software runs on Windows 11.
- D) That the developer has 10 years of experience.

<details><summary>Answer</summary>

**B.** SLSA Level 3 verifies build integrity, guaranteeing that artifacts were produced by a hardened build platform from verifiable source control without tampering.

- Why not A, C, D: Unrelated to SLSA build provenance guarantees.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://slsa.dev/

</details>

### Q-GLCI-046 · D5 · difficulty 2 · multi

Which of the following are standard SBOM output formats supported by tools like Syft and Trivy? (Select all that apply)

- A) CycloneDX (JSON / XML)
- B) SPDX (JSON / Tag-Value)
- C) Microsoft Word (.docx)
- D) PDF reports

<details><summary>Answer</summary>

**A, B.** CycloneDX and SPDX are the two global standard machine-readable SBOM formats.

- Why not C, D: Word and PDF are document formats, not standard SBOM interchange formats.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://cyclonedx.org/ / https://spdx.dev/

</details>

### Q-GLCI-047 · D5 · difficulty 3 · single

How does Sigstore Cosign keyless signing eliminate the security risks of long-lived private signing keys?

- A) By storing keys on developer desktops.
- B) By issuing ephemeral cryptographic keys valid for only a few minutes, bound to authenticated OIDC identity tokens (such as GitLab CI job tokens) and recorded in a public transparency log (Rekor).
- C) By encrypting keys with a password.
- D) By disabling encryption entirely.

<details><summary>Answer</summary>

**B.** Keyless signing avoids static private key leakage by issuing short-lived ephemeral keys tied to verified OIDC identity claims and logging attestations in Rekor.

- Why not A, C, D: Static keys or passwords do not provide keyless transparency log guarantees.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://blog.sigstore.dev/keyless-signatures/

</details>

### Q-GLCI-048 · D5 · difficulty 2 · scenario

An auditor requests proof that a production container deployment in Kubernetes was built from exact commit `abc1234` in the official GitLab repository without manual interference. What artifact satisfies this requirement?

- A) A screenshot of the terminal.
- B) A verified SLSA provenance attestation signed cryptographically via Cosign linked to the GitLab CI OIDC token.
- C) A text file listing developer names.
- D) A git commit message.

<details><summary>Answer</summary>

**B.** A cryptographically signed SLSA provenance attestation records exact source commit hashes, build pipelines, and repository metadata, providing non-repudiable audit proof.

- Why not A, C, D: Screenshots, text files, and commit messages lack cryptographic verification and tamper-proof build provenance.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://slsa.dev/spec/v1.0/provenance

</details>

### Q-GLCI-049 · D5 · difficulty 3 · single

What is the function of Aqua Security Trivy in a GitLab CI supply-chain security pipeline?

- A) To compile Go binaries.
- B) To scan container images, filesystems, and SBOMs for known CVE vulnerabilities and misconfigurations.
- C) To manage Kubernetes cluster DNS.
- D) To provision AWS EC2 instances.

<details><summary>Answer</summary>

**B.** Trivy scans container images, filesystems, and SBOM documents for security vulnerabilities and IaC misconfigurations.

- Why not A, C, D: Trivy is a vulnerability and misconfiguration scanner.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://github.com/aquasecurity/trivy

</details>

### Q-GLCI-050 · D5 · difficulty 1 · single

What does SAST stand for in DevSecOps pipelines?

- A) Secure Automated System Testing
- B) Static Application Security Testing
- C) Simple Artifact Storage Technology
- D) Standardized API Security Transfer

<details><summary>Answer</summary>

**B.** SAST stands for Static Application Security Testing, analyzing source code for security flaws without executing the program.

- Why not A, C, D: Incorrect expansions of SAST.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md https://docs.gitlab.com/ci/user/application_security/sast/

</details>

### Q-GLCI-051 · D5 · difficulty 2 · multi

Which security checks are categorized under Software Composition Analysis (SCA)? (Select all that apply)

- A) Scanning third-party open-source library dependencies for known CVE vulnerabilities.
- B) Checking open-source licenses for compliance risks.
- C) Analyzing CPU clock cycles.
- D) Identifying outdated third-party package versions.

<details><summary>Answer</summary>

**A, B, D.** SCA analyzes third-party dependencies, known vulnerabilities (CVEs), and license compliance.

- Why not C: CPU performance analysis is profiling, not SCA.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://docs.gitlab.com/ee/user/application_security/dependency_scanning/

</details>

### Q-GLCI-052 · D5 · difficulty 3 · ordering

Order the secure software supply-chain pipeline steps from code commit to cluster deployment:

1. Generate CycloneDX SBOM via Syft.
2. Scan container image and SBOM for vulnerabilities via Trivy.
3. Sign container image and attach SLSA provenance attestation via Cosign OIDC.
4. Verify signature and provenance inside Kubernetes cluster prior to admission.

- A) 1 -> 2 -> 3 -> 4
- B) 4 -> 3 -> 2 -> 1
- C) 2 -> 1 -> 3 -> 4
- D) 1 -> 3 -> 2 -> 4

<details><summary>Answer</summary>

**A.** First generate SBOM (1), scan for vulnerabilities (2), sign and attest container image (3), and finally verify signatures at admission control before deployment in Kubernetes (4).

- Why not B, C, D: Incorrect logical order.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://slsa.dev/

</details>

### Q-GLCI-053 · D5 · difficulty 2 · single

What is the purpose of the Rekor transparency log in Sigstore architecture?

- A) To store encrypted database passwords.
- B) To record tamper-proof, append-only cryptographic proofs of signature issuance and attestations for public auditing.
- C) To route network traffic.
- D) To host container registries.

<details><summary>Answer</summary>

**B.** Rekor provides an immutable, transparent ledger of signatures and attestations, ensuring non-repudiation and auditability in keyless signing.

- Why not A, C, D: Rekor is an immutable transparency log for code signatures.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://github.com/sigstore/rekor

</details>

### Q-GLCI-054 · D5 · difficulty 3 · hands-on

**[Hands-on Task]** Write a verification command using Cosign to ensure a deployed image was signed by GitLab CI and matches expected OIDC issuer claims. Which command is correct?

- A) `cosign verify --certificate-identity-regexp "https://gitlab.com/*" --certificate-issuer "https://gitlab.com" registry.example.com/app:v1.0.0`
- B) `docker inspect registry.example.com/app:v1.0.0`
- C) `trivy image --secure registry.example.com/app:v1.0.0`
- D) `curl -X GET https://gitlab.com/api/v4/verify`

<details><summary>Answer</summary>

**A.** `cosign verify` with `--certificate-identity-regexp` and `--certificate-issuer` validates the cryptographic signature against trusted OIDC claims.

- Why not B, C, D: Docker inspection, Trivy scanning, or API calls do not verify Cosign cryptographic signatures and OIDC identity claims.
- Ref: [modules/06-supply-chain-security-sbom-cosign-slsa.md](../modules/06-supply-chain-security-sbom-cosign-slsa.md), https://docs.sigstore.dev/cosign/verify/

</details>

---

## Domain 6: Continuous Deployment, Cloud OIDC Federation, Secrets & Monorepo Performance (11 Questions)

### Q-GLCI-055 · D6 · difficulty 2 · single

What is the purpose of `resource_group` in GitLab deployment jobs?

- A) To group container images into Kubernetes namespaces.
- B) To serialize job execution for a given environment, ensuring that concurrent deployments do not run simultaneously and corrupt state.
- C) To manage cloud billing budgets.
- D) To assign CPU resource limits to runner pods.

<details><summary>Answer</summary>

**B.** `resource_group` acts as a mutual exclusion lock for deployment jobs, guaranteeing that only one deployment runs at a time per environment.

- Why not A, C, D: `resource_group` is a concurrency lock for deployments, not Kubernetes namespaces, billing, or CPU limits.
- Ref: [modules/07-deployments-environments-and-gitops-handoff.md](../modules/07-deployments-environments-and-gitops-handoff.md), https://docs.gitlab.com/ee/ci/yaml/#resource_group

</details>

### Q-GLCI-056 · D6 · difficulty 3 · scenario

An engineering organization wants to eliminate static cloud credentials (long-lived AWS IAM secret keys) stored in GitLab CI/CD variables. How can they authenticate securely against AWS?

- A) Store passwords in plain text README files.
- B) Use GitLab `id_tokens` to generate OIDC JSON Web Tokens and exchange them with AWS IAM for temporary session credentials via AssumeRoleWithWebIdentity.
- C) Hardcode credentials in application source code.
- D) Disable authentication.

<details><summary>Answer</summary>

**B.** Keyless cloud federation uses GitLab `id_tokens` to authenticate directly with cloud IAM (AWS, GCP, Azure) via OpenID Connect, eliminating long-lived secrets.

- Why not A, C, D: Plain text or hardcoded secrets violate security standards and expose credentials.
- Ref: [modules/08-secrets-management-and-cloud-oidc.md](../modules/08-secrets-management-and-cloud-oidc.md), https://docs.gitlab.com/ee/ci/cloud_deployment/

</details>

### Q-GLCI-057 · D6 · difficulty 2 · single

What is a Review App in GitLab?

- A) A mobile app for reading code reviews.
- B) An ephemeral, dynamically provisioned environment created per Merge Request to preview code changes live, automatically destroyed when the MR is merged or closed.
- C) A static code analysis report.
- D) A manager approval dashboard.

<details><summary>Answer</summary>

**B.** Review Apps spin up isolated staging environments per MR for live preview and testing, tearing down automatically upon merge or close.

- Why not A, C, D: Review Apps are live preview environments.
- Ref: [modules/07-deployments-environments-and-gitops-handoff.md](../modules/07-deployments-environments-and-gitops-handoff.md), https://docs.gitlab.com/ee/ci/review_apps/

</details>

### Q-GLCI-058 · D6 · difficulty 2 · multi

Which cloud providers support native OIDC federation with GitLab CI/CD `id_tokens`? (Select all that apply)

- A) Amazon Web Services (AWS IAM)
- B) Google Cloud Platform (GCP Workload Identity)
- C) Microsoft Azure (Azure AD / Entra ID)
- D) HashiCorp Vault

<details><summary>Answer</summary>

**A, B, C, D.** AWS, GCP, Azure, and HashiCorp Vault all natively support OIDC JWT federation with GitLab `id_tokens`.

- Ref: [modules/08-secrets-management-and-cloud-oidc.md](../modules/08-secrets-management-and-cloud-oidc.md), https://docs.gitlab.com/ee/ci/cloud_deployment/

</details>

### Q-GLCI-059 · D6 · difficulty 3 · scenario

A monorepo with 50 packages experiences slow pipeline runtimes because every commit triggers tests for all 50 packages regardless of which files changed. How can pipeline performance be optimized?

- A) Buy 10,000 servers.
- B) Implement path-based change detection using git diff filters (`rules: changes`) or tools like `git diff --name-only` to run tests only for packages affected by the commit.
- C) Delete 49 packages.
- D) Turn off all testing.

<details><summary>Answer</summary>

**B.** Path-based change detection (`rules: changes`) ensures jobs run only when relevant files are modified, optimizing monorepo pipeline performance.

- Why not A: Throwing hardware at unoptimized workflows is wasteful.
- Why not C, D: Deleting code or turning off tests destroys functionality.
- Ref: [modules/09-pipeline-performance-monorepos-and-operations.md](../modules/09-pipeline-performance-monorepos-and-operations.md), https://docs.gitlab.com/ee/ci/yaml/#ruleschanges

</details>

### Q-GLCI-060 · D6 · difficulty 2 · single

What is the purpose of `gitlab-ci-local` tool in a developer's workflow?

- A) To deploy code directly to production without review.
- B) To run GitLab CI/CD pipelines locally on a developer workstation for fast debugging and iteration before pushing to remote.
- C) To generate database migrations.
- D) To manage Kubernetes cluster nodes.

<details><summary>Answer</summary>

**B.** `gitlab-ci-local` enables developers to execute CI/CD jobs locally on their machine, providing instant feedback without pushing commits to trigger remote runners.

- Why not A, C, D: `gitlab-ci-local` is a local pipeline execution and debugging tool.
- Ref: [modules/09-pipeline-performance-monorepos-and-operations.md](../modules/09-pipeline-performance-monorepos-and-operations.md), https://github.com/firecow/gitlab-ci-local

</details>

### Q-GLCI-061 · D6 · difficulty 3 · single

How does GitLab Secrets Manager integrate with external secret stores like HashiCorp Vault?

- A) By storing plain text passwords in YAML files.
- B) By securely fetching secrets at runtime using OIDC JWT authentication or Vault secrets provider syntax (`secrets: vault: ...`), keeping secrets out of git and CI variables.
- C) By hardcoding API keys in runner configuration files.
- D) By printing secrets in pipeline logs.

<details><summary>Answer</summary>

**B.** GitLab integrates with HashiCorp Vault to dynamically inject secrets into jobs at runtime using secure token exchange, preventing secrets storage in repository history.

- Why not A, C, D: Plain text, hardcoding, or log printing expose secrets.
- Ref: [modules/08-secrets-management-and-cloud-oidc.md](../modules/08-secrets-management-and-cloud-oidc.md), https://docs.gitlab.com/ee/ci/secrets/

</details>

### Q-GLCI-062 · D6 · difficulty 2 · single

What is the function of GitOps handoff in a GitLab continuous deployment workflow?

- A) Deleting git repositories after deployment.
- B) Committing infrastructure or manifest changes automatically to an infrastructure repository (or ArgoCD target branch) to trigger declarative cluster synchronization.
- C) Sending emails to customers.
- D) Running unit tests on developer laptops.

<details><summary>Answer</summary>

**B.** GitOps handoff automates updates to configuration repositories, enabling declarative continuous deployment synchronized by tools like ArgoCD.

- Why not A, C, D: GitOps handoff manages declarative state synchronization.
- Ref: [modules/07-deployments-environments-and-gitops-handoff.md](../modules/07-deployments-environments-and-gitops-handoff.md), https://docs.gitlab.com/ee/user/clusters/agent/gitops/

</details>

### Q-GLCI-063 · D6 · difficulty 2 · multi

Which strategies improve pipeline queue times and runner performance? (Select all that apply)

- A) Caching package dependencies using effective cache keys (`cache: key`).
- B) Using Directed Acyclic Graphs (`needs`) to eliminate unnecessary stage delays.
- C) Running every single job on a separate runner instance without caching.
- D) Autoscaling runner worker pools dynamically based on load.

<details><summary>Answer</summary>

**A, B, D.** Caching dependencies, using DAGs, and autoscaling runner pools optimize performance and reduce queue times.

- Why not C: Disabling caching and running separate uncached instances increases download times and queue pressure.
- Ref: [modules/09-pipeline-performance-monorepos-and-operations.md](../modules/09-pipeline-performance-monorepos-and-operations.md), https://docs.gitlab.com/ee/ci/pipelines/pipeline_efficiency.html

</details>

### Q-GLCI-064 · D6 · difficulty 3 · scenario

A Terraform deployment pipeline in GitLab runs concurrent plan and apply jobs across multiple branches, causing state file locking conflicts in Terraform backend storage. How should this be resolved?

- A) Delete the Terraform state file.
- B) Use `resource_group` on Terraform deployment jobs to ensure sequential execution per environment, combined with remote state locking (e.g., AWS DynamoDB).
- C) Run all Terraform applies simultaneously without locks.
- D) Stop using Terraform.

<details><summary>Answer</summary>

**B.** Combining `resource_group` serialization in GitLab CI with backend state locking prevents concurrent state modification conflicts.

- Why not A, C, D: Deleting state breaks infrastructure, concurrent applies corrupt state, and abandoning Terraform is unwarranted.
- Ref: [modules/07-deployments-environments-and-gitops-handoff.md](../modules/07-deployments-environments-and-gitops-handoff.md), https://docs.gitlab.com/ee/ci/yaml/#resource_group

</details>

### Q-GLCI-065 · D6 · difficulty 1 · single

What is the primary purpose of defining deployment `environments` in GitLab?

- A) To change the color of the GitLab UI.
- B) To track deployments, monitor rollout status, view deployment history, and enable rollback capabilities per target environment (production, staging).
- C) To encrypt git commit messages.
- D) To configure runner operating systems.

<details><summary>Answer</summary>

**B.** GitLab environments track deployment history, status, and health per target environment, enabling release tracking and rollback management.

- Why not A, C, D: Environments track deployment targets, not UI themes or commit encryption.
- Ref: [modules/07-deployments-environments-and-gitops-handoff.md](../modules/07-deployments-environments-and-gitops-handoff.md), https://docs.gitlab.com/ee/ci/environments/

</details>

---

## Mock Examination

- **Total Questions**: 65 questions
- **Time Limit**: 90 minutes
- **Passing Score**: 70% (46 out of 65 correct)
- **Domain Weight Distribution**:
  - D1 CI/CD Fundamentals & DAG: 12 questions
  - D2 Pipeline Composition & Components: 10 questions
  - D3 Runner Architecture & Autoscaling: 10 questions
  - D4 Quality Gates & Merge Trains: 9 questions
  - D5 Supply-Chain Security & Cosign: 13 questions
  - D6 Deployment, OIDC & Performance: 11 questions

### Scoring Key & Question Breakdown

| Question ID | Domain | Topic | Type | Difficulty | Correct Answer | Target Module |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **Q-GLCI-001** | D1 | DORA Metrics | Single | 1 | A | Module 01 |
| **Q-GLCI-002** | D1 | DORA Metrics | Single | 2 | B | Module 01 |
| **Q-GLCI-003** | D1 | DORA Metrics | Scenario | 2 | C | Module 01 |
| **Q-GLCI-004** | D1 | Trunk-based Dev | Single | 1 | B | Module 01 |
| **Q-GLCI-005** | D1 | Trunk-based Dev | Scenario | 2 | B | Module 01 |
| **Q-GLCI-006** | D1 | DAG Architecture | Single | 1 | A | Module 02 |
| **Q-GLCI-007** | D1 | Workflow Rules | Single | 2 | B | Module 02 |
| **Q-GLCI-008** | D1 | Variable Precedence | Single | 1 | C | Module 02 |
| **Q-GLCI-009** | D1 | Interruptible Jobs | Scenario | 2 | B | Module 02 |
| **Q-GLCI-010** | D1 | DAG Need Dependencies | Scenario | 2 | B | Module 02 |
| **Q-GLCI-011** | D1 | Pipeline Architecture | Multi | 2 | A, C | Modules 01, 02 |
| **Q-GLCI-012** | D1 | Pipeline Caching | Scenario | 2 | B | Module 02 |
| **Q-GLCI-013** | D2 | Component Inputs | Single | 1 | B | Module 03 |
| **Q-GLCI-014** | D2 | Component Inputs | Scenario | 2 | C | Module 03 |
| **Q-GLCI-015** | D2 | Extends & Reference | Single | 2 | B | Module 03 |
| **Q-GLCI-016** | D2 | Child Pipelines | Scenario | 2 | B | Module 03 |
| **Q-GLCI-017** | D2 | Dynamic Child Pipelines | Scenario | 3 | B | Module 03 |
| **Q-GLCI-018** | D2 | Include Keywords | Single | 1 | A | Module 03 |
| **Q-GLCI-019** | D2 | Component Registry | Single | 2 | B | Module 03 |
| **Q-GLCI-020** | D2 | YAML Merging | Scenario | 2 | B | Module 03 |
| **Q-GLCI-021** | D2 | Parallel Matrix | Single | 2 | B | Module 03 |
| **Q-GLCI-022** | D2 | Component Versioning | Single | 2 | B | Module 03 |
| **Q-GLCI-023** | D3 | Runner Executors | Single | 1 | B | Module 04 |
| **Q-GLCI-024** | D3 | Docker-in-Docker | Scenario | 2 | B | Module 04 |
| **Q-GLCI-025** | D3 | Rootless BuildKit | Single | 2 | B | Module 04 |
| **Q-GLCI-026** | D3 | Runner Tags | Single | 1 | A | Module 04 |
| **Q-GLCI-027** | D3 | Kubernetes Executor | Scenario | 2 | B | Module 04 |
| **Q-GLCI-028** | D3 | Autoscaler Runner | Single | 2 | B | Module 04 |
| **Q-GLCI-029** | D3 | Runner Registration | Single | 1 | A | Module 04 |
| **Q-GLCI-030** | D3 | Container Security | Scenario | 2 | B | Module 04 |
| **Q-GLCI-031** | D3 | Kaniko Builds | Single | 2 | B | Module 04 |
| **Q-GLCI-032** | D3 | Runner Concurrency | Scenario | 2 | B | Module 04 |
| **Q-GLCI-033** | D4 | Parallel Matrix | Single | 1 | B | Module 05 |
| **Q-GLCI-034** | D4 | Flaky Test Quarantine | Scenario | 2 | B | Module 05 |
| **Q-GLCI-035** | D4 | Merge Trains | Scenario | 2 | B | Module 05 |
| **Q-GLCI-036** | D4 | JUnit Reports | Single | 1 | B | Module 05 |
| **Q-GLCI-037** | D4 | Quality Gates | Scenario | 2 | B | Module 05 |
| **Q-GLCI-038** | D4 | Test Parallelism | Single | 2 | B | Module 05 |
| **Q-GLCI-039** | D4 | Merge Request Pipelines | Scenario | 2 | B | Module 05 |
| **Q-GLCI-040** | D4 | Allow Failure | Single | 1 | A | Module 05 |
| **Q-GLCI-041** | D4 | Pipeline Status | Scenario | 2 | B | Module 05 |
| **Q-GLCI-042** | D5 | SBOM Generation | Single | 1 | B | Module 06 |
| **Q-GLCI-043** | D5 | Syft Tooling | Scenario | 2 | B | Module 06 |
| **Q-GLCI-044** | D5 | Cosign v3 Signing | Hands-on | 3 | B | Module 06 |
| **Q-GLCI-045** | D5 | SLSA Level 3 | Single | 2 | B | Module 06 |
| **Q-GLCI-046** | D5 | Container Vulnerabilities | Scenario | 2 | B | Module 06 |
| **Q-GLCI-047** | D5 | Trivy Scanner | Single | 1 | B | Module 06 |
| **Q-GLCI-048** | D5 | Rekor Transparency Log | Single | 2 | B | Module 06 |
| **Q-GLCI-049** | D5 | OIDC Token Ingestion | Scenario | 2 | B | Module 06 |
| **Q-GLCI-050** | D5 | SAST Definition | Single | 1 | B | Module 06 |
| **Q-GLCI-051** | D5 | SCA Compliance | Multi | 2 | A, B, D | Module 06 |
| **Q-GLCI-052** | D5 | Provenance Attestation | Scenario | 2 | B | Module 06 |
| **Q-GLCI-053** | D5 | Secret Detection | Single | 1 | B | Module 06 |
| **Q-GLCI-054** | D6 | Resource Groups | Single | 1 | B | Module 07 |
| **Q-GLCI-055** | D6 | Deployment Rollbacks | Scenario | 2 | B | Module 07 |
| **Q-GLCI-056** | D6 | GitOps Handoff | Scenario | 2 | B | Module 07 |
| **Q-GLCI-057** | D6 | Cloud OIDC AWS | Single | 2 | B | Module 08 |
| **Q-GLCI-058** | D6 | Variable Masking | Scenario | 2 | B | Module 08 |
| **Q-GLCI-059** | D6 | Monorepo Optimization | Single | 2 | B | Module 09 |
| **Q-GLCI-060** | D6 | Cache Economics | Scenario | 2 | B | Module 09 |
| **Q-GLCI-061** | D6 | Protected Variables | Single | 1 | B | Module 08 |
| **Q-GLCI-062** | D6 | Vault Integration | Scenario | 2 | B | Module 08 |
| **Q-GLCI-063** | D6 | Review Apps | Scenario | 2 | B | Module 07 |
| **Q-GLCI-064** | D6 | Terraform Locking | Scenario | 2 | B | Module 07 |
| **Q-GLCI-065** | D6 | Environment Tracking | Single | 1 | B | Module 07 |

### Per-Domain Score Breakdown & Remediation

| Domain | Weight | Questions | Passing Target | Target Remediation Module |
| :-- | :-- | :-- | :-- | :-- |
| **Domain 1: CI/CD Fundamentals & DAG** | 18% | 12 | $\ge 9 / 12$ | Modules 01, 02 |
| **Domain 2: Pipeline Composition & Components** | 16% | 10 | $\ge 7 / 10$ | Module 03 |
| **Domain 3: Runner Architecture & Autoscaling** | 16% | 10 | $\ge 7 / 10$ | Module 04 |
| **Domain 4: Quality Gates & Merge Trains** | 14% | 9 | $\ge 6 / 9$ | Module 05 |
| **Domain 5: Supply-Chain Security & Cosign** | 20% | 13 | $\ge 10 / 13$ | Module 06 |
| **Domain 6: Deployment, OIDC & Performance** | 16% | 11 | $\ge 8 / 11$ | Modules 07, 08, 09 |
