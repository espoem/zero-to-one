import test from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from './check.mjs';

test('katex-check rejects \\operatorname', () => {
  const md = '$$\\operatorname{softmax}(x)$$';
  const { errors } = checkContent(md, 'test.md');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, 'forbidden-macro');
  assert.match(errors[0].message, /\\operatorname/);
});

test('katex-check rejects \\textunderscore', () => {
  const md = '$$\\text{segments\\textunderscore per\\textunderscore tier}$$';
  const { errors } = checkContent(md, 'test.md');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, 'forbidden-macro');
  assert.match(errors[0].message, /\\textunderscore/);
});

test('katex-check rejects \\llbracket and \\rrbracket', () => {
  const md = '$$\\llbracket s \\rrbracket$$';
  const { errors } = checkContent(md, 'test.md');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, 'forbidden-macro');
  assert.match(errors[0].message, /\\llbracket/);
});

test('katex-check rejects underscores inside \\text{} and \\texttt{}', () => {
  const md1 = '$$\\text{order_id}$$';
  const res1 = checkContent(md1, 'test.md');
  assert.ok(res1.errors.some((e) => e.type === 'text-underscore'));

  const md2 = '$$\\texttt{rank_constant}$$';
  const res2 = checkContent(md2, 'test.md');
  assert.ok(res2.errors.some((e) => e.type === 'text-underscore'));

  const md3 = '$$\\text{escaped\\_underscore}$$';
  const res3 = checkContent(md3, 'test.md');
  assert.ok(res3.errors.some((e) => e.type === 'text-underscore'));
});

test('katex-check accepts hyphens inside \\text{} and portable brackets', () => {
  const md = '$$[\\![ s \\mid c_1 ]\\!] = c_1([\\![ s ]\\!]) \\qquad \\text{segments-per-tier}$$';
  const { errors } = checkContent(md, 'test.md');
  assert.equal(errors.length, 0);
});
