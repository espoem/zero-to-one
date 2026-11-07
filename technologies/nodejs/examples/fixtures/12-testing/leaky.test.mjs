import { test } from 'node:test';
test('forgets to await a rejected promise', () => {
  Promise.reject(new Error('lost rejection'));
});
