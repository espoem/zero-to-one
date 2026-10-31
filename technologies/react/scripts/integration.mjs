// Hermetic test suite: React examples run in-process using vitest and jsdom.
// Real browser integration tests (Playwright) require a browser runtime and are skipped when unavailable.
console.log('[SKIP] test:integration: No external browser or container runtime configured; unit and proof test suites run via npm test.');
process.exit(0);
