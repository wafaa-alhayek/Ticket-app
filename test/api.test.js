'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const server = require('../src/server');
const core = require('../src/core');
let base;

const api = async (method, path, body, token) => {
  const r = await fetch(base + '/api/v1' + path, {
    method,
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Authorization: 'Bearer ' + token }) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, headers: r.headers, json: text ? JSON.parse(text) : null };
};

before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());

test('full API flow: register, queues, join, call, orders, menu', async () => {
  let r = await api('POST', '/operator/register', { name: 'مخبز', area: 'غزة', username: 'apibakery', password: 'secret12' });
  assert.equal(r.status, 201);
  const reg = r.json.store;
  r = await api('POST', '/operator/login', { username: 'apibakery', password: 'secret12' });
  assert.equal(r.status, 200);
  const tok = r.json.token;
  assert.ok(r.json.expires_at > Date.now());

  r = await api('POST', '/operator/queues', { name: 'خبز', avg_minutes: 2 }, tok);
  assert.equal(r.status, 201);
  const qid = r.json.queue.id;

  r = await api('GET', '/stores/' + reg.code.toUpperCase());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.json.queues[0].waiting, 0);
  assert.equal(r.json.orders_enabled, false);

  const j1 = await api('POST', `/stores/${reg.code}/join`, { queue_id: qid, name: 'أحمد', phone: '0599111111' });
  assert.equal(j1.status, 201);
  assert.equal(j1.json.ticket.number, 1);
  assert.equal(j1.json.ticket.phone, undefined, 'phone never public');
  const j2 = await api('POST', `/stores/${reg.code}/join`, { queue_id: qid, phone: '0599222222' });
  const dup = await api('POST', `/stores/${reg.code}/join`, { queue_id: qid, phone: '0599-111-111' });
  assert.equal(dup.status, 200);
  assert.equal(dup.json.existing, true);
  assert.equal(dup.json.ticket.token, j1.json.ticket.token);

  r = await api('GET', '/tickets/' + j2.json.ticket.token);
  assert.equal(r.json.ticket.ahead, 1);
  assert.equal(r.json.ticket.est_wait_minutes, 2);
  assert.equal(r.json.ticket.near, true);

  r = await api('POST', `/operator/queues/${qid}/next`, undefined, tok);
  assert.deepEqual(r.json.called, { number: 1, name: 'أحمد' });
  assert.equal(r.json.queue.serving.number, 1);
  assert.equal((await api('GET', '/tickets/' + j1.json.ticket.token)).json.ticket.status, 'called');
  assert.equal((await api('GET', '/tickets/' + j2.json.ticket.token)).json.ticket.ahead, 0);

  r = await api('POST', `/operator/queues/${qid}/walkin`, undefined, tok);
  assert.equal(r.status, 201);
  assert.equal(r.json.ticket.number, 3);

  r = await api('POST', `/operator/queues/${qid}/skip`, undefined, tok);
  assert.equal(r.json.called.number, 2);
  assert.equal((await api('GET', '/tickets/' + j1.json.ticket.token)).json.ticket.status, 'skipped');
  assert.equal((await api('GET', '/tickets/' + j2.json.ticket.token)).json.ticket.status, 'called');

  // cancel: only waiting tickets
  r = await api('POST', `/tickets/${j2.json.ticket.token}/cancel`);
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, 'not_cancellable');
  const j4 = await api('POST', `/stores/${reg.code}/join`, { queue_id: qid });
  r = await api('POST', `/tickets/${j4.json.ticket.token}/cancel`);
  assert.equal(r.json.ticket.status, 'cancelled');

  // toggle closes booking
  r = await api('POST', `/operator/queues/${qid}/toggle`, undefined, tok);
  assert.equal(r.json.queue.is_open, false);
  r = await api('POST', `/stores/${reg.code}/join`, { queue_id: qid });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'queue_closed');
  assert.ok(r.json.error.message_ar);
  await api('POST', `/operator/queues/${qid}/toggle`, undefined, tok);

  // orders
  r = await api('GET', `/stores/${reg.code}/menu`);
  assert.equal(r.json.error.code, 'orders_disabled');
  r = await api('POST', '/operator/settings', { orders_enabled: true }, tok);
  assert.equal(r.json.store.orders_enabled, true);
  r = await api('POST', '/operator/menu', { name: 'قهوة', price: '5' }, tok);
  assert.equal(r.status, 201);
  const item = r.json.item;
  const tea = (await api('POST', '/operator/menu', { name: 'شاي' }, tok)).json.item;
  r = await api('POST', `/operator/menu/${tea.id}/toggle`, undefined, tok);
  assert.equal(r.json.item.available, false);
  r = await api('GET', `/stores/${reg.code}/menu`);
  assert.deepEqual(r.json.items.map((i) => i.name), ['قهوة']);

  r = await api('POST', `/stores/${reg.code}/orders`, { items: [{ id: item.id, qty: 2 }], name: '' });
  assert.equal(r.json.error.code, 'invalid_input');
  r = await api('POST', `/stores/${reg.code}/orders`, { items: [{ id: item.id, qty: 2 }, { id: tea.id, qty: 1 }], name: 'سارة', pickup: 'خلال 15 دقيقة' });
  assert.equal(r.status, 201);
  const order = r.json.order;
  assert.deepEqual(order.items, [{ name: 'قهوة', qty: 2 }]);

  r = await api('GET', '/operator/orders', undefined, tok);
  assert.equal(r.json.orders.length, 1);
  const oid = r.json.orders[0].id;
  r = await api('POST', `/operator/orders/${oid}/status`, { status: 'bogus' }, tok);
  assert.equal(r.status, 400);
  r = await api('POST', `/operator/orders/${oid}/status`, { status: 'ready' }, tok);
  assert.equal(r.json.order.status, 'ready');
  assert.equal((await api('GET', '/orders/' + order.token)).json.order.status, 'ready');

  r = await api('GET', '/operator/me', undefined, tok);
  assert.equal(r.json.store.code, reg.code);
  assert.equal(r.json.queues.length, 1);
  assert.equal(r.json.orders.length, 1);
  assert.equal(r.json.menu.length, 2);

  r = await api('POST', `/operator/menu/${tea.id}/delete`, undefined, tok);
  assert.equal(r.json.ok, true);
  r = await api('POST', `/operator/menu/${tea.id}/delete`, undefined, tok);
  assert.equal(r.status, 404);

  // reset
  r = await api('POST', `/operator/queues/${qid}/reset`, undefined, tok);
  assert.equal(r.json.queue.current_number, 0);
  assert.equal(r.json.queue.waiting, 0);
  r = await api('POST', `/stores/${reg.code}/join`, { queue_id: qid });
  assert.equal(r.json.ticket.number, 1);

  // logout invalidates token
  r = await api('POST', '/operator/logout', undefined, tok);
  assert.equal(r.json.ok, true);
  r = await api('GET', '/operator/me', undefined, tok);
  assert.equal(r.status, 401);
});

test('auth and error handling', async () => {
  let r = await api('GET', '/operator/me');
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, 'unauthorized');
  r = await api('POST', '/operator/login', { username: 'nobody', password: 'x' });
  assert.equal(r.json.error.code, 'bad_credentials');
  r = await api('POST', '/operator/register', { name: 'x', username: 'ab', password: 'secret12' });
  assert.equal(r.json.error.code, 'invalid_input');
  r = await api('POST', '/operator/login', '{nope');
  assert.equal(r.json.error.code, 'bad_json');
  r = await api('GET', '/stores/zzzz');
  assert.equal(r.status, 404);
  r = await api('GET', '/tickets/nope');
  assert.equal(r.json.error.code, 'not_found');
  r = await api('GET', '/nothing-here');
  assert.equal(r.status, 404);
  const pre = await fetch(base + '/api/v1/operator/me', { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);

  // operator cannot touch another store's queue
  const a = (await api('POST', '/operator/register', { name: 'A', username: 'storea', password: 'secret12' })).json.token;
  const b = (await api('POST', '/operator/register', { name: 'B', username: 'storeb', password: 'secret12' })).json.token;
  const qa = (await api('POST', '/operator/queues', { name: 'مياه' }, a)).json.queue.id;
  r = await api('POST', `/operator/queues/${qa}/next`, undefined, b);
  assert.equal(r.status, 404);
});

test('purge removes closed tickets/orders older than 7 days', () => {
  const { db } = core;
  const old = Date.now() - 8 * 864e5;
  const store = core.registerStore({ name: 'P', username: 'purgestore', password: 'secret12' }).store;
  const qid = core.createQueue(store, 'q', 3);
  const ins = db.prepare('INSERT INTO tickets (queue_id, number, token, status, created_at) VALUES (?,?,?,?,?)');
  ins.run(qid, 1, 'p-old-done', 'done', old);
  ins.run(qid, 2, 'p-old-wait', 'waiting', old);
  ins.run(qid, 3, 'p-new-done', 'done', Date.now());
  const ord = db.prepare(`INSERT INTO orders (store_id, number, token, name, items, status, created_at) VALUES (?,?,?,?,'[]',?,?)`);
  ord.run(store.id, 1, 'po-old', 'x', 'picked', old);
  ord.run(store.id, 2, 'po-old-ready', 'x', 'ready', old);
  core.purgeOld();
  assert.equal(core.ticketByToken('p-old-done'), null);
  assert.ok(core.ticketByToken('p-old-wait'));
  assert.ok(core.ticketByToken('p-new-done'));
  assert.equal(core.orderByToken('po-old'), null);
  assert.ok(core.orderByToken('po-old-ready'));
});
