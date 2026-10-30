// Module 08 · Modules
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runNode } from './helpers/run-node.js';

const FIX = fileURLToPath(new URL('./fixtures/08-modules/', import.meta.url));
const runFixture = (rel, flags = []) => {
  const r = runNode([...flags, path.join(FIX, rel)]);
  if (r.status !== 0) throw new Error(`fixture ${rel} failed:\n${r.stderr}`);
  return JSON.parse(r.stdout.trim().split('\n').at(-1) ?? 'null');
};

/** Write a throwaway module graph into a temp dir and run its entry. */
function runGraph(files, entry = 'main.js') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zto-esm-'));
  for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), src);
  try { return runNode([path.join(dir, entry)]); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

describe('Live bindings and namespace objects (§9.1.1.5, §10.4.6)', () => {
  test('imports are live; export default <expr> is a snapshot; namespaces are exotic', () => {
    const r = runFixture('live/main.js');
    assert.equal(r.before, 0);
    assert.equal(r.after, 1);
    assert.equal(r.viaNs, 1);
    assert.equal(r.snapshot, 0);
    assert.equal(r.assignError, 'TypeError');
    assert.deepEqual(r.keys, ['count', 'default', 'increment']); // code-unit order
    assert.equal(r.proto, null);
    assert.equal(r.tag, 'Module');
    assert.equal(r.extensible, false);
    assert.equal(r.frozen, false);
  });

  test('NEGATIVE: assigning to an import throws TypeError', () => {
    const r = runGraph({
      'dep.js': 'export let x = 1;',
      'main.js': 'import { x } from "./dep.js"; try { x = 2; } catch (e) { console.log(e.name); }',
    });
    assert.equal(r.stdout.trim(), 'TypeError');
  });

  test('the namespace object is cached: the same object for static and dynamic imports', async () => {
    const r = runGraph({
      'dep.js': 'export const v = 1;',
      'main.js': 'import * as a from "./dep.js"; const b = await import("./dep.js"); console.log(a === b);',
    });
    assert.equal(r.stdout.trim(), 'true');
  });
});

describe('Link-time errors (§16.2.1.6.1.2)', () => {
  test('NEGATIVE: a missing named export fails at link time; no module body runs', () => {
    const r = runGraph({
      'dep.js': 'console.log("dep ran"); export const present = 1;',
      'main.js': 'console.log("main ran"); import { absent } from "./dep.js";',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /SyntaxError.*does not provide an export named 'absent'/);
    assert.equal(r.stdout, '');
  });

  test('NEGATIVE: import declarations must be static and top-level', () => {
    const r = runGraph({ 'main.js': 'if (true) { import x from "./x.js"; }' });
    assert.match(r.stderr, /SyntaxError/);
  });
});

describe('Evaluation (§16.2.1.6.1.3): order, caching, cycles', () => {
  test('each module evaluates once, dependencies before dependents (post-order)', () => {
    const r = runGraph({
      'shared.js': 'console.log("shared");',
      'left.js': 'import "./shared.js"; console.log("left");',
      'right.js': 'import "./shared.js"; console.log("right");',
      'main.js': 'import "./left.js"; import "./right.js"; console.log("main");',
    });
    assert.deepEqual(r.stdout.trim().split('\n'), ['shared', 'left', 'right', 'main']);
  });

  test('NEGATIVE: a cycle exposes a TDZ binding to the module that runs first', () => {
    const r = runFixture('cycle/main.js');
    assert.match(r.sawA, /ReferenceError: Cannot access 'a' before initialization/);
    assert.equal(r.later, 'A');       // live binding, initialized by the time it is read later
    assert.equal(r.useB, 'B');
  });

  test('the same cycle with the other entry order does not throw: correctness depends on import order', () => {
    assert.deepEqual(runFixture('cycle/main-reversed.js'), { sawA: 'A' });
  });

  test('NEGATIVE: a failed module stays failed; the same error object is rethrown', () => {
    const r = runGraph({
      'bad.js': 'globalThis.runs = (globalThis.runs ?? 0) + 1; throw new Error("init failed");',
      'main.js': `
        const errs = [];
        for (let i = 0; i < 2; i++) { try { await import("./bad.js"); } catch (e) { errs.push(e); } }
        console.log(JSON.stringify({ same: errs[0] === errs[1], runs: globalThis.runs }));`,
    });
    assert.deepEqual(JSON.parse(r.stdout), { same: true, runs: 1 });
  });
});

describe('Top-level await (ES2022)', () => {
  test('siblings continue while an async module awaits; dependents wait', () => {
    assert.deepEqual(runFixture('tla/main.js'),
      ['slow:start', 'sibling', 'slow:end', 'consumer sees slow', 'entry']);
  });

  test('NEGATIVE: a rejected top-level await fails every dependent', () => {
    const r = runGraph({
      'db.js': 'await Promise.reject(new Error("db down")); export const db = {};',
      'repo.js': 'import { db } from "./db.js"; console.log("repo ran");',
      'main.js': 'import "./repo.js";',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /db down/);
    assert.doesNotMatch(r.stdout, /repo ran/);
  });
});

describe('import.meta, import attributes, import defer', () => {
  test('JSON modules need the type attribute; import.meta has url/resolve/dirname', () => {
    const r = runFixture('attrs/main.js');
    assert.equal(r.name, 'fixture');
    assert.equal(r.missing, 'ERR_IMPORT_ATTRIBUTE_MISSING');
    assert.equal(r.big, '12345678901234567000'); // JSON.parse semantics: precision lost
    assert.equal(r.dirname, true);
    assert.equal(r.resolved, true);
  });

  test('NEGATIVE: legacy import assertions (assert { type }) are rejected', () => {
    const r = runGraph({
      'd.json': '{}',
      'main.js': 'import d from "./d.json" assert { type: "json" };',
    });
    assert.match(r.stderr, /SyntaxError/);
  });

  test('import defer (Stage 3) evaluates on first namespace access (flagged)', () => {
    assert.deepEqual(runFixture('defer/main.js', ['--js-defer-import-eval']),
      ['main body', 'heavy evaluated', 'value 42']);
  });

  test('NEGATIVE: import defer is a SyntaxError without the flag on Node 26', () => {
    const r = runNode([path.join(FIX, 'defer/main.js')]);
    assert.match(r.stderr, /SyntaxError/);
  });
});

describe('package.json exports and conditions', () => {
  test('default conditions pick "node"; --conditions=development picks "development"', () => {
    assert.deepEqual(runFixture('conditions/main.js'),
      { build: 'node', feature: true, blocked: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    assert.equal(runFixture('conditions/main.js', ['--conditions=development']).build, 'development');
  });

  test('NEGATIVE: unexported subpaths are encapsulated', () => {
    assert.equal(runFixture('conditions/main.js').blocked, 'ERR_PACKAGE_PATH_NOT_EXPORTED');
  });
});

describe('ESM vs CJS at the language level', () => {
  test('top-level this is undefined in ESM and module.exports in CJS', () => {
    const esm = runNode(['--input-type=module', '-e', 'console.log(this === undefined)']);
    const cjs = runGraph({ 'main.cjs': 'console.log(this === module.exports)' }, 'main.cjs');
    assert.equal(esm.stdout.trim(), 'true');
    assert.equal(cjs.stdout.trim(), 'true');
  });

  test('NEGATIVE: CommonJS destructuring copies values; it is not live', () => {
    const r = runGraph({
      'c.cjs': 'let count = 0; module.exports = { count, inc() { count++; module.exports.count = count; } };',
      'main.cjs': 'const c = require("./c.cjs"); const { count } = c; c.inc(); console.log(count, c.count);',
    }, 'main.cjs');
    assert.equal(r.stdout.trim(), '0 1');
  });
});
