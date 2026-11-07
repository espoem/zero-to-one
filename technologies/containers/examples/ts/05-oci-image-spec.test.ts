// Module 05: OCI Image Specification: Manifests, Indexes, Content-Addressable Layers, and Referrers
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  computeSha256Digest,
  createDescriptor,
  resolvePlatformManifest,
  OciReferrersGraph,
  type OciImageIndex,
  type OciManifest,
} from './lib/containers-model.ts';

test('content-addressable digest computation generates immutable sha256 hashes', () => {
  const layerContent = Buffer.from('TAR_GZIP_CONTENT_BYTES_V1');
  const descriptor = createDescriptor('application/vnd.oci.image.layer.v1.tar+gzip', layerContent);

  assert.ok(descriptor.digest.startsWith('sha256:'));
  assert.equal(descriptor.size, layerContent.byteLength);
  assert.equal(descriptor.digest, computeSha256Digest(layerContent));
});

test('gotcha: multi-arch missing platform in OCI index causes exec format error', () => {
  const amd64ManifestDesc = createDescriptor(
    'application/vnd.oci.image.manifest.v1+json',
    '{"schemaVersion":2,"config":{}}',
    { os: 'linux', architecture: 'amd64' },
  );

  const index: OciImageIndex = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.index.v1+json',
    manifests: [amd64ManifestDesc],
  };

  // 1. Host is linux/amd64 -> matches cleanly
  const amd64Res = resolvePlatformManifest(index, { os: 'linux', architecture: 'amd64' });
  assert.equal(amd64Res.descriptor?.digest, amd64ManifestDesc.digest);
  assert.equal(amd64Res.error, undefined);

  // 2. Host is Apple Silicon (linux/arm64 inside Docker Desktop/Colima/Podman VM)
  const arm64Res = resolvePlatformManifest(index, { os: 'linux', architecture: 'arm64' });
  assert.equal(arm64Res.descriptor, undefined);
  assert.ok(arm64Res.error?.includes('exec format error'));
  assert.ok(arm64Res.error?.includes('linux/arm64'));
});

test('gotcha: mutable :latest tag drift vs cryptographic digest pinning', () => {
  // Registry state at Day 1:
  const imageBuildDay1 = 'NODE_APP_V1_HASH';
  const digestDay1 = computeSha256Digest(imageBuildDay1);

  // Registry state at Day 30: someone pushed a new image with breaking change under :latest
  const imageBuildDay30 = 'NODE_APP_V2_BREAKING_HASH';
  const digestDay30 = computeSha256Digest(imageBuildDay30);

  // Tag mutable pointer
  let latestTagPointer = digestDay1;
  assert.equal(latestTagPointer, digestDay1);

  // Upstream tag overwritten
  latestTagPointer = digestDay30;
  assert.notEqual(
    latestTagPointer,
    digestDay1,
    'Tag :latest points to a completely different image build!',
  );

  // Digest pinning guarantee:
  const pinnedReference = `myorg/myapp@${digestDay1}`;
  assert.ok(
    pinnedReference.endsWith(digestDay1),
    'Pinned reference guarantees exact bytecode reproducibility across all deploys',
  );
});

test('OCI 1.1 referrers graph links Cosign signatures and Syft SBOMs to subject image', () => {
  const referrersGraph = new OciReferrersGraph();

  const baseImageDescriptor = createDescriptor(
    'application/vnd.oci.image.manifest.v1+json',
    '{"layers":["base-app"]}',
  );

  // Cosign Signature Manifest referencing base image via subject
  const cosignManifest: OciManifest = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: createDescriptor('application/vnd.oci.empty.v1+json', '{}'),
    layers: [createDescriptor('application/vnd.dev.cosign.simplesigning.v1+json', '{"sig":"xxx"}')],
    subject: baseImageDescriptor,
    annotations: {
      'org.opencontainers.image.artifactType': 'application/vnd.dev.cosign.artifact.sig.v1+json',
    },
  };
  const cosignDesc = createDescriptor(cosignManifest.mediaType, JSON.stringify(cosignManifest));
  cosignDesc.annotations = cosignManifest.annotations;
  referrersGraph.registerManifest(cosignManifest, cosignDesc);

  // Syft SBOM Manifest referencing base image
  const sbomManifest: OciManifest = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: createDescriptor('application/vnd.oci.empty.v1+json', '{}'),
    layers: [createDescriptor('application/spdx+json', '{"spdxVersion":"SPDX-2.3"}')],
    subject: baseImageDescriptor,
    annotations: {
      'org.opencontainers.image.artifactType': 'application/spdx+json',
    },
  };
  const sbomDesc = createDescriptor(sbomManifest.mediaType, JSON.stringify(sbomManifest));
  sbomDesc.annotations = sbomManifest.annotations;
  referrersGraph.registerManifest(sbomManifest, sbomDesc);

  // Query referrers API
  const allReferrers = referrersGraph.getReferrers(baseImageDescriptor.digest);
  assert.equal(allReferrers.length, 2);

  const sigs = referrersGraph.getReferrers(
    baseImageDescriptor.digest,
    'application/vnd.dev.cosign.artifact.sig.v1+json',
  );
  assert.equal(sigs.length, 1);
  assert.equal(sigs[0]?.digest, cosignDesc.digest);
});

test('property-based test: SHA-256 digest is strictly deterministic for arbitrary string payloads', () => {
  fc.assert(
    fc.property(fc.string(), (payload) => {
      const h1 = computeSha256Digest(payload);
      const h2 = computeSha256Digest(payload);
      assert.equal(h1, h2);
      assert.equal(h1.length, 7 + 64); // "sha256:" + 64 hex chars
    }),
  );
});
