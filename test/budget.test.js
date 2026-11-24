'use strict';
// Page-size budget (SRS NFR-1): every page type must be ≤ 15 KB gzipped.
// Pages are filled with realistic data (several queues, menu items, orders).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const server = require('../src/server');
const BUDGET = 15 * 1024;
let base, jar = '';

const req = async (path, form, { cookie = false, headers = {} } = {}) => {
  const r = await fetch(base + path, {
    method: form ? 'POST' : 'GET', redirect: 'manual',
    headers: { ...(form && { 'Content-Type': 'application/x-www-form-urlencoded' }), ...(cookie && { Cookie: jar }), ...headers },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const c = r.headers.get('set-cookie'); if (c) jar = c.split(';')[0];
  return { status: r.status, loc: r.headers.get('location'), text: await r.text() };
};
// fetch() ignores a custom Host header, so use node:http for the poster checks.
const rawGet = (path, headers) => new Promise((ok, fail) => {
  require('node:http').get(base + path, { headers }, (res) => {
    let d = ''; res.setEncoding('utf8'); res.on('data', (c) => { d += c; }); res.on('end', () => ok({ status: res.statusCode, text: d }));
  }).on('error', fail);
});
const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 9 }).length;

before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());

test('every page type is within 15 KB gzipped', async () => {
  await req('/register', { name: 'مخبز العائلات الكبير', area: 'دير البلح - السوق', username: 'budget1', password: 'secret12' });
  for (const n of ['خبز', 'مياه', 'حلاقة', 'غاز']) await req('/dash/queue', { name: n, avg: '2' }, { cookie: true });
  await req('/dash/settings', { orders: '1' }, { cookie: true });
  for (let i = 0; i < 15; i++) await req('/dash/menu', { name: `صنف رقم ${i} مع وصف`, price: `${i + 1} شيكل` }, { cookie: true });
  const dash0 = (await req('/dash', null, { cookie: true })).text;
  const code = dash0.match(/\/s\/([a-z0-9]+)\/screen/)[1];
  const qid = (await req('/s/' + code)).text.match(/name="queue_id" value="(\d+)"/)[1];
  let ticket;
  for (let i = 0; i < 12; i++) ticket = (await req(`/s/${code}/join`, { queue_id: qid, name: 'زبون ' + i, phone: '05991000' + String(i).padStart(2, '0') })).loc;
  const form = (await req(`/s/${code}/order`)).text;
  const items = [...form.matchAll(/name="(qty_\d+)"/g)].map((x) => x[1]);
  let order;
  for (let i = 0; i < 10; i++) order = (await req(`/s/${code}/order`, { [items[i]]: '2', [items[i + 1]]: '1', note: 'بدون سكر لو سمحت', name: 'سارة ' + i, phone: '0599222333', pickup: 'خلال 15 دقيقة' })).loc;

  const pages = {
    home: '/', login: '/login', register: '/register', store: `/s/${code}`, ticket, order,
    orderForm: `/s/${code}/order`, screen: `/s/${code}/screen`, poster: `/s/${code}/poster`, notFound: '/nope', dash: '/dash',
  };
  for (const [name, path] of Object.entries(pages)) {
    const r = await req(path, null, { cookie: name === 'dash' });
    assert.ok(r.status === 200 || (name === 'notFound' && r.status === 404), `${name} status ${r.status}`);
    const size = gz(r.text);
    assert.ok(size <= BUDGET, `${name} is ${size} bytes gzipped (budget ${BUDGET})`);
  }
});

test('poster: QR, code, steps, paper-number note, URL from Host + x-forwarded-proto', async () => {
  const dash = (await req('/dash', null, { cookie: true })).text;
  const code = dash.match(/\/s\/([a-z0-9]+)\/screen/)[1];
  assert.match(dash, new RegExp(`href="/s/${code}/poster"`), 'dashboard links to the poster');
  const r = await rawGet(`/s/${code}/poster`, { Host: 'dor.example.org', 'X-Forwarded-Proto': 'https' });
  assert.equal(r.status, 200);
  assert.match(r.text, /<svg class="qr"[^>]*role="img"/);
  assert.match(r.text, new RegExp(`https://dor.example.org/s/${code}`));
  assert.match(r.text, /<ol><li>/);
  assert.match(r.text, /رقماً ورقياً/);
  assert.match(r.text, /@media print/);
  const evil = await rawGet(`/s/${code}/poster`, { Host: 'x"><script>' });
  assert.doesNotMatch(evil.text, /<script>/);
});

test('accessibility basics on form pages', async () => {
  for (const path of ['/', '/register', '/login']) {
    const html = (await req(path)).text;
    assert.match(html, /<html lang="ar" dir="rtl">/);
    const ids = [...html.matchAll(/<(?:input|select|textarea)(?![^>]*type="hidden")[^>]*\sid="([^"]+)"/g)].map((x) => x[1]);
    const fields = [...html.matchAll(/<(?:input|select|textarea)(?![^>]*type="hidden")[^>]*>/g)];
    assert.equal(ids.length, fields.length, `${path}: every field has an id`);
    for (const id of ids) assert.match(html, new RegExp(`<label for="${id}"`), `${path}: label for #${id}`);
  }
});
