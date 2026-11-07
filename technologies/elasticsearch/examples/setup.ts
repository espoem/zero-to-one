// Make every fast-check property deterministic across runs (AGENTS.md: deterministic test suites).
import fc from 'fast-check';

fc.configureGlobal({ seed: 20261104, numRuns: 100 });
