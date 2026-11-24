'use strict';
// JSON API v1 (see docs/API.md). Bearer-token auth for operators, no cookies.
const zlib = require('node:zlib');
const core = require('./core');
const { db } = core;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MSG = {
  bad_json: 'تعذّرت قراءة الطلب. جرّب مرة ثانية.',
  invalid_input: 'بعض البيانات ناقصة. راجعها وجرّب مرة ثانية.',
  queue_closed: 'الحجز في هذا الطابور مغلق الآن. جرّب لاحقاً.',
  orders_disabled: 'هذا المحل لا يستقبل طلبات مسبقة الآن.',
  username_taken: 'اسم المستخدم محجوز. اختر اسماً آخر.',
  unauthorized: 'سجّل الدخول للمتابعة.',
  bad_credentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  not_found: 'لم نجد ما تبحث عنه. تأكد من الرابط أو الرمز.',
  not_cancellable: 'لا يمكن إلغاء هذا الدور الآن.',
  rate_limited: 'طلبات كثيرة من هذا الجهاز. انتظر دقيقة وجرّب مرة ثانية.',
  server_error: 'تعذّر إكمال طلبك. جرّب مرة ثانية.',
};
const STATUS = { bad_json: 400, invalid_input: 400, queue_closed: 400, orders_disabled: 400, username_taken: 400,
  unauthorized: 401, bad_credentials: 401, not_found: 404, not_cancellable: 409, rate_limited: 429, server_error: 500 };

class ApiError extends Error {
  constructor(code, message_ar) { super(code); this.code = code; this.message_ar = message_ar || MSG[code]; }
}
const fail = (code, msg) => { throw new ApiError(code, msg); };

function json(req, res, status, obj) {
  let body = Buffer.from(JSON.stringify(obj));
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...CORS };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 600) {
    body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip';
  }
  h['Content-Length'] = body.length;
  res.writeHead(status, h); res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { data += c; if (data.length > 1e5) { reject(new ApiError('invalid_input', 'الطلب طويل جداً. اختصره وجرّب مرة ثانية.')); req.destroy(); } });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        const v = JSON.parse(data);
        if (v && typeof v === 'object' && !Array.isArray(v)) resolve(v); else reject(new ApiError('bad_json'));
      } catch { reject(new ApiError('bad_json')); }
    });
    req.on('error', reject);
  });
}

// ---------- views ----------
const queueView = (q) => {
  const waiting = core.waitingCount(q);
  return { id: q.id, name: q.name, is_open: !!q.is_open, current_number: q.current_number, waiting,
    avg_minutes: round(q.avg_minutes), est_wait_minutes: round(waiting * q.avg_minutes) };
};
const round = (n) => Math.round(n * 10) / 10;
const dashQueueView = (q) => {
  const s = core.serving(q);
  return { ...queueView(q), serving: s ? { number: s.number, name: s.name } : null, next: core.nextWaiting(q) };
};
const storeRef = (s) => ({ code: s.code, name: s.name });
const operatorStore = (s) => ({ id: s.id, code: s.code, name: s.name, area: s.area, username: s.username, orders_enabled: !!s.orders_enabled });
const menuView = (m) => ({ id: m.id, name: m.name, price: m.price, available: !!m.available });

function ticketView(t) {
  const q = db.prepare('SELECT * FROM queues WHERE id = ?').get(t.queue_id);
  const s = core.storeById(q.store_id);
  const ahead = t.status === 'waiting' ? core.waitingAhead(q, t.number) : 0;
  return { token: t.token, number: t.number, status: t.status, status_ar: core.STATUS_AR[t.status], name: t.name,
    created_at: t.created_at, called_at: t.called_at ?? null, store: storeRef(s),
    queue: { id: q.id, name: q.name, current_number: q.current_number, is_open: !!q.is_open },
    ahead, est_wait_minutes: round(ahead * q.avg_minutes), near: t.status === 'waiting' && ahead <= 3 };
}
function orderView(o, operator = false) {
  const v = { token: o.token, number: o.number, status: o.status, status_ar: core.ORDER_AR[o.status], name: o.name,
    items: JSON.parse(o.items), note: o.note, pickup: o.pickup, created_at: o.created_at };
  if (operator) return { id: o.id, ...v, phone: o.phone };
  return { ...v, store: storeRef(core.storeById(o.store_id)) };
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, fn, auth = false) =>
  routes.push({ method, re: new RegExp('^/api/v1' + pattern.replace(/:(\w+)/g, '(?<$1>[\\w.-]+)') + '$'), fn, auth });

const needStore = (code) => core.storeByCode(code) || fail('not_found');
const needQueue = (store, id) => core.queueOf(store.id, id) || fail('not_found');
const limit = (ctx, bucket) => core.isLimited(ctx.ip, bucket) && fail('rate_limited');

// Public
route('GET', '/stores/:code', ({ params }) => {
  const s = needStore(params.code);
  return [200, { code: s.code, name: s.name, area: s.area, orders_enabled: !!s.orders_enabled, queues: core.queuesOf(s.id).map(queueView) }];
});
route('POST', '/stores/:code/join', (ctx) => {
  const s = needStore(ctx.params.code);
  limit(ctx, 'join');
  const b = ctx.body;
  const r = core.joinQueue(s, b.queue_id, b.name, b.phone == null ? '' : String(b.phone));
  if (r.error) fail(r.error);
  return [r.existing ? 200 : 201, { ticket: ticketView(core.ticketByToken(r.token)), existing: r.existing }];
});
route('GET', '/tickets/:token', ({ params }) => [200, { ticket: ticketView(core.ticketByToken(params.token) || fail('not_found')) }]);
route('POST', '/tickets/:token/cancel', ({ params }) => {
  const t = core.ticketByToken(params.token) || fail('not_found');
  if (!core.cancelTicket(t)) fail('not_cancellable');
  return [200, { ticket: ticketView(core.ticketByToken(t.token)) }];
});
route('GET', '/stores/:code/menu', ({ params }) => {
  const s = needStore(params.code);
  if (!s.orders_enabled) fail('orders_disabled');
  return [200, { orders_enabled: true, items: core.menuOf(s.id, true).map(menuView) }];
});
route('POST', '/stores/:code/orders', (ctx) => {
  const s = needStore(ctx.params.code);
  if (!s.orders_enabled) fail('orders_disabled');
  limit(ctx, 'order');
  const b = ctx.body;
  const qty = new Map();
  for (const it of Array.isArray(b.items) ? b.items : []) if (it && it.id != null) qty.set(Number(it.id), (qty.get(Number(it.id)) || 0) + (parseInt(it.qty, 10) || 0));
  const r = core.placeOrder(s, { qtyOf: (i) => qty.get(i.id) || 0, note: b.note, name: b.name, phone: b.phone, pickup: b.pickup });
  if (r.error) fail('invalid_input', 'اكتب اسمك واختر صنفاً واحداً على الأقل.');
  return [201, { order: orderView(core.orderByToken(r.token)) }];
});
route('GET', '/orders/:token', ({ params }) => [200, { order: orderView(core.orderByToken(params.token) || fail('not_found')) }]);

// Operator auth
const session = (store) => { const s = core.createSession(store); return { token: s.token, expires_at: s.expires_at, store: operatorStore(store) }; };
route('POST', '/operator/register', (ctx) => {
  limit(ctx, 'auth');
  const r = core.registerStore(ctx.body);
  if (r.error) fail(r.error, r.message_ar);
  return [201, session(r.store)];
});
route('POST', '/operator/login', (ctx) => {
  limit(ctx, 'auth');
  const store = core.loginStore(ctx.body.username, ctx.body.password) || fail('bad_credentials');
  return [200, session(store)];
});
route('POST', '/operator/logout', ({ token }) => { core.deleteSession(token); return [200, { ok: true }]; }, true);

// Operator dashboard
route('GET', '/operator/me', ({ store }) => [200, {
  store: operatorStore(store), queues: core.queuesOf(store.id).map(dashQueueView),
  orders: core.activeOrders(store.id).map((o) => orderView(o, true)), menu: core.menuOf(store.id).map(menuView),
}], true);
route('POST', '/operator/queues', ({ store, body }) => {
  const id = core.createQueue(store, body.name, body.avg_minutes) || fail('invalid_input', 'اكتب اسم الطابور.');
  return [201, { queue: dashQueueView(core.queueOf(store.id, id)) }];
}, true);
route('POST', '/operator/queues/:id/:op', ({ store, params }) => {
  const q = needQueue(store, params.id);
  const fresh = () => dashQueueView(core.queueOf(store.id, q.id));
  const called = (t) => (t ? { number: t.number, name: t.name } : null);
  switch (params.op) {
    case 'next': { const t = core.callNext(q); return [200, { queue: fresh(), called: called(t) }]; }
    case 'skip': { const t = core.skipCurrent(q); return [200, { queue: fresh(), called: called(t) }]; }
    case 'walkin': { const t = core.issueTicket(q); return [201, { queue: fresh(), ticket: t }]; }
    case 'toggle': core.toggleQueue(q); return [200, { queue: fresh() }];
    case 'reset': core.resetQueue(q); return [200, { queue: fresh() }];
  }
  fail('not_found');
}, true);
route('GET', '/operator/orders', ({ store, url }) => {
  const rows = url.searchParams.get('all') === '1'
    ? db.prepare('SELECT * FROM orders WHERE store_id = ? ORDER BY id DESC LIMIT 200').all(store.id)
    : core.activeOrders(store.id);
  return [200, { orders: rows.map((o) => orderView(o, true)) }];
}, true);
route('POST', '/operator/orders/:id/status', ({ store, params, body }) => {
  if (!core.ORDER_STATUSES.includes(body.status)) fail('invalid_input', 'اختر حالة من القائمة.');
  if (!core.setOrderStatus(store, params.id, body.status)) fail('not_found');
  return [200, { order: orderView(db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(params.id)), true) }];
}, true);
route('POST', '/operator/menu', ({ store, body }) => {
  const id = core.addMenuItem(store, body.name, body.price == null ? '' : String(body.price)) || fail('invalid_input', 'اكتب اسم الصنف.');
  return [201, { item: menuView(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id)) }];
}, true);
route('POST', '/operator/menu/:id/toggle', ({ store, params }) => {
  if (!core.toggleMenuItem(store, params.id)) fail('not_found');
  return [200, { item: menuView(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(params.id))) }];
}, true);
route('POST', '/operator/menu/:id/delete', ({ store, params }) => {
  if (!core.deleteMenuItem(store, params.id)) fail('not_found');
  return [200, { ok: true }];
}, true);
route('POST', '/operator/settings', ({ store, body }) => {
  if (typeof body.orders_enabled !== 'boolean') fail('invalid_input', 'اختر: تفعيل أو إيقاف الطلب المسبق (true أو false).');
  core.setOrdersEnabled(store, body.orders_enabled);
  return [200, { store: operatorStore(core.storeById(store.id)) }];
}, true);

async function handle(req, res, p, url, ip) {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    let match, r;
    for (r of routes) if (r.method === req.method && (match = p.match(r.re))) break;
    if (!match) fail('not_found');
    const ctx = { req, url, ip, params: match.groups || {}, body: {} };
    if (r.auth) {
      const h = req.headers.authorization || '';
      ctx.token = /^Bearer\s+(\S+)$/i.exec(h)?.[1];
      ctx.store = core.storeBySession(ctx.token) || fail('unauthorized');
    }
    if (req.method === 'POST') ctx.body = await readJson(req);
    const [status, obj] = r.fn(ctx);
    return json(req, res, status, obj);
  } catch (e) {
    if (e instanceof ApiError) return json(req, res, STATUS[e.code], { error: { code: e.code, message_ar: e.message_ar } });
    console.error(e);
    return json(req, res, 500, { error: { code: 'server_error', message_ar: MSG.server_error } });
  }
}

module.exports = { handle };
