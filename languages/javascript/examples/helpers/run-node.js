// Spawn the *same* Node binary that runs the tests, so flags and versions match.
import { spawnSync } from 'node:child_process';

/**
 * @param {string[]} args arguments after the node executable
 * @param {{ input?: string, cwd?: string }} [opts]
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
export function runNode(args, opts = {}) {
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    input: opts.input,
    cwd: opts.cwd,
    env: { ...process.env, NODE_OPTIONS: '' },
    timeout: 20_000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
