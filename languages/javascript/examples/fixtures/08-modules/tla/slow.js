globalThis.order.push('slow:start');
await new Promise((r) => setTimeout(r, 30));
globalThis.order.push('slow:end');
export const value = 'slow';
