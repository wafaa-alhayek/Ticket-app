'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const server = require('../src/server');
let base, jar = '';

const req = async (path, form, useJar = false) => {
  const r = await fetch(base + path, {
    method: form ? 'POST' : 'GET', redirect: 'manual',
    headers: { ...(form && { 'Content-Type': 'application/x-www-form-urlencoded' }), ...(useJar && { Cookie: jar }) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const c = r.headers.get('set-cookie'); if (c) jar = c.split(';')[0];
  return { status: r.status, loc: r.headers.get('location'), text: await r.text() };
};

before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());

test('store registers, client takes ticket, store calls it, pre-order works', async () => {
  let r = await req('/register', { name: 'مخبز العائلات', area: 'دير البلح', username: 'bakery1', password: 'secret12' });
  assert.equal(r.loc, '/dash');
  r = await req('/dash/queue', { name: 'خبز', avg: '2' }, true);
  r = await req('/dash', null, true);
  const code = r.text.match(/\/s\/([a-z0-9]+)\/screen/)[1];
  const qid = (await req('/s/' + code)).text.match(/name="queue_id" value="(\d+)"/)[1];

  const t1 = await req(`/s/${code}/join`, { queue_id: qid, name: 'أحمد', phone: '0599111111' });
  const t2 = await req(`/s/${code}/join`, { queue_id: qid, phone: '0599222222' });
  const dup = await req(`/s/${code}/join`, { queue_id: qid, phone: '0599111111' });
  assert.equal(dup.loc, t1.loc, 'same phone gets the same ticket');
  assert.match((await req(t2.loc)).text, /أمامك<\/td><td><b>1<\/b>/);

  await req(`/dash/queue/${qid}/next`, {}, true);
  assert.match((await req(t1.loc)).text, /حان دورك/);
  assert.match((await req(t2.loc)).text, /أمامك<\/td><td><b>0<\/b>/);
  r = await req(`/dash/queue/${qid}/walkin`, {}, true);
  assert.match(r.text, /رقم 3/);

  await req('/dash/settings', { orders: '1' }, true);
  await req('/dash/menu', { name: 'قهوة', price: '5' }, true);
  const form = (await req(`/s/${code}/order`)).text;
  const item = form.match(/name="(qty_\d+)"/)[1];
  r = await req(`/s/${code}/order`, { [item]: '2', name: 'سارة', pickup: 'خلال 15 دقيقة' });
  assert.match((await req(r.loc)).text, /قهوة × 2/);
  const oid = (await req('/dash', null, true)).text.match(/\/dash\/order\/(\d+)/)[1];
  await req(`/dash/order/${oid}`, { status: 'ready' }, true);
  assert.match((await req(r.loc)).text, /جاهز للاستلام/);
  assert.match((await req(`/s/${code}/screen`)).text, /طلبات جاهزة/);
});

test('dashboard requires login', async () => {
  const r = await req('/dash');
  assert.equal(r.loc, '/login');
});
