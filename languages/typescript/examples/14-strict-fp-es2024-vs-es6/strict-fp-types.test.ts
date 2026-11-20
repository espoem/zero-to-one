import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { expectTypeOf } from 'expect-type';
import * as ES2024 from '#strata/es2024';
import * as ES6 from '#strata/es6';

describe('14 · Strict FP Type-Level Contracts & Compiler Enforcement', () => {
  it('enforces compile-time DotPath, Evolver, compact, partition, Curried2, and DebounceMode', () => {
    interface Config {
      readonly host: string;
      readonly tls: {
        readonly enabled: boolean;
        readonly port: number;
      };
      readonly tags: readonly string[];
    }

    type ValidPaths = ES2024.DotPath<Config>;
    expectTypeOf<ValidPaths>().toEqualTypeOf<
      'host' | 'tls' | 'tls.enabled' | 'tls.port' | 'tags'
    >();
    expectTypeOf<ES2024.DotPathValue<Config, 'tls.port'>>().toEqualTypeOf<number>();
    expectTypeOf<ES6.DotPath<Config>>().toEqualTypeOf<ValidPaths>();

    const cfg: Config = { host: 'localhost', tls: { enabled: true, port: 443 }, tags: ['prod'] };
    const portOpt = ES2024.getPath(cfg, 'tls.port');
    expectTypeOf(portOpt).toEqualTypeOf<ES2024.Option<number>>();
    assert.deepEqual(portOpt, ES2024.some(443));

    // @ts-expect-error -- 'tls.nonexistent' is not a valid DotPath<Config>
    const _badPath: ES2024.DotPath<Config> = 'tls.nonexistent';
    void _badPath;

    const mixed: readonly (string | number | null | undefined | false | 0 | '')[] = ['a', 0, null];
    const clean = ES2024.compact(mixed);
    expectTypeOf(clean).toEqualTypeOf<(string | number)[]>();

    const mixedItems: readonly (number | string)[] = [1, 'a', 2, 'b'];
    const [nums, strs] = ES2024.partition(mixedItems, (x): x is number => typeof x === 'number');
    expectTypeOf(nums).toEqualTypeOf<number[]>();
    expectTypeOf(strs).toEqualTypeOf<string[]>();
    assert.deepEqual(nums, [1, 2]);
    assert.deepEqual(strs, ['a', 'b']);

    const validMode: ES2024.DebounceMode = { edge: 'both' };
    assert.equal(validMode.edge, 'both');
    // @ts-expect-error -- 'neither' is not a valid DebounceMode edge
    const _badMode: ES2024.DebounceMode = { edge: 'neither' };
    void _badMode;

    const repeatStr = ES2024.curry2((s: string, n: number): string => s.repeat(n));
    const triple = repeatStr(ES2024.__, 3);
    expectTypeOf(triple).toEqualTypeOf<(a: string) => string>();
    assert.equal(triple('ha'), 'hahaha');

    type Status = 'open' | 'closed';
    const handle = (s: Status): number => {
      switch (s) {
        case 'open':
          return 1;
        case 'closed':
          return 0;
        default:
          return ES2024.assertNever(s);
      }
    };
    assert.equal(handle('open'), 1);

    const badStatus = 'open' as Status;
    // @ts-expect-error -- Status is not assignable to never without narrowing
    const _exhaustiveFail = (): never => ES2024.assertNever(badStatus);
    void _exhaustiveFail;
  });

  it('proves tsc rejects ES2024 APIs under the strict ES2015 lib profile (TS2339)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'strata-es6-gate-'));
    try {
      const probeFile = join(dir, 'probe.ts');
      const tsconfigFile = join(dir, 'tsconfig.json');
      writeFileSync(
        probeFile,
        'export const bad = (xs: readonly number[]): number[] => xs.toSorted((a, b) => a - b);\n',
      );
      writeFileSync(
        tsconfigFile,
        JSON.stringify({
          compilerOptions: {
            target: 'ES2015',
            lib: ['ES2015'],
            types: [],
            strict: true,
            noEmit: true,
          },
          include: ['./probe.ts'],
        }),
      );

      const tscBin = resolve(import.meta.dirname, '../../node_modules/.bin/tsc');
      let stderrOrStdout = '';
      let exitCode = 0;
      try {
        execFileSync(tscBin, ['-p', tsconfigFile], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err: unknown) {
        const e = err as { status?: number; stdout?: string; stderr?: string };
        exitCode = e.status ?? 1;
        stderrOrStdout = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      }
      assert.notEqual(exitCode, 0, 'tsc must reject ES2023 toSorted under lib: ["ES2015"]');
      assert.match(stderrOrStdout, /TS2339/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
