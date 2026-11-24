'use strict';
// Dependency-free QR Code encoder: byte mode, error correction level M,
// versions 1–10 (up to 213 bytes), all 8 masks scored with the standard
// penalty rules. Output: a compact SVG with a single <path>.

// [ecCodewordsPerBlock, group1Blocks, group1DataCw, group2Blocks, group2DataCw] for level M.
const EC_M = [null,
  [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const dataCapacity = (v) => { const e = EC_M[v]; return e[1] * e[2] + e[3] * e[4]; };

// ---- GF(256) arithmetic and Reed–Solomon ----
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const n = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= mul(g[j], EXP[i]); }
    g = n;
  }
  return g; // g[0] = 1 (leading coefficient)
}
function rsRemainder(data, deg) {
  const g = rsGenerator(deg), r = new Array(deg).fill(0);
  for (const d of data) {
    const f = d ^ r.shift(); r.push(0);
    for (let i = 0; i < deg; i++) r[i] ^= mul(g[i + 1], f);
  }
  return r;
}

// ---- BCH codes for format / version info ----
function bch(value, poly, polyBits) {
  let v = value << (polyBits - 1);
  for (let i = 31; i >= polyBits - 1; i--) if ((v >>> i) & 1) v ^= poly << (i - polyBits + 1);
  return (value << (polyBits - 1)) | v;
}
const formatBits = (mask) => bch((0 << 3) | mask, 0x537, 11) ^ 0x5412; // EC level M = 00
const versionBits = (v) => bch(v, 0x1f25, 13);

// ---- data encoding ----
function encodeData(bytes, v) {
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCapacity(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0; cw.length < dataCapacity(v); p ^= 1) cw.push(p ? 0x11 : 0xec);
  // Split into blocks, add EC, interleave.
  const [ec, b1, d1, b2, d2] = EC_M[v], blocks = [];
  let k = 0;
  for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d2; blocks.push(cw.slice(k, k += n)); }
  const ecs = blocks.map((b) => rsRemainder(b, ec)), out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

// ---- matrix ----
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];

function baseMatrix(v) {
  const n = v * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, on) => { m[r][c] = on ? 1 : 0; fn[r][c] = true; };
  // Finder patterns + separators.
  for (const [R, C] of [[0, 0], [0, n - 7], [n - 7, 0]])
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const y = R + r, x = C + c;
      if (y < 0 || x < 0 || y >= n || x >= n) continue;
      const d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      set(y, x, d !== 2 && d !== 4);
    }
  // Timing patterns.
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // Alignment patterns.
  const a = ALIGN[v];
  const last = a.length - 1;
  for (let i = 0; i <= last; i++) for (let j = 0; j <= last; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue; // finder corners
    const r = a[i], c = a[j];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      set(r + dy, c + dx, Math.max(Math.abs(dy), Math.abs(dx)) !== 1);
  }
  // Reserve format areas + dark module.
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); }
  for (let i = 0; i < 8; i++) { set(8, n - 1 - i, false); set(n - 1 - i, 8, false); }
  set(n - 8, 8, true);
  // Version info (v >= 7).
  if (v >= 7) {
    const vb = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >>> i) & 1, r = Math.floor(i / 3), c = n - 11 + (i % 3);
      set(r, c, bit); set(c, r, bit);
    }
  }
  return { n, m, fn };
}

function placeData(n, m, fn, cw) {
  let i = 0;
  const total = cw.length * 8;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (fn[r][c]) continue;
        m[r][c] = i < total ? (cw[i >>> 3] >>> (7 - (i & 7))) & 1 : 0;
        i++;
      }
    }
  }
}

function drawFormat(n, m, mask) {
  const f = formatBits(mask), bit = (i) => (f >>> i) & 1;
  // Coordinates follow the spec: first copy around the top-left finder, second split TR/BL.
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
  m[n - 8][8] = 1;
}

function penalty(n, m) {
  let p = 0;
  const line = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
      }
      // Finder-like 1:1:3:1:1 with 4 light on either side.
      for (let b = 0; b + 10 < n; b++) {
        const s = []; for (let k = 0; k < 11; k++) s.push(get(a, b + k));
        const t = s.join('');
        if (t === '10111010000' || t === '00001011101') p += 40;
      }
    }
  };
  line((r, c) => m[r][c]); line((c, r) => m[r][c]);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const x = m[r][c];
    if (x === m[r][c + 1] && x === m[r + 1][c] && x === m[r + 1][c + 1]) p += 3;
  }
  let dark = 0; for (const row of m) for (const x of row) dark += x;
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/** Encode text (UTF-8) into a QR matrix: array of rows of 0/1. */
function encode(text, { mask: forceMask } = {}) {
  const bytes = [...Buffer.from(String(text), 'utf8')];
  let v = 1;
  while (v <= 10 && dataCapacity(v) * 8 < 4 + (v < 10 ? 8 : 16) + bytes.length * 8) v++;
  if (v > 10) throw new RangeError('QR: text too long for version 10-M');
  const cw = encodeData(bytes, v);
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== undefined && mask !== forceMask) continue;
    const { n, m, fn } = baseMatrix(v);
    placeData(n, m, fn, cw);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!fn[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
    drawFormat(n, m, mask);
    const p = penalty(n, m);
    if (p < bestP) { bestP = p; best = m; best.version = v; best.mask = mask; }
  }
  return best;
}

/** Encode text into a compact SVG string (single path, 4-module quiet zone). */
function svg(text, { size, label = '', mask } = {}) {
  const m = encode(text, { mask }), n = m.length, q = 4, w = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      let e = c; while (e + 1 < n && m[r][e + 1]) e++;
      d += `M${c + q} ${r + q}h${e - c + 1}v1H${c + q}z`;
      c = e;
    }
  }
  const dim = size ? ` width="${size}" height="${size}"` : '';
  const aria = label ? ` role="img" aria-label="${String(label).replace(/[&<>"]/g, '')}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}"${dim}${aria} shape-rendering="crispEdges" style="background:#fff"><path d="${d}"/></svg>`;
}

module.exports = { encode, svg };
