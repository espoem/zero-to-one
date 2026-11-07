// Spawn the *same* Node binary that runs the tests, so versions and flags match.
// Every runtime-flag experiment in this track runs in a child process: flags such as
// --permission, --max-old-space-size or --unhandled-rejections are process-wide and
// must never leak into the test runner itself.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';

export interface RunResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  input?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeout?: number;
}

/** A clean environment: no inherited NODE_OPTIONS and no node:test parent context. */
export function cleanEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_OPTIONS; // the host may set one; it changes config-file behaviour (module 01)
  delete env.NODE_TEST_CONTEXT; // otherwise a child `node --test` reports to our runner
  delete env.NODE_CHANNEL_FD;
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

export function runNode(args: string[], opts: RunOptions = {}): RunResult {
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    input: opts.input,
    cwd: opts.cwd,
    env: cleanEnv(opts.env),
    timeout: opts.timeout ?? 30_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Run a snippet as an ES module (`--input-type=module -e`). */
export function runModule(source: string, flags: string[] = [], opts: RunOptions = {}): RunResult {
  return runNode([...flags, '--input-type=module', '-e', source], opts);
}

/**
 * Start a long-lived child, wait until it prints `readyToken` on stdout, and hand back
 * the process plus a promise of its final result. Used for signal and server tests:
 * the parent acts only after an explicit readiness message, never after a sleep.
 */
export async function startNode(
  args: string[],
  readyToken: string,
  opts: RunOptions = {},
): Promise<{
  child: ReturnType<typeof spawn>;
  firstLine: string;
  done: Promise<RunResult>;
}> {
  const child = spawn(process.execPath, args, {
    cwd: opts.cwd,
    env: cleanEnv(opts.env),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout!.setEncoding('utf8');
  child.stderr!.setEncoding('utf8');
  child.stderr!.on('data', (d: string) => (stderr += d));
  const exited = once(child, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;
  const firstLine = await new Promise<string>((resolve, reject) => {
    const onData = (d: string) => {
      stdout += d;
      const line = stdout.split('\n').find((l) => l.includes(readyToken));
      if (line !== undefined) {
        child.stdout!.off('data', onData);
        child.stdout!.on('data', (more: string) => (stdout += more));
        resolve(line);
      }
    };
    child.stdout!.on('data', onData);
    exited.then(([code, sig]) =>
      reject(new Error(`child exited (${code ?? sig}) before ready: ${stderr}`)),
    );
  });
  const done = exited.then(([status, signal]) => ({ status, signal, stdout, stderr }));
  return { child, firstLine, done };
}
