# Module 07: OCI Distribution Specification and Registries: Push/Pull Protocol, Token Auth, and Skopeo

The Open Container Initiative (OCI) Distribution Specification defines the vendor-neutral wire protocol for discovering, uploading, pulling, and managing content-addressable software artifacts. Originating from the Docker Registry HTTP API V2 protocol, the modern specification—standardized in OCI Distribution Spec v1.1.1 (formalized in January 2025)—governs how container runtimes, build systems, and registry daemons interact over HTTP/1.1 and HTTP/2. It decouples the physical storage of binary blobs from the logical metadata that describes container images, multi-architecture indexes, signatures, software bills of materials (SBOMs), and arbitrary OCI artifacts.

Understanding the distribution protocol is essential for systems engineers who operate container infrastructure at scale. In production clusters, naive image consumption causes thundering herd network congestion, registry rate-limit exhaustion, and supply-chain vulnerabilities arising from mutable tag tampering. This module analyzes the push and pull state machines, content-addressable verification, chunked resumable upload workflows, OAuth2 token authentication exchanges, OCI v1.1 referrers discovery, and external management tooling including Skopeo, Crane, and ORAS.

---

## 1. Formal Distribution Architecture and API Endpoints

The OCI Distribution Specification operates as a RESTful HTTP protocol structured around two fundamental entity classes: **manifests** (which describe configuration and layer topology) and **blobs** (the immutable, content-addressed payloads such as tar archives and JSON configurations). A registry namespace organizes artifacts hierarchically by `<registry-host>/<repository-name>`.

```mermaid
flowchart TD
    Client["Client (Docker / Podman / Skopeo)"]
    AuthServer["OAuth2 / Token Service"]
    Registry["OCI Distribution Registry (v1.1.1)"]
    Storage["Content-Addressable Storage (S3 / GCS / Filesystem)"]

    Client -->|"1. GET /v2/ (401 Challenge)"| Registry
    Registry -->|"2. Www-Authenticate: Bearer realm=..."| Client
    Client -->|"3. POST /token?scope=repository:app:pull"| AuthServer
    AuthServer -->|"4. Return Bearer Token (JWT)"| Client
    Client -->|"5. GET /v2/app/manifests/v1.0.0 (Bearer Auth)"| Registry
    Registry -->|"6. Resolve Digest sha256:manifest..."| Storage
    Client -->|"7. GET /v2/app/blobs/sha256:layer..."| Registry
    Registry -->|"8. Stream Blob Content"| Storage
```

### The Canonical API Surface

The distribution specification mandates specific HTTP routes under the `/v2/` URL prefix:

| Endpoint Route | HTTP Method | Formal Purpose | Success Status Codes |
| :-- | :-- | :-- | :-- |
| `/v2/` | `GET` | Base API check and authentication probe | `200 OK`, `401 Unauthorized` |
| `/v2/<name>/blobs/<digest>` | `GET`, `HEAD` | Stream or verify existence of a content-addressed binary blob | `200 OK`, `307 Temporary Redirect` |
| `/v2/<name>/blobs/<digest>` | `DELETE` | Delete a content-addressed binary blob from the repository | `202 Accepted` |
| `/v2/<name>/blobs/uploads/` | `POST` | Initiate a monolithic or chunked blob upload session | `202 Accepted` |
| `/v2/<name>/blobs/uploads/<uuid>` | `PATCH` | Append a byte chunk to an existing upload session | `202 Accepted` |
| `/v2/<name>/blobs/uploads/<uuid>` | `PUT` | Finalize a chunked upload by verifying the complete digest | `201 Created` |
| `/v2/<name>/blobs/uploads/<uuid>` | `GET` | Query current upload offset and status | `204 No Content` |
| `/v2/<name>/blobs/uploads/<uuid>` | `DELETE` | Cancel an active upload session and purge cached chunks | `204 No Content` |
| `/v2/<name>/manifests/<reference>` | `GET`, `HEAD` | Fetch or verify a manifest by tag or digest | `200 OK` |
| `/v2/<name>/manifests/<reference>` | `PUT` | Upload a manifest identified by tag or digest | `201 Created` |
| `/v2/<name>/manifests/<reference>` | `DELETE` | Delete a manifest by tag or digest | `202 Accepted` |
| `/v2/<name>/tags/list` | `GET` | List all tags published under the repository namespace | `200 OK` |
| `/v2/<name>/referrers/<digest>` | `GET` | Discover artifacts associated with a subject manifest (v1.1) | `200 OK` |

Every blob and manifest is uniquely referenced by a cryptographically secure digest consisting of an algorithm prefix and hex-encoded hash: $$\text{Digest} = \text{Algorithm} + \text{":"} + \text{HexHash}(\text{Payload})$$ Standard implementations require `sha256`, while modern security standards also permit `sha512`.

---

## 2. Push and Pull Protocol State Machines

Image transport is strictly content-addressable and decoupled into separate metadata and payload transfers. This decoupling enables aggressive caching, layer deduplication across independent repositories, and zero-byte payload re-uploads.

### The Pull State Machine

Pulling an image follows a deterministic topological resolution order:

1. **Manifest Retrieval**: The client issues `GET /v2/<name>/manifests/<tag|digest>` with an `Accept` header specifying desired media types (e.g., `application/vnd.oci.image.index.v1+json`, `application/vnd.oci.image.manifest.v1+json`, or legacy Docker media types).
2. **Platform Index Resolution**: If the returned payload is an OCI Image Index (`index.json`), the client searches the `manifests` array for a descriptor whose `platform` block matches the host architecture (e.g., `os: "linux"`, `architecture: "arm64"`). The client then fetches the platform-specific child manifest by its digest.
3. **Descriptor Validation**: The client parses the target manifest, extracting the descriptor for the container configuration (`config`) and the sequence of layer descriptors (`layers`).
4. **Blob Ingestion & Verification**: For each layer descriptor and the config descriptor, the client checks its local content-addressable storage. If absent, the client executes `GET /v2/<name>/blobs/<digest>`. As bytes stream over the wire, the client computes the running cryptographic hash. If the computed hash fails to match the descriptor's `digest`, or if the total byte count does not equal `size`, the transfer is aborted and rejected.

### The Push State Machine: Monolithic vs. Resumable Chunked Uploads

Pushing an image requires that all blobs (layer archives and config JSON) exist in the remote registry before the manifest referencing them is submitted. If a client attempts to submit a manifest referencing a non-existent blob digest, the registry rejects the request with a `400 Bad Request` (`BLOB_UNKNOWN`).

#### Resumable Chunked Upload Protocol

For large filesystem layers, network interruptions can waste substantial bandwidth under monolithic transfers. The OCI chunked upload protocol breaks layer delivery into discrete sequential chunks:

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant R as Registry
    C->>R: POST /v2/my-app/blobs/uploads/
    R-->>C: 202 Accepted<br/>Location: /v2/my-app/blobs/uploads/uuid-8472<br/>Range: bytes=0-0
    C->>R: PATCH /v2/my-app/blobs/uploads/uuid-8472<br/>Content-Range: 0-10485759<br/>Content-Type: application/octet-stream<br/>[10 MB chunk]
    R-->>C: 202 Accepted<br/>Location: /v2/my-app/blobs/uploads/uuid-8472<br/>Range: bytes=0-10485759
    C->>R: PATCH /v2/my-app/blobs/uploads/uuid-8472<br/>Content-Range: 10485760-20971519<br/>[10 MB chunk]
    R-->>C: 202 Accepted<br/>Location: /v2/my-app/blobs/uploads/uuid-8472<br/>Range: bytes=0-20971519
    C->>R: PUT /v2/my-app/blobs/uploads/uuid-8472?digest=sha256:d8a9...<br/>Content-Length: 0
    R-->>C: 201 Created<br/>Location: /v2/my-app/blobs/sha256:d8a9...
```

1. **Initiation**: The client sends `POST /v2/<name>/blobs/uploads/`. The registry allocates an upload session, returning `202 Accepted` with a `Location: /v2/<name>/blobs/uploads/<session-uuid>` header and a `Range: bytes=0-0` indicator.
2. **Chunk Transmission**: The client transmits binary chunks via `PATCH /v2/<name>/blobs/uploads/<session-uuid>`. Each request MUST include a `Content-Range: <start>-<end>` header specifying the exact byte range (0-indexed). The registry appends the chunk to its staging store and responds with `202 Accepted` containing the updated `Range: bytes=0-<highest-offset>`.
3. **Commitment**: Once all bytes are uploaded, the client issues `PUT /v2/<name>/blobs/uploads/<session-uuid>?digest=<computed-digest>`. The registry verifies that the concatenated payload matches the provided digest and byte count. Upon successful verification, the registry moves the blob into permanent content-addressable storage and returns `201 Created`.

#### Cross-Repository Blob Mounting

When pushing an image containing layers already stored in another repository on the same registry host, the client can request a server-side blob mount, avoiding redundant network transmission:

```http
POST /v2/target-repo/blobs/uploads/?mount=sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08&from=source-repo HTTP/1.1
Host: registry.example.com
Authorization: Bearer <token-with-pull-on-source-and-push-on-target>
```

If the registry can locate the blob in `source-repo` and the client holds read access to `source-repo` and write access to `target-repo`, the registry creates the reference immediately, returning `201 Created` with `Location: /v2/target-repo/blobs/sha256:9f86d...`. If unauthorized or unmounted, the registry returns `202 Accepted` with a standard upload session URL, instructing the client to fall back to a full upload.

---

## 3. OCI Token Authentication Specification

The OCI token authentication specification standardizes authentication across public and private registries using detached OAuth2/JWT authorization servers.

```mermaid
flowchart LR
    subgraph Flow ["Authentication Handshake"]
        A["1. Request Resource Without Token"] -->|"Returns 401 Unauthorized"| B["2. Inspect Www-Authenticate Header"]
        B -->|"Parse realm, service, scope"| C["3. Query Auth Server for Token"]
        C -->|"Present Credentials (Basic / OAuth2)"| D["4. Receive Signed JWT"]
        D -->|"Include in Authorization: Bearer <JWT>"| E["5. Re-execute Target Request"]
        E -->|"Registry Verifies Signature"| F["6. 200 OK / Resource Returned"]
    end
```

### The 401 Challenge Handshake

When an unauthenticated or expired client queries an endpoint, the registry challenges the request:

```http
HTTP/1.1 401 Unauthorized
Date: Sat, 07 Nov 2026 12:00:00 GMT
Content-Type: application/json; charset=utf-8
Www-Authenticate: Bearer realm="https://auth.example.com/token",service="registry.example.com",scope="repository:platform/app:pull,push"
```

The client extracts three mandatory parameters:

- `realm`: The URI of the token-issuing authentication server.
- `service`: The service identity being accessed.
- `scope`: The requested resource permission string, formatted as `<resource-type>:<resource-name>:<action1,action2>`.

The client queries the auth server, presenting HTTP Basic authentication credentials (e.g., from `~/.docker/config.json` or credential helpers like `docker-credential-secretservice`):

```http
GET /token?service=registry.example.com&scope=repository:platform/app:pull,push HTTP/1.1
Host: auth.example.com
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

The authorization service returns a JSON payload containing the bearer token:

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "issued_at": "2026-11-07T12:00:00Z"
}
```

The bearer token is an asymmetric JSON Web Token (JWT) signed by the auth server's private key. The registry validates the JWT's cryptographic signature against the auth server's public key, decodes the claims, and enforces the requested scopes without maintaining session state.

---

## 4. OCI v1.1 Referrers API and Supply-Chain Metadata

Historically, container images lacked a standardized mechanism to associate metadata (such as digital signatures, attestations, and SBOMs) with an existing image without mutating the original tag or image manifest. OCI Image and Distribution Specifications v1.1.1 introduce the **Subject Field** and the **Referrers API**.

An artifact manifest (such as a Cosign signature or a Syft SPDX SBOM) declares a `subject` descriptor pointing directly to the target image's manifest digest:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/spdx+json",
  "config": {
    "mediaType": "application/vnd.oci.empty.v1+json",
    "digest": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    "size": 2
  },
  "layers": [
    {
      "mediaType": "application/spdx+json",
      "digest": "sha256:7b1e84a28292f7...sbom-content",
      "size": 45120
    }
  ],
  "subject": {
    "mediaType": "application/vnd.oci.image.manifest.v1+json",
    "digest": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "size": 1842
  }
}
```

To discover all artifacts linked to an image, a consumer queries the referrers endpoint:

```http
GET /v2/platform/app/referrers/sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08?artifactType=application/spdx%2Bjson HTTP/1.1
Host: registry.example.com
Authorization: Bearer <token>
```

The registry returns an OCI Image Index containing descriptors for every manifest that references that subject digest. This allows policy engines (e.g., Gatekeeper, Kyverno) to discover and verify signatures and vulnerability reports dynamically.

---

## 5. Tooling Comparison: Skopeo, Crane, and ORAS

Direct interaction with OCI registries does not require a full container engine daemon. Dedicated CLI utilities implement the distribution specification directly:

| Capability / Attribute | Skopeo (Red Hat / containers) | Crane (GoogleContainerTools) | ORAS (OCI Registry As Storage) |
| :-- | :-- | :-- | :-- |
| **Primary Focus** | Secure multi-transport image copy, inspection, and signing | Fast manifest surgery, tagging, and CI/CD image manipulation | Storing and retrieving arbitrary files/artifacts in OCI registries |
| **Daemon Requirement** | None (pure CLI client) | None (pure CLI client) | None (pure CLI client) |
| **Supported Transports** | `docker://`, `containers-storage:`, `dir:`, `docker-archive:`, `oci:`, `oci-archive:` | `remote` (HTTP v2 registry endpoints) | `oci:` directory and remote registries |
| **Streaming Copy** | Direct registry-to-registry streaming without local disk spooling | Direct registry-to-registry streaming | Registry-to-filesystem and vice versa |
| **OCI v1.1 Referrers** | Full support (`skopeo inspect`) | Supported (`crane export`, `crane manifest`) | Native first-class referrer discovery and artifact publishing |

### Common Operational Commands

```bash
# Inspect a remote image manifest without downloading layers
skopeo inspect --raw docker://registry.example.com/platform/app:v1.2.0

# Copy an image directly between two authenticated registries without saving to disk
skopeo copy \
  --src-creds="user1:${SRC_TOKEN}" \
  --dest-creds="user2:${DEST_TOKEN}" \
  docker://registry-east.example.com/app:v1.2.0 \
  docker://registry-west.example.com/app:v1.2.0

# Export image layers to an OCI directory layout on local disk
skopeo copy docker://registry.example.com/platform/app:v1.2.0 oci:/var/tmp/app-oci:latest

# Push an arbitrary file as an OCI artifact using ORAS
oras push registry.example.com/platform/configs:v1 \
  --artifact-type application/vnd.company.config.v1 \
  ./security-rules.yaml:application/yaml
```

---

## 6. Formal Algorithms and Wire Mechanics

### Resumable Chunked Blob Upload

The following CLRS-style algorithm models the client-side chunked upload routine with cryptographic digest verification.

```text
UPLOAD-BLOB-CHUNKED(registryUrl, repository, payloadStream, totalBytes, chunkSize, credentials)
1  sessionUrl, maxOffset = INITIATE-UPLOAD-SESSION(registryUrl, repository, credentials)
2  uploadedBytes = 0
3  sha256Context = INITIALIZE-SHA256()
4
5  // Loop invariant: uploadedBytes is the exact number of contiguous bytes confirmed by the registry.
6  // sha256Context reflects the continuous hash of all bytes read up to uploadedBytes.
7  while uploadedBytes < totalBytes
8      chunk = READ-STREAM(payloadStream, chunkSize)
9      chunkLen = LENGTH(chunk)
10     startRange = uploadedBytes
11     endRange = uploadedBytes + chunkLen - 1
12
13     UPDATE-SHA256(sha256Context, chunk)
14
15     response = HTTP-PATCH(sessionUrl,
16                           headers: { "Content-Range": startRange + "-" + endRange,
17                                      "Content-Type": "application/octet-stream" },
18                           body: chunk)
19     if response.statusCode != 202
20         error "Upload chunk failed: " + response.statusText
21
22     sessionUrl = response.headers["Location"]
23     uploadedBytes = uploadedBytes + chunkLen
24
25 finalDigest = "sha256:" + FINALIZE-SHA256(sha256Context)
26 commitResponse = HTTP-PUT(sessionUrl + "?digest=" + finalDigest,
27                           headers: { "Content-Length": "0" })
28 if commitResponse.statusCode != 201
29     error "Final commit failed: " + commitResponse.statusText
30 return commitResponse.headers["Location"]
```

### Image Pull and Referrers Traversal

This algorithm formalizes the recursive resolution of an image manifest graph, including platform resolution and supply-chain artifact discovery.

```text
RESOLVE-AND-PULL-IMAGE-GRAPH(registryUrl, repo, reference, targetPlatform, localStore)
1  manifestBytes, mediaType = FETCH-MANIFEST(registryUrl, repo, reference)
2  if mediaType == "application/vnd.oci.image.index.v1+json"
3      index = PARSE-JSON(manifestBytes)
4      matchedDigest = null
5      for each desc in index.manifests
6          if desc.platform.os == targetPlatform.os and desc.platform.architecture == targetPlatform.arch
7              matchedDigest = desc.digest
8              break
9      if matchedDigest == null
10         error "No matching platform found in image index"
11     return RESOLVE-AND-PULL-IMAGE-GRAPH(registryUrl, repo, matchedDigest, targetPlatform, localStore)
12
13 manifest = PARSE-JSON(manifestBytes)
14 ENSURE-BLOB(registryUrl, repo, manifest.config.digest, localStore)
15
16 // Invariant: All layers up to index i are downloaded and validated in localStore
17 for i = 1 to LENGTH(manifest.layers)
18     layerDesc = manifest.layers[i]
19     ENSURE-BLOB(registryUrl, repo, layerDesc.digest, localStore)
20
21 // Traverse OCI v1.1 Referrers
22 referrersIndex = FETCH-REFERRERS(registryUrl, repo, reference)
23 for each artifact in referrersIndex.manifests
24     RECORD-ASSOCIATION(reference, artifact.artifactType, artifact.digest)
25 return manifest
```

---

## 7. Then vs Now: Evolution of Container Distribution

| Architectural Domain | Docker Registry HTTP API V2 (2015) | OCI Distribution Spec v1.0 (2021) | OCI Distribution Spec v1.1.1 (2025/2026) |
| :-- | :-- | :-- | :-- |
| **Specification Governance** | Proprietary to Docker, Inc. | Open Container Initiative (Linux Foundation) | Vendor-neutral OCI standard with formal conformance test suites |
| **Artifact Typing** | Strict container images only (`schema2` manifest) | Generalized descriptor types; strict MIME enforcement | First-class `artifactType` field for native non-image payloads |
| **Supply-Chain Links** | Tag-based hacks (e.g., `<digest>.sig`, `<digest>.att`) | Reverse-lookup tag conventions | Native `subject` descriptor and server-side `/referrers/` discovery API |
| **Blob Compression** | Gzip (`tar+gzip`) standard | Gzip and uncompressed tar | Zstandard (`tar+zstd`) support for sub-second layer decompression |
| **Cross-Repo Deduplication** | Unspecified; ad-hoc server implementations | Formalized `?mount` query parameter syntax | Deterministic cross-repo mounting with strict authorization boundaries |
| **Catalog / Discovery** | Unauthenticated, inefficient `/v2/_catalog` | Deprecated / optional `/tags/list` | Scalable tag pagination via `?n=<count>&last=<tag>` |

> [!NOTE]
> Docker Engine 29.9.2 defaults to the containerd image store for new installations, migrating away from legacy graph drivers. Under this architecture, distribution interactions write directly into containerd's content-addressable storage (`/var/lib/docker/containerd/daemon/io.containerd.content.v1.content`), utilizing native OCI v1.1 referrers and zstd layer decompression.

---

## 8. Exam Delta: Certification Expectations vs. Production Reality

> [!IMPORTANT]
> **CKAD / CKS Certification Delta**:
>
> - **Exam Perspective**: The CKAD and CKS curricula assume registries are opaque black boxes accessible via Kubernetes `imagePullSecrets` or node IAM roles. Questions focus on configuring `Secret` resources of type `kubernetes.io/dockerconfigjson`, setting `imagePullPolicy: Always` versus `IfNotPresent`, and pinning image tags or SHA-256 digests in Pod specs.
> - **Production Reality**: Platform engineers must debug low-level distribution failures that occur before Kubernetes can schedule a container. These include HTTP 401/403 token expiration loops, corporate proxy MTU fragmentation breaking large layer chunk uploads, Docker Hub 429 rate limits blocking node autoscalers, and cross-registry replication failures caused by unmounted blob references.

---

## 9. Production Failure Modes and Gotchas

### 1. Docker Hub Pull Rate Limits (HTTP 429)

**Symptom**: CI pipelines and Kubernetes cluster autoscalers abruptly fail with:

```text
toomanyrequests: You have reached your pull rate limit. You may increase the limit by authenticating and upgrading: https://www.docker.com/increase-rate-limit
```

**Root Cause**: Unauthenticated requests to Docker Hub are restricted to 100 pulls per 6 hours per source IP address. In shared cloud environments (e.g., GitHub Actions, AWS NAT Gateways), hundreds of concurrent workers share the same egress IP. **Mitigation**:

- Configure local pull-through caching mirrors (e.g., Harbor or AWS ECR Public cache) configured in `/etc/docker/daemon.json`:
  ```json
  {
    "registry-mirrors": ["https://mirror.internal.infra"]
  }
  ```
- Always authenticate against Docker Hub even for public images to unlock higher tier quotas.

### 2. Manifest Tag Mutation Race Conditions

**Symptom**: Two nodes in the same deployment run completely different binaries despite referencing the identical tag (e.g., `app:v2.1.0`). **Root Cause**: Image tags are mutable pointers. If a CI pipeline pushes a rebuilt image under an existing tag while a rolling upgrade is in progress, newly created pods pull the new manifest digest while existing pods run the old digest. **Mitigation**: Treat tags as human-friendly aliases only. In production deployment manifests, always pin immutable SHA-256 digests:

```yaml
spec:
  containers:
    - name: web
      image: registry.example.com/platform/app@sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

### 3. Cross-Repository Blob Mount Permission Denial

**Symptom**: Pushing an image layer to a new repository fails with `403 Forbidden` on the mount call, followed by an unexpected slow layer re-upload. **Root Cause**: When a client requests `?mount=<digest>&from=<source_repo>`, the registry requires the client's bearer token to include the `pull` action on `source_repo` in addition to `push` on `target_repo`. If the CI service account only has access to `target_repo`, the mount fails and falls back to a full upload. **Mitigation**: Ensure shared base image repositories grant read access across all development teams, or configure organization-level base image replication.

### 4. Orphaned Chunk Accumulation and Storage Exhaustion

**Symptom**: The registry's backing object storage capacity grows continuously despite regular garbage collection of untagged manifests. **Root Cause**: Failed or interrupted chunked uploads (`PATCH` requests that never receive a matching `PUT`) leave temporary upload state in `/v2/<name>/blobs/uploads/<uuid>`. Standard registry garbage collection only reaps unreferenced committed blobs, ignoring aborted upload sessions. **Mitigation**: Configure automated lifecycle expiration rules on the registry's upload directory (e.g., S3 lifecycle policy deleting multipart uploads after 7 days) and schedule periodic API cleanup via `DELETE /v2/<name>/blobs/uploads/<uuid>`.

---

## Interview Drill

<details><summary>1. Walk through the exact HTTP interaction when an OCI client attempts to pull an image from an authenticated private registry for the very first time.</summary>

1. The client sends an unauthenticated `GET /v2/my-repo/my-app/manifests/v1.0.0` with an `Accept` header containing accepted manifest media types.
2. The registry rejects the request with `401 Unauthorized` and returns a `Www-Authenticate` header specifying the auth server location and required scope: `Bearer realm="https://auth.infra/token",service="registry.infra",scope="repository:my-repo/my-app:pull"`
3. The client parses this header, extracts credentials from its local credential store (`~/.docker/config.json`), and queries the auth realm: `GET https://auth.infra/token?service=registry.infra&scope=repository:my-repo/my-app:pull` with `Authorization: Basic <base64-creds>`.
4. The auth server validates the credentials and returns a signed JSON Web Token (JWT) with an expiration timestamp.
5. The client re-executes the original manifest request, attaching `Authorization: Bearer <jwt>`.
6. The registry verifies the JWT signature using the auth server's public key, checks the scope claim, and returns `200 OK` with the manifest body and its `Docker-Content-Digest` header.
7. The client parses the manifest's layer descriptors and initiates `GET /v2/my-repo/my-app/blobs/<layer-digest>` requests using the same bearer token.

</details>

<details><summary>2. How does the OCI Distribution Specification prevent a client from uploading corrupted or truncated filesystem layers during a chunked upload?</summary>

Data integrity is enforced at three distinct layers:

1. **Range Validation**: During intermediate `PATCH` requests, the client MUST provide the `Content-Range: <start>-<end>` header. The registry asserts that `<start>` matches its internal current byte offset exactly. If there is a gap or overlap, the registry rejects the chunk with `416 Range Not Satisfiable`.
2. **Size Enforcement**: The final `PUT` request includes the total expected byte size either in the URL query or via the cumulative length of all committed chunks.
3. **Cryptographic Commitment**: The final `PUT /v2/<name>/blobs/uploads/<uuid>?digest=<algorithm>:<hash>` forces the registry to compute the cryptographic hash across the concatenated stream of stored chunks. Only if the registry's independently calculated digest strictly matches the client-supplied digest parameter does the registry move the blob into permanent content-addressable storage and return `201 Created`.

</details>

<details><summary>3. Why is deleting an image tag via the registry API fundamentally different from freeing disk space in registry storage?</summary>

In the OCI Distribution model, deleting a tag or manifest (`DELETE /v2/<name>/manifests/<reference>`) merely deletes the logical reference or tag pointer within that repository's namespace. The underlying filesystem layers and configuration files are content-addressed blobs stored independently. Because blobs can be shared across multiple manifests, tags, and even repositories (via deduplication), the registry cannot immediately delete the underlying blobs upon manifest deletion without causing data loss for other images. Reclaiming physical storage requires running an offline or online **Garbage Collection (GC)** process. The GC traverses all active manifests, builds a set of reachable blob digests, and marks and sweeps all unreachable blobs from storage.
</details>

<details><summary>4. Explain how Skopeo is able to inspect the labels and environment variables of an image without downloading its 10 GB filesystem layers.</summary>

An image's labels, environment variables, entrypoint, and architecture are stored inside the **image configuration JSON** blob, not within the root filesystem layers. Skopeo exploits the decoupled architecture of the OCI specification:

1. Skopeo fetches the manifest metadata (`GET /v2/<name>/manifests/<tag>`), which is typically only 2–4 KB.
2. The manifest contains a `config` descriptor specifying the digest and media type of the configuration object (e.g., `application/vnd.oci.image.config.v1+json`).
3. Skopeo issues a `GET /v2/<name>/blobs/<config-digest>`, downloading solely this small JSON document (~2–8 KB).
4. Skopeo parses the configuration JSON to extract `Config.Labels`, `Config.Env`, and other metadata, outputting the result to stdout without ever querying or streaming the layer blobs.

</details>

<details><summary>5. What is the OCI v1.1 Referrers API, and how does it solve the problem of attaching supply-chain metadata to an immutable image?</summary>

Prior to OCI v1.1, attaching a signature or SBOM required either mutating the image manifest (breaking its immutable digest) or creating tag naming conventions (e.g., `sha256-<digest>.sig`), which polluted the repository tag space and made atomic discovery difficult. OCI v1.1 introduces:

1. The `subject` field inside the OCI Manifest specification, allowing an artifact manifest to declare a direct parent pointer to an existing target manifest's digest.
2. The `/v2/<name>/referrers/<digest>` API endpoint. When queried with an image's digest, the registry returns an index of all manifests that have declared that digest as their `subject`. This enables bidirectional graph traversal: downstream tools can discover all signatures, attestations, and SBOMs attached to an image without modifying the target image or scanning external databases.

</details>

<details><summary>6. How does a registry pull-through cache operate, and what happens when an upstream image is deleted or modified?</summary>

A pull-through cache acts as an intercepting proxy between the client and an upstream remote registry (e.g., Docker Hub):

1. **Cache Miss**: When a client requests a manifest, the cache proxies the request to the upstream registry, verifies authentication, downloads and caches both the manifest and the underlying blobs locally, and returns them to the client.
2. **Cache Hit**: Subsequent requests for that digest or tag are served directly from local cache storage, bypassing upstream network transit and rate limits.
3. **Upstream Changes**: For mutable tags (e.g., `:latest`), the cache sends a conditional HTTP request (`HEAD` or `GET` with `If-None-Match: <etag>`) upstream to check if the manifest digest has changed. If the upstream image is deleted, cache behavior depends on configuration: it can either continue serving the cached artifact (providing build resilience) or return `404 Not Found` if strict upstream synchronization is enforced.

</details>

<details><summary>7. What are the security risks associated with enabling unauthenticated cross-repository blob mounting on a multi-tenant registry?</summary>

If a registry permits cross-repository blob mounting (`?mount=<digest>&from=<source_repo>`) without validating the caller's read permissions on `source_repo`, it introduces an **information disclosure oracle**:

1. An attacker can guess or brute-force candidate digests of proprietary layers (e.g., containing proprietary binaries or confidential configuration files).
2. The attacker requests a mount of that digest into their own private repository.
3. If the mount succeeds (`201 Created`), the attacker downloads the blob directly from their own repository, bypassing read restrictions on the victim's repository. To mitigate this, the OCI specification mandates that registries MUST verify that the client possesses authenticated `pull` permissions on the source repository before fulfilling a cross-repository mount request.

</details>

---

## 11. Proof Map and Verification

The formal protocols, chunked upload state machines, and token authentication exchanges documented in this module are verified through executable automated tests:

- **Hermetic Unit Suite**: [`technologies/containers/examples/ts/07-oci-distribution-and-registries.test.ts`](../examples/ts/07-oci-distribution-and-registries.test.ts)
  - `testChunkedUploadStateMachine`: Simulates multi-part chunked byte uploads, byte range header parsing, and final SHA-256 digest validation.
  - `testTokenAuthExchange`: Validates 401 challenge header parsing (`Www-Authenticate`), token acquisition, and Bearer authorization injection.
  - `testReferrersDiscovery`: Implements OCI v1.1 referrers graph linking and artifact descriptor filtering.
  - `testNegativeDigestMismatch`: Proves that corrupted chunk payloads trigger immediate rejection prior to blob commitment.
