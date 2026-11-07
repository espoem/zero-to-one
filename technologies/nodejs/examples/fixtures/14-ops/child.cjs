// A service that shuts down cleanly on SIGTERM and reports it.
process.on('SIGTERM', () => {
  console.log('child: SIGTERM received, draining');
  setTimeout(() => { console.log('child: drained'); process.exitCode = 0; clearInterval(keepAlive); }, 20);
});
const keepAlive = setInterval(() => {}, 1000);
console.log(`child-ready ${process.pid}`);
