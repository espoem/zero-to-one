// Module 03 · Modules and packages: the CJS loader, require(esm), exports/imports, conditions,
// the dual-package hazard, customisation hooks and TypeScript type stripping.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, builtinModules, stripTypeScriptTypes, findPackageJSON } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runNode } from './helpers/run-node.ts';

const FIX = fileURLToPath(new URL('./fixtures/03-modules/', import.meta.url));
const requireFix = createRequire(FIX);
const run = (args: string[], cwd = FIX) => runNode(args, { cwd });

describe('the CommonJS loader', () => {
  test('every CJS module is wrapped in a function with five parameters', () => {
    const r = run(['-p', 'require("node:module").wrapper[0]']);
    assert.match(r.stdout, /\(function \(exports, require, module, __filename, __dirname\) \{/);
  });

  test('modules are cached by resolved filename: state is shared until the cache entry is deleted', () => {
    const path = requireFix.resolve('./counter.cjs');
    const a = requireFix('./counter.cjs');
    a.inc();
    assert.equal(requireFix('./counter.cjs').n, 1); // same instance
    delete requireFix.cache[path];
    assert.equal(requireFix('./counter.cjs').n, 0); // fresh instance: the old one still lives in `a`
    assert.equal(a.n, 1);
  });

  test('cycles see a PARTIAL exports object, not an error', () => {
    const r = run(['-p', 'JSON.stringify(require("./cycle-a.cjs"))']);
    assert.deepEqual(JSON.parse(r.stdout), { loaded: true, bSawA: { loaded: false } });
  });

  test('package "imports" (#subpaths) are private aliases with conditions', () => {
    assert.equal(run(['uses-imports.cjs']).stdout.trim(), 'internal util node');
  });
});

describe('require(esm)', () => {
  test('require() of a synchronous ES module returns its namespace (with __esModule when there is a default)', () => {
    const ns = requireFix('./esm.mjs');
    assert.equal(ns.x, 1);
    assert.equal(ns.default, 'd');
    assert.equal(ns.__esModule, true);
    assert.equal(Object.prototype.toString.call(ns), '[object Module]');
  });

  test('an ES module can choose what require() returns with the "module.exports" export name', () => {
    const Point = requireFix('./module-exports.mjs');
    assert.equal(typeof Point, 'function');
    assert.equal(Point.named, undefined); // named exports are invisible to CJS consumers
  });

  test('top-level await anywhere in the graph makes require() throw ERR_REQUIRE_ASYNC_MODULE', () => {
    assert.throws(() => requireFix('./tla.mjs'), { code: 'ERR_REQUIRE_ASYNC_MODULE' });
    assert.throws(() => requireFix('./imports-tla.mjs'), { code: 'ERR_REQUIRE_ASYNC_MODULE' });
  });

  test('import() still works for async graphs', async () => {
    const m = await import(new URL('./fixtures/03-modules/imports-tla.mjs', import.meta.url).href);
    assert.equal(m.z, 3);
  });

  test('--no-require-module restores ERR_REQUIRE_ESM', () => {
    const r = run([
      '--no-require-module',
      '-e',
      'try { require("./esm.mjs") } catch (e) { console.log(e.code) }',
    ]);
    assert.equal(r.stdout.trim(), 'ERR_REQUIRE_ESM');
  });

  test('syntax detection: a typeless .js file with ESM syntax loads as ESM (and is require()-able)', () => {
    assert.equal(run(['-p', 'require("./typeless.js").fromTypeless']).stdout.trim(), 'd');
  });
});

describe('ESM importing CommonJS', () => {
  test('named exports come from a static lexer: getters are missed, dead branches are included', async () => {
    const ns = await import(new URL('./fixtures/03-modules/lexer.cjs', import.meta.url).href);
    const keys = Object.keys(ns).sort();
    assert.ok(keys.includes('a') && keys.includes('b'));
    assert.ok(!keys.includes('c'), 'defineProperty getter is not detected');
    assert.ok(keys.includes('d'), 'conditional assignment is still detected');
    assert.equal(ns.d, undefined);
    assert.equal(ns.default.c, 3); // default is always module.exports
    assert.equal(ns['module.exports'], ns.default);
  });
});

describe('package exports and conditions', () => {
  test('"exports" encapsulates: unlisted subpaths are ERR_PACKAGE_PATH_NOT_EXPORTED', () => {
    assert.throws(() => requireFix('sync-first/private.cjs'), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
  });

  test('"module-sync" lets require() and import share ONE ESM copy', async () => {
    const viaRequire = requireFix('sync-first');
    const viaImport = await import(requireFix.resolve('sync-first'));
    assert.equal(viaRequire.flavour, 'esm via module-sync');
    assert.equal(viaRequire, viaImport);
  });

  test('custom conditions are opt-in with --conditions', () => {
    assert.equal(run(['-p', 'require("sync-first/feature")']).stdout.trim(), 'production build');
    assert.equal(
      run(['--conditions=development', '-p', 'require("sync-first/feature")']).stdout.trim(),
      'development build',
    );
  });

  test('the dual-package hazard: import and require load two different classes', async () => {
    const esm = await import(
      new URL('./fixtures/03-modules/node_modules/dual/esm.mjs', import.meta.url).href
    );
    const cjs = requireFix('dual');
    assert.equal(esm.flavour, 'esm');
    assert.equal(cjs.flavour, 'cjs');
    assert.equal(new esm.Thing() instanceof cjs.Thing, false);
  });

  test('module.findPackageJSON locates the governing package.json', () => {
    const p = findPackageJSON(new URL('./fixtures/03-modules/esm.mjs', import.meta.url));
    assert.ok(p?.endsWith('03-modules/package.json'));
  });
});

describe('customisation hooks (module.registerHooks, synchronous, in-thread)', () => {
  test('one resolve/load pair serves both import and require', () => {
    const r = run(['--import', './hooks/register.mjs', 'hooks/main.mjs']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '42 42');
  });

  test('module.register() is runtime-deprecated in Node 26 (DEP0205)', () => {
    const r = run([
      '-e',
      'require("node:module").register("data:text/javascript,export async function resolve(s,c,n){return n(s,c)}")',
    ]);
    assert.match(r.stderr, /DEP0205/);
  });
});

describe('TypeScript type stripping', () => {
  const ts = (file: string) => run([`ts/${file}`]);

  test('erasable syntax runs directly', () => {
    const r = ts('ok.ts');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '6');
    assert.equal(ts('declare-only.ts').stdout.trim(), 'declare is erasable');
  });

  for (const [file, what] of [
    ['enum.ts', 'enum'],
    ['param-property.ts', 'parameter property'],
    ['runtime-namespace.ts', 'namespace'],
  ] as const) {
    test(`non-erasable ${what} is ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, () => {
      const r = ts(file);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
    });
  }

  test('importing a type without `type` fails at RUNTIME: the export does not exist in JavaScript', () => {
    const r = ts('missing-type-keyword.ts');
    assert.match(r.stderr, /does not provide an export named 'Shape'/);
  });

  test('imports need real file extensions: tsconfig paths and extension guessing do not apply', () => {
    assert.match(ts('no-extension.ts').stderr, /ERR_MODULE_NOT_FOUND/);
  });

  test('TypeScript under node_modules is refused', () => {
    assert.match(ts('uses-ts-dep.mjs').stderr, /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/);
  });

  test('stripping replaces types with whitespace, so line and column numbers survive', () => {
    const src = 'const a: number = 1;\nfunction f(x: string): void {}\n';
    const out = stripTypeScriptTypes(src);
    assert.equal(out.length, src.length);
    assert.equal(out.split('\n').length, src.split('\n').length);
    assert.match(out, /^const a {9}= 1;/);
  });

  test('--no-strip-types turns the feature off', () => {
    const r = run(['--no-strip-types', 'ts/ok.ts']);
    assert.notEqual(r.status, 0);
  });
});

test('builtinModules lists core modules; scheme-only ones carry the node: prefix', () => {
  assert.ok(builtinModules.includes('fs'));
  assert.ok(builtinModules.includes('node:test'));
  assert.ok(!builtinModules.includes('test'));
});
