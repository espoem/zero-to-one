// What an init (tini, dumb-init, docker --init) does: forward signals, reap, mirror the exit status.
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, [require('node:path').join(__dirname, 'child.cjs')], { stdio: ['ignore', 'inherit', 'inherit'] });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
child.on('spawn', () => console.log(`wrapper-ready ${child.pid}`));
child.on('exit', (code, signal) => { process.exitCode = code ?? 128 + require('node:os').constants.signals[signal]; });
