'use strict';
// Structural checks for the QR encoder. Real-decoder verification (zxing-cpp on
// Chrome-rendered PNGs of the SVG output) was done for versions 1–10 and all 8
// masks; see README "QR code" for how to repeat it.
const { test } = require('node:test');
const assert = require('node:assert');
const { encode, svg } = require('../src/qr');

const finderOk = (m, R, C) => {
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
    if (m[R + r][C + c] !== (d === 2 ? 0 : 1)) return false;
  }
  return true;
};
// Read format bits from the copy around the top-left finder (spec bit order).
const readFormat = (m) => {
  const b = [];
  for (let i = 0; i <= 5; i++) b[i] = m[i][8];
  b[6] = m[7][8]; b[7] = m[8][8]; b[8] = m[8][7];
  for (let i = 9; i < 15; i++) b[i] = m[8][14 - i];
  const f = b.reduce((a, x, i) => a | (x << i), 0) ^ 0x5412;
  return { ec: f >> 13, mask: (f >> 10) & 7 };
};

test('picks the smallest version and has correct function patterns', () => {
  const cases = [['a', 1], ['x'.repeat(14), 1], ['x'.repeat(15), 2], ['x'.repeat(100), 6], ['x'.repeat(213), 10]];
  for (const [t, v] of cases) {
    const m = encode(t), n = v * 4 + 17;
    assert.equal(m.version, v, `version for ${t.length} bytes`);
    assert.equal(m.length, n);
    assert.ok(m.every((row) => row.length === n));
    assert.ok(finderOk(m, 0, 0) && finderOk(m, 0, n - 7) && finderOk(m, n - 7, 0), 'finders');
    for (let i = 8; i < n - 8; i++) assert.equal(m[6][i], i % 2 ? 0 : 1, 'timing');
    assert.equal(m[n - 8][8], 1, 'dark module');
    const f = readFormat(m);
    assert.equal(f.ec, 0, 'EC level M');
    assert.equal(f.mask, m.mask);
  }
});

test('every forced mask writes its own format info', () => {
  for (let k = 0; k < 8; k++) assert.equal(readFormat(encode('http://dor/s/ab12', { mask: k })).mask, k);
});

test('version info present from version 7', () => {
  const m = encode('x'.repeat(120)); // v7
  assert.equal(m.version, 7);
  // Version 7 info = 0x07C94, bits laid out in the 6x3 block above the bottom-left finder.
  const n = m.length; let v = 0;
  for (let i = 0; i < 18; i++) v |= m[n - 11 + (i % 3)][Math.floor(i / 3)] << i;
  assert.equal(v, 0x07c94);
});

test('UTF-8 Arabic text and limits', () => {
  assert.ok(encode('دور — مخبز').version >= 1);
  assert.throws(() => encode('x'.repeat(214)), RangeError);
});

test('svg is compact and has a single path', () => {
  const s = svg('https://dor.example/s/ab12', { label: 'رمز QR' });
  assert.match(s, /^<svg [^>]*viewBox="0 0 33 33"/);
  assert.equal((s.match(/<path/g) || []).length, 1);
  assert.match(s, /role="img" aria-label="رمز QR"/);
  assert.ok(s.length < 6000, `svg ${s.length} bytes`);
});
