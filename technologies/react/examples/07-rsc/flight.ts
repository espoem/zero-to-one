import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const serverScript = fileURLToPath(new URL("./server.ts", import.meta.url));

/** Run one server scenario in a separate `react-server` process; resolve with stdout/stderr. */
export function runServer(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--conditions", "react-server", serverScript, ...args], {
      env: { ...process.env, NODE_ENV: "production" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

/** Flight rows as an array of strings (binary rows are kept as-is). */
export const rows = (flight: string) => flight.split("\n").filter(Boolean);

export const toStream = (s: string) => Readable.from([Buffer.from(s)]);
