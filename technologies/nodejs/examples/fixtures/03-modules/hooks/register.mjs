import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'virtual:answer') return { url: 'virtual:answer', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'virtual:answer') return { format: 'module', source: 'export default 42;', shortCircuit: true };
    return next(url, context);
  },
});
