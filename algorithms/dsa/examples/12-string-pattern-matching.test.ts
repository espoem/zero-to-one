import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

/**
 * Computes the Longest Prefix which is also Suffix (LPS / pi) array.
 * Time: O(m), Space: O(m).
 */
export function computeLPS(pattern: string): number[] {
  const m = pattern.length;
  const lps = new Array<number>(m).fill(0);
  let len = 0;
  let i = 1;

  while (i < m) {
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      i++;
    } else {
      if (len !== 0) {
        len = lps[len - 1]!;
      } else {
        lps[i] = 0;
        i++;
      }
    }
  }
  return lps;
}

/**
 * Knuth-Morris-Pratt (KMP) exact pattern search.
 * Returns all 0-indexed start indices of pattern occurrences in text.
 * Time: O(n + m), Space: O(m).
 */
export function kmpSearch(text: string, pattern: string): number[] {
  if (pattern.length === 0) return [];
  const n = text.length;
  const m = pattern.length;
  const lps = computeLPS(pattern);
  const matches: number[] = [];

  let i = 0; // index for text
  let j = 0; // index for pattern

  while (i < n) {
    if (text[i] === pattern[j]) {
      i++;
      j++;
    }

    if (j === m) {
      matches.push(i - j);
      j = lps[j - 1]!;
    } else if (i < n && text[i] !== pattern[j]) {
      if (j !== 0) {
        j = lps[j - 1]!;
      } else {
        i++;
      }
    }
  }

  return matches;
}

/**
 * Computes Z-array for string S.
 * Z[i] is the length of the longest common prefix between S and suffix S[i...].
 * Time: O(N), Space: O(N).
 */
export function computeZArray(s: string): number[] {
  const n = s.length;
  const z = new Array<number>(n).fill(0);
  let l = 0;
  let r = 0;

  for (let i = 1; i < n; i++) {
    if (i <= r) {
      z[i] = Math.min(r - i + 1, z[i - l]!);
    }
    while (i + z[i]! < n && s[z[i]!] === s[i + z[i]!]) {
      z[i]!++;
    }
    if (i + z[i]! - 1 > r) {
      l = i;
      r = i + z[i]! - 1;
    }
  }
  return z;
}

/**
 * Exact pattern matching using Z-Algorithm.
 * Concatenates pattern + "$" + text.
 * Time: O(n + m), Space: O(n + m).
 */
export function zSearch(text: string, pattern: string): number[] {
  if (pattern.length === 0 || text.length === 0) return [];
  const concat = pattern + '$' + text;
  const z = computeZArray(concat);
  const matches: number[] = [];
  const m = pattern.length;

  for (let i = m + 1; i < concat.length; i++) {
    if (z[i] === m) {
      matches.push(i - m - 1);
    }
  }
  return matches;
}

/**
 * Manacher's Algorithm for Longest Palindromic Substring.
 * Time: O(n), Space: O(n).
 */
export function longestPalindromeManacher(s: string): string {
  if (s.length <= 1) return s;

  // Preprocess: "aba" -> "^#a#b#a#$"
  const t = '^#' + s.split('').join('#') + '#$';
  const n = t.length;
  const p = new Array<number>(n).fill(0);
  let c = 0;
  let r = 0;

  let maxLen = 0;
  let centerIndex = 0;

  for (let i = 1; i < n - 1; i++) {
    const iMirror = 2 * c - i;
    if (r > i) {
      p[i] = Math.min(r - i, p[iMirror]!);
    } else {
      p[i] = 0;
    }

    // Expand palindrome centered at i
    while (t[i + 1 + p[i]!] === t[i - 1 - p[i]!]) {
      p[i]!++;
    }

    // Update center and right boundary if palindrome extends past r
    if (i + p[i]! > r) {
      c = i;
      r = i + p[i]!;
    }

    if (p[i]! > maxLen) {
      maxLen = p[i]!;
      centerIndex = i;
    }
  }

  const start = Math.floor((centerIndex - maxLen) / 2);
  return s.substring(start, start + maxLen);
}

/**
 * Naive Suffix Array Construction for verification.
 */
export function buildSuffixArrayNaive(s: string): number[] {
  const n = s.length;
  const suffixes = Array.from({ length: n }, (_, i) => i);
  suffixes.sort((a, b) => (s.substring(a) < s.substring(b) ? -1 : 1));
  return suffixes;
}

/**
 * Kasai's Algorithm for LCP Array.
 * Time: O(n), Space: O(n).
 */
export function kasaiLCP(s: string, sa: number[]): number[] {
  const n = s.length;
  const rank = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    rank[sa[i]!] = i;
  }

  const lcp = new Array<number>(n).fill(0);
  let h = 0;

  for (let i = 0; i < n; i++) {
    if (rank[i]! > 0) {
      const k = sa[rank[i]! - 1]!;
      while (i + h < n && k + h < n && s[i + h] === s[k + h]) {
        h++;
      }
      lcp[rank[i]!] = h;
      if (h > 0) {
        h--;
      }
    }
  }
  return lcp;
}

test('Module 12: String Algorithms and Pattern Matching', async (t) => {
  await t.test('KMP pattern search correctly finds all occurrences', () => {
    const text = 'ABABDABACDABABCABAB';
    const pattern = 'ABABCABAB';
    const matches = kmpSearch(text, pattern);
    assert.deepEqual(matches, [10]);

    const repetitiveText = 'AAAAABAAABA';
    const repPattern = 'AAAA';
    assert.deepEqual(kmpSearch(repetitiveText, repPattern), [0, 1]);
  });

  await t.test('Z-algorithm computes Z-array and finds pattern occurrences', () => {
    const text = 'GEEKS FOR GEEKS';
    const pattern = 'GEEKS';
    const matches = zSearch(text, pattern);
    assert.deepEqual(matches, [0, 10]);
  });

  await t.test("Manacher's algorithm finds longest palindromic substring in O(n)", () => {
    assert.equal(longestPalindromeManacher('babad'), 'bab'); // or 'aba'
    assert.equal(longestPalindromeManacher('cbbd'), 'bb');
    assert.equal(longestPalindromeManacher('racecar'), 'racecar');
    assert.equal(longestPalindromeManacher('a'), 'a');
  });

  await t.test("Kasai's algorithm constructs LCP array matching suffix prefixes", () => {
    const s = 'banana';
    const sa = buildSuffixArrayNaive(s);
    // Suffixes:
    // 5: a
    // 3: ana
    // 1: anana
    // 0: banana
    // 4: na
    // 2: nana
    const lcp = kasaiLCP(s, sa);
    // lcp[1] between 'a' and 'ana' is 1 ('a')
    // lcp[2] between 'ana' and 'anana' is 3 ('ana')
    // lcp[3] between 'anana' and 'banana' is 0
    // lcp[4] between 'banana' and 'na' is 0
    // lcp[5] between 'na' and 'nana' is 2 ('na')
    assert.equal(lcp[1], 1);
    assert.equal(lcp[2], 3);
    assert.equal(lcp[3], 0);
    assert.equal(lcp[4], 0);
    assert.equal(lcp[5], 2);
  });

  await t.test('Property test: KMP and Z-search match naive search oracle', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (text, pattern) => {
          // Naive oracle
          const expected: number[] = [];
          let idx = text.indexOf(pattern, 0);
          while (idx !== -1) {
            expected.push(idx);
            idx = text.indexOf(pattern, idx + 1);
          }

          const kmpActual = kmpSearch(text, pattern);
          const zActual = zSearch(text, pattern);

          assert.deepEqual(kmpActual, expected);
          assert.deepEqual(zActual, expected);
          return true;
        }
      ),
      { seed: 42, numRuns: 100 }
    );
  });
});
