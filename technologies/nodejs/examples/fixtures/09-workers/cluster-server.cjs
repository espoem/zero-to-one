// Primary forks 2 workers that share one listening port; prints the port when both are listening.
const cluster = require('node:cluster');
const http = require('node:http');
if (cluster.isPrimary) {
  let listening = 0;
  for (let i = 0; i < 2; i++) cluster.fork();
  cluster.on('listening', (_w, addr) => { if (++listening === 2) console.log(`ready ${addr.port}`); });
  process.on('SIGTERM', () => { for (const w of Object.values(cluster.workers)) w.kill('SIGTERM'); });
} else {
  const port = Number(process.env.PORT_HINT || 0);
  http.createServer((_req, res) => res.end(String(process.pid))).listen(port === 0 ? 0 : port);
}
