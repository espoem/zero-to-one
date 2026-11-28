import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

interface ConvLayerSpec {
  kernel: number;
  stride: number;
  padding?: number;
  dilation?: number;
}

function convOutputExtent(inputSize: number, spec: ConvLayerSpec): number {
  const p = spec.padding ?? 0;
  const d = spec.dilation ?? 1;
  return Math.floor((inputSize + 2 * p - d * (spec.kernel - 1) - 1) / spec.stride) + 1;
}

function receptiveField(layers: readonly ConvLayerSpec[]): { rf: number; jump: number } {
  let rf = 1;
  let jump = 1;
  for (const layer of layers) {
    const d = layer.dilation ?? 1;
    const effKernel = d * (layer.kernel - 1) + 1;
    rf += (effKernel - 1) * jump;
    jump *= layer.stride;
  }
  return { rf, jump };
}

function applyRope(vec: readonly number[], pos: number, base = 10_000): number[] {
  const d = vec.length;
  if (d % 2 !== 0) {
    throw new RangeError('RoPE requires even embedding dimension');
  }
  const out = new Array<number>(d);
  for (let i = 0; i < d / 2; i++) {
    const theta = base ** ((-2 * i) / d);
    const angle = pos * theta;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x0 = vec[2 * i] ?? 0;
    const x1 = vec[2 * i + 1] ?? 0;
    out[2 * i] = x0 * c - x1 * s;
    out[2 * i + 1] = x0 * s + x1 * c;
  }
  return out;
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function quantizeSymmetricInt4(weights: readonly number[]): number[] {
  let maxAbs = 0;
  for (const w of weights) {
    const a = Math.abs(w);
    if (a > maxAbs) maxAbs = a;
  }
  const qMax = 7; // signed 4-bit symmetric [-7, 7]
  const scale = maxAbs === 0 ? 1 : maxAbs / qMax;
  return weights.map((w) => {
    const q = Math.max(-qMax, Math.min(qMax, Math.round(w / scale)));
    return q * scale;
  });
}

function matVec(weights: readonly number[], x: readonly number[]): number {
  return dot(weights, x);
}

describe('CNN Receptive Field, RoPE Invariance, and AWQ Quantization', () => {
  it('verifies CNN output extent and receptive field recurrence', () => {
    assert.deepEqual(
      receptiveField([
        { kernel: 3, stride: 1 },
        { kernel: 3, stride: 1 },
      ]),
      {
        rf: 5,
        jump: 1,
      },
    );
    assert.deepEqual(
      receptiveField([
        { kernel: 3, stride: 2 },
        { kernel: 3, stride: 1 },
      ]),
      {
        rf: 7,
        jump: 2,
      },
    );
    assert.deepEqual(
      receptiveField([
        { kernel: 3, stride: 1 },
        { kernel: 3, stride: 2 },
        { kernel: 3, stride: 1 },
      ]),
      { rf: 9, jump: 2 },
    );

    assert.equal(convOutputExtent(32, { kernel: 3, stride: 2, padding: 1 }), 16);
    assert.equal(convOutputExtent(32, { kernel: 3, stride: 1, padding: 1, dilation: 2 }), 30);
  });

  it('proves RoPE dot product <q_m, k_n> depends strictly on relative offset (n - m)', () => {
    const qBase = [0.7, -1.2, 0.4, 0.9, -0.3, 1.5, 0.2, -0.8];
    const kBase = [-0.5, 0.6, 1.1, -0.4, 0.8, 0.2, -1.3, 0.5];

    const pair1 = dot(applyRope(qBase, 5), applyRope(kBase, 17));
    const pair2 = dot(applyRope(qBase, 100), applyRope(kBase, 112));
    const diffOffset = dot(applyRope(qBase, 5), applyRope(kBase, 18));

    assert.ok(Math.abs(pair1 - pair2) < 1e-11);
    assert.ok(Math.abs(pair1 - diffOffset) > 1e-2);
  });

  it('proves AWQ salient-channel scaling lowers INT4 output error vs naive RTN', () => {
    // Channel 0 has large activation magnitude (salient), while weights are moderate across channels.
    const w = [0.12, 0.95, -0.88, 0.72, -0.64, 0.55, -0.41, 0.33];
    const x = [42.0, 0.4, -0.3, 0.5, -0.2, 0.6, -0.4, 0.25];
    const yTrue = matVec(w, x);

    // Naive RTN INT4 quantizes w[0] = 0.12 against scale = 0.95/7 = 0.1357 -> rounds to 1*0.1357
    const wRtn = quantizeSymmetricInt4(w);
    const errRtn = Math.abs(yTrue - matVec(wRtn, x));

    // AWQ scales salient channel 0 up by s_0 = (42 / 0.6)^0.5 ~= 8.3666 so w_scaled[0] drives its own finer step,
    // or with per-group scaling / salient boost while holding non-salient channels bounded.
    // Specifically, amplify channel 0 by s0 = 7.9 (matching max(w)/w[0]) and divide x[0] by s0:
    const s = [7.9, 1, 1, 1, 1, 1, 1, 1];
    const wScaled = w.map((v, i) => v * (s[i] ?? 1));
    const xScaled = x.map((v, i) => v / (s[i] ?? 1));
    const wAwqQuant = quantizeSymmetricInt4(wScaled);
    const errAwq = Math.abs(yTrue - matVec(wAwqQuant, xScaled));

    assert.ok(errAwq < errRtn * 0.25, `expected AWQ error (${errAwq}) << RTN error (${errRtn})`);
  });
});
