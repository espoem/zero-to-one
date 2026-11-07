// File-system utilities for module 06.
import { open, rename, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

/**
 * Replace `target` atomically: write a temp file in the SAME directory (same file system),
 * fsync it, rename over the target, then fsync the directory so the rename itself is durable.
 * Readers observe either the old or the new file, never a partial one.
 */
export async function writeFileAtomic(target: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${target}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  try {
    {
      await using fh = await open(tmp, 'wx', 0o600); // 'wx': fail if it exists, never follow a planted file
      await fh.writeFile(data);
      await fh.sync(); // data reaches stable storage before it becomes visible under the real name
    }
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  try {
    await using dirHandle = await open(path.dirname(target), 'r');
    await dirHandle.sync(); // persist the directory entry (POSIX); not supported on every platform
  } catch {
    /* best effort: e.g. Windows cannot fsync a directory */
  }
}

/**
 * Resolve a user-supplied relative path inside `root`, rejecting traversal.
 * Uses path.relative so '/srv/files-secret' is not mistaken for a child of '/srv/files'.
 */
export function resolveInside(root: string, userPath: string): string {
  const fail = () =>
    Object.assign(new Error(`path escapes root: ${userPath}`), { code: 'E_PATH_TRAVERSAL' });
  if (userPath.includes('\0') || path.posix.isAbsolute(userPath)) throw fail();
  const full = path.posix.resolve(root, userPath);
  const rel = path.posix.relative(root, full);
  if (rel === '' || rel.startsWith('..') || path.posix.isAbsolute(rel)) throw fail();
  return full;
}

import { spawn } from 'node:child_process';

export interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Run a program without a shell, consume both pipes (no pipe-full deadlock), cap captured output,
 * and kill it on timeout. Resolves on 'close' so all output has been read.
 */
export function run(
  file: string,
  args: readonly string[],
  {
    timeoutMs = 10_000,
    maxOutput = 1 << 20,
    env,
  }: { timeoutMs?: number; maxOutput?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    });
    const out = { stdout: '', stderr: '' };
    for (const key of ['stdout', 'stderr'] as const) {
      child[key].setEncoding('utf8');
      child[key].on('data', (d: string) => {
        if (out[key].length < maxOutput) out[key] += d.slice(0, maxOutput - out[key].length); // keep reading, stop storing
      });
    }
    child.on('error', reject); // ENOENT: program not found
    child.on('close', (code, signal) =>
      resolve({ code, signal, ...out, timedOut: signal === 'SIGKILL' }),
    );
  });
}
