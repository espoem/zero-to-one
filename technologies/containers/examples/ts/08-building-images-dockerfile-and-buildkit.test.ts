// Module 08: Building Images with Dockerfile and BuildKit: LLB Graph, Caching, Multi-Stage, and Reproducibility
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { BuildKitCacheAnalyzer, type BuildInstruction } from './lib/containers-model.ts';

test('gotcha: COPY . . before npm ci busts dependency cache on every single source code edit', () => {
  const analyzer = new BuildKitCacheAnalyzer();

  // Baseline build instructions (Naive Dockerfile)
  const naiveInstructionsRun1: BuildInstruction[] = [
    { type: 'FROM', args: ['node:26-alpine'] },
    {
      type: 'COPY',
      args: ['.', '/app'],
      filesSnapshot: { 'src/index.ts': 'hash_v1', 'package.json': 'pkg_hash_v1' },
    },
    { type: 'RUN', args: ['npm', 'ci'] },
    { type: 'RUN', args: ['npm', 'run', 'build'] },
  ];

  const build1 = analyzer.evaluateBuild(naiveInstructionsRun1);
  const cacheMap = new Map(build1.results.map((r) => [r.stepIndex, r.cacheKey]));
  analyzer.setPreviousBuildCache(cacheMap);

  // Run 2: Developer edits 1 line in src/index.ts (package.json is unchanged!)
  const naiveInstructionsRun2: BuildInstruction[] = [
    { type: 'FROM', args: ['node:26-alpine'] },
    {
      type: 'COPY',
      args: ['.', '/app'],
      filesSnapshot: { 'src/index.ts': 'hash_v2_EDITED', 'package.json': 'pkg_hash_v1' },
    },
    { type: 'RUN', args: ['npm', 'ci'] },
    { type: 'RUN', args: ['npm', 'run', 'build'] },
  ];

  const build2 = analyzer.evaluateBuild(naiveInstructionsRun2);

  // Step 1 (COPY . .) cache busted!
  assert.equal(build2.firstCacheBustIndex, 1);
  assert.equal(build2.results[1]?.cacheHit, false);
  // Step 2 (RUN npm ci) is downstream, so its cache is also completely busted!
  assert.equal(
    build2.results[2]?.cacheHit,
    false,
    'RUN npm ci had to reinstall all packages because COPY . . preceded it!',
  );
});

test('optimal Dockerfile layering caches expensive npm ci dependencies across source edits', () => {
  const analyzer = new BuildKitCacheAnalyzer();

  // Optimal Dockerfile
  const optimalInstructionsRun1: BuildInstruction[] = [
    { type: 'FROM', args: ['node:26-alpine'] },
    {
      type: 'COPY',
      args: ['package*.json', './'],
      filesSnapshot: { 'package.json': 'pkg_hash_v1' },
    },
    { type: 'RUN', args: ['npm', 'ci'] },
    { type: 'COPY', args: ['src/', './src/'], filesSnapshot: { 'src/index.ts': 'hash_v1' } },
    { type: 'RUN', args: ['npm', 'run', 'build'] },
  ];

  const build1 = analyzer.evaluateBuild(optimalInstructionsRun1);
  const cacheMap = new Map(build1.results.map((r) => [r.stepIndex, r.cacheKey]));
  analyzer.setPreviousBuildCache(cacheMap);

  // Run 2: Developer edits src/index.ts (package.json untouched)
  const optimalInstructionsRun2: BuildInstruction[] = [
    { type: 'FROM', args: ['node:26-alpine'] },
    {
      type: 'COPY',
      args: ['package*.json', './'],
      filesSnapshot: { 'package.json': 'pkg_hash_v1' },
    },
    { type: 'RUN', args: ['npm', 'ci'] },
    { type: 'COPY', args: ['src/', './src/'], filesSnapshot: { 'src/index.ts': 'hash_v2_EDITED' } },
    { type: 'RUN', args: ['npm', 'run', 'build'] },
  ];

  const build2 = analyzer.evaluateBuild(optimalInstructionsRun2);

  // Steps 0, 1, 2 hit cache!
  assert.equal(build2.results[0]?.cacheHit, true);
  assert.equal(build2.results[1]?.cacheHit, true);
  assert.equal(
    build2.results[2]?.cacheHit,
    true,
    'RUN npm ci was a CACHE HIT and did not re-download packages!',
  );

  // Only step 3 (COPY src/) and step 4 rebuild
  assert.equal(build2.firstCacheBustIndex, 3);
  assert.equal(build2.results[3]?.cacheHit, false);
  assert.equal(build2.results[4]?.cacheHit, false);
});

test('gotcha: ARG/ENV secrets leak into image config vs RUN --mount=type=secret', () => {
  const analyzer = new BuildKitCacheAnalyzer();

  // Insecure Dockerfile passing secrets via ARG/ENV
  const leakyBuild = analyzer.evaluateBuild([
    { type: 'FROM', args: ['alpine:3.21'] },
    { type: 'ARG', args: ['GITHUB_TOKEN=ghp_secret_1234567890'] },
    { type: 'RUN', args: ['echo "cloning private repo"'] },
  ]);

  assert.equal(
    leakyBuild.secretLeakedInConfig,
    true,
    'Secrets defined via ARG/ENV are embedded into image config metadata and image history!',
  );

  // Secure Dockerfile using BuildKit secret mount
  const secureBuild = analyzer.evaluateBuild([
    { type: 'FROM', args: ['alpine:3.21'] },
    { type: 'RUN', args: ['git clone https://private-repo.git'], isSecretMount: true },
  ]);

  assert.equal(
    secureBuild.secretLeakedInConfig,
    false,
    'BuildKit --mount=type=secret exposes secrets in-memory without recording them into layers',
  );
});

test('property-based test: identical instructions and file digests produce identical LLB cache keys', () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), (srcHash, pkgHash) => {
      const analyzer = new BuildKitCacheAnalyzer();
      const instructions: BuildInstruction[] = [
        { type: 'FROM', args: ['node:26-alpine'] },
        { type: 'COPY', args: ['package.json', '.'], filesSnapshot: { 'package.json': pkgHash } },
        { type: 'COPY', args: ['src/', 'src/'], filesSnapshot: { 'src/app.ts': srcHash } },
      ];

      const res1 = analyzer.evaluateBuild(instructions);
      const res2 = analyzer.evaluateBuild(instructions);

      for (let i = 0; i < instructions.length; i++) {
        assert.equal(res1.results[i]?.cacheKey, res2.results[i]?.cacheKey);
      }
    }),
  );
});
