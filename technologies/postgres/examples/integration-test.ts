import net from 'node:net';

function checkPostgresReachable(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function run(): Promise<void> {
  const host = process.env.PGHOST || '127.0.0.1';
  const port = Number(process.env.PGPORT || 5432);

  const reachable = await checkPostgresReachable(host, port);
  if (!reachable) {
    console.log(`[SKIP] Integration test: Docker PostgreSQL instance not reachable on ${host}:${port}. Start with 'docker compose up -d'.`);
    process.exit(0);
  }

  console.log(`[PASS] integration-test: PostgreSQL reachable on ${host}:${port}`);
}

await run();
