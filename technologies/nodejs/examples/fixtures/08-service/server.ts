// Entry point used by the graceful-shutdown test: node examples/fixtures/08-service/server.ts
import { buildApp, installGracefulShutdown } from '../../08-service.ts';

const app = await buildApp({ slowMs: Number(process.env.SLOW_MS ?? 300) });
installGracefulShutdown(app, { drainDelayMs: 0, deadlineMs: Number(process.env.DEADLINE_MS ?? 10_000) });
await app.listen({ port: 0, host: '127.0.0.1' });
const addr = app.server.address();
process.stdout.write(`listening ${typeof addr === 'object' && addr ? addr.port : 0}\n`);
