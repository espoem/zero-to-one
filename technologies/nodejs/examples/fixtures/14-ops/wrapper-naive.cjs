// Like a shell or `npm start` that does not forward signals: SIGTERM kills only the wrapper.
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, [require('node:path').join(__dirname, 'child.cjs')], { stdio: ['ignore', 'inherit', 'inherit'] });
child.on('spawn', () => console.log(`wrapper-ready ${child.pid}`));
