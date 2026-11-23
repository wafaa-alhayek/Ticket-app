'use strict';
// "دور" (Dor) — queue tickets & pickup orders. Zero dependencies, Node >= 22.5.
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const db = require('./db');
const { esc, page, action, mins } = require('./html');

const PORT = Number(process.env.PORT || 3000);
const now = () => Date.now();
const rand = (n = 16) => crypto.randomBytes(n).toString('base64url');
const SESSION_DAYS = 30;

// ---------- passwords ----------
function hashPass(p) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(p, salt, 32).toString('hex');
}
function checkPass(p, stored) {
  const [salt, hash] = stored.split(':');
  const h = crypto.scryptSync(p, Buffer.from(salt, 'hex'), 32);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}

// ---------- tiny rate limiter (per IP, per bucket) ----------
const hits = new Map();
function limited(ip, bucket, max, windowMs) {
  const key = bucket + ip, t = now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();

// ---------- request helpers ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
    req.on('error', reject);
  });
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]));
}
function send(req, res, status, html, headers = {}) {
  let body = Buffer.from(html);
  const h = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'", ...headers };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 600) {
    body = zlib.gzipSync(body, { level: 9 }); h['Content-Encoding'] = 'gzip';
  }
  h['Content-Length'] = body.length;
  res.writeHead(status, h); res.end(body);
}
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };
const clip = (s, n) => String(s || '').trim().slice(0, n);

function currentStore(req) {
  const t = cookies(req).sid;
  if (!t) return null;
  return db.prepare(`SELECT s.* FROM sessions x JOIN stores s ON s.id = x.store_id
    WHERE x.token = ? AND x.expires_at > ?`).get(t, now()) || null;
}

// ---------- queue logic ----------
const waitingAhead = (q, number) => db.prepare(
  `SELECT COUNT(*) c FROM tickets WHERE queue_id = ? AND status = 'waiting' AND number < ?`).get(q.id, number).c;
const waitingCount = (q) => db.prepare(
  `SELECT COUNT(*) c FROM tickets WHERE queue_id = ? AND status = 'waiting'`).get(q.id).c;

function issueTicket(q, name = '', phone = '') {
  const number = q.last_number + 1;
  db.prepare('UPDATE queues SET last_number = ? WHERE id = ?').run(number, q.id);
  const token = rand(12);
  db.prepare(`INSERT INTO tickets (queue_id, number, token, name, phone, created_at) VALUES (?,?,?,?,?,?)`)
    .run(q.id, number, token, name, phone, now());
  return { number, token };
}

function callNext(q) {
  // Close out whoever was being served, then call the next waiting ticket.
  db.prepare(`UPDATE tickets SET status = 'done' WHERE queue_id = ? AND status = 'called'`).run(q.id);
  const next = db.prepare(`SELECT * FROM tickets WHERE queue_id = ? AND status = 'waiting' ORDER BY number LIMIT 1`).get(q.id);
  if (!next) return null;
  const t = now();
  // Learn the real service time (moving average), ignoring long pauses/breaks.
  let avg = q.avg_minutes;
  if (q.last_called_at) {
    const gap = (t - q.last_called_at) / 60000;
    if (gap > 0.05 && gap < 60) avg = avg * 0.8 + gap * 0.2;
  }
  db.prepare(`UPDATE tickets SET status = 'called', called_at = ? WHERE id = ?`).run(t, next.id);
  db.prepare(`UPDATE queues SET current_number = ?, last_called_at = ?, avg_minutes = ? WHERE id = ?`)
    .run(next.number, t, avg, q.id);
  return next;
}

const STATUS_AR = { waiting: 'في الانتظار', called: 'حان دورك!', done: 'تمّت الخدمة', skipped: 'فاتك الدور', cancelled: 'أُلغيت' };
const ORDER_AR = { new: 'تم الاستلام', preparing: 'قيد التحضير', ready: 'جاهز للاستلام ✅', picked: 'تم الاستلام من المحل', cancelled: 'أُلغي' };

// ---------- pages ----------
function homePage(err = '') {
  return page('الرئيسية', `
<h1>دور — بدون طوابير</h1>
<p>احجز دورك في طابور الخبز، تعبئة المياه، الحلاق، أو اطلب طلبك مسبقاً واستلمه جاهزاً.</p>
${err ? `<div class="notice">${esc(err)}</div>` : ''}
<div class="card"><form method="get" action="/find">
<label for="c">رمز المحل أو النقطة</label>
<input id="c" name="code" required maxlength="12" autocomplete="off" inputmode="latin" placeholder="مثال: ab12">
<button class="big">ادخل</button></form></div>
<div class="card"><h2>أصحاب المحلات والنقاط</h2>
<p class="muted">مخبز، نقطة مياه، صالون، مطعم، مقهى، أو أي نقطة توزيع.</p>
<div class="row"><a class="btn" href="/login">دخول</a><a class="btn btn2" href="/register">تسجيل محل جديد</a></div></div>
<p class="muted">الصفحات خفيفة جداً وتعمل على الإنترنت الضعيف. احفظ رابط تذكرتك لتعود إليه.</p>`);
}

function storePage(store, err = '') {
  const queues = db.prepare('SELECT * FROM queues WHERE store_id = ? ORDER BY id').all(store.id);
  const qs = queues.map((q) => {
    const w = waitingCount(q);
    return `<div class="card"><h2>${esc(q.name)} ${q.is_open ? '' : '<span class="bad">(مغلق)</span>'}</h2>
<div class="row"><span>الدور الحالي: <b>${q.current_number || '—'}</b></span> · <span>المنتظرون: <b>${w}</b></span> · <span>الانتظار المتوقع: <b>${mins(w * q.avg_minutes)}</b></span></div>
${q.is_open ? `<form method="post" action="/s/${esc(store.code)}/join"><input type="hidden" name="queue_id" value="${q.id}">
<label>الاسم (اختياري)</label><input name="name" maxlength="40">
<label>رقم الجوال (اختياري)</label><input name="phone" maxlength="20" inputmode="tel">
<button class="big">احجز دوري</button></form>` : ''}</div>`;
  }).join('') || '<p class="muted">لا توجد طوابير مفتوحة حالياً.</p>';
  return page(store.name, `<h1>${esc(store.name)}</h1><p class="muted">${esc(store.area)} · الرمز: <b>${esc(store.code)}</b></p>
${err ? `<div class="notice">${esc(err)}</div>` : ''}
${store.orders_enabled ? `<a class="btn big" href="/s/${esc(store.code)}/order">🛍️ اطلب مسبقاً واستلم جاهزاً</a>` : ''}
${qs}<p class="muted"><a href="/s/${esc(store.code)}">تحديث</a></p>`);
}

function ticketPage(t) {
  const q = db.prepare('SELECT q.*, s.name sname, s.code FROM queues q JOIN stores s ON s.id = q.store_id WHERE q.id = ?').get(t.queue_id);
  const ahead = t.status === 'waiting' ? waitingAhead(q, t.number) : 0;
  const active = t.status === 'waiting' || t.status === 'called';
  return page(`تذكرة ${t.number}`, `
<div class="card ${t.status === 'called' ? 'called' : ''}">
<p>${esc(q.sname)} — ${esc(q.name)}</p>
<p class="muted">رقمك</p><div class="num">${t.number}</div>
<h2 style="text-align:center">${STATUS_AR[t.status]}</h2>
${t.status === 'waiting' ? `<table>
<tr><td>الدور الحالي</td><td><b>${q.current_number || '—'}</b></td></tr>
<tr><td>أمامك</td><td><b>${ahead}</b> شخص</td></tr>
<tr><td>الانتظار المتوقع</td><td><b>${mins(ahead * q.avg_minutes)}</b></td></tr></table>
${ahead <= 3 ? '<div class="notice">اقترب دورك، توجّه إلى المكان الآن.</div>' : ''}` : ''}
${t.status === 'called' ? '<div class="notice">توجّه إلى الشباك فوراً.</div>' : ''}
</div>
${active ? `<p class="muted">الصفحة تتحدث تلقائياً كل 30 ثانية. احفظ هذا الرابط أو صوّر الشاشة.</p>
<div class="row"><a class="btn btn2" href="/t/${esc(t.token)}">تحديث الآن</a>
${t.status === 'waiting' ? action(`/t/${t.token}/cancel`, 'إلغاء دوري', 'warn') : ''}</div>` : `<a class="btn" href="/s/${esc(q.code)}">احجز دوراً جديداً</a>`}`,
  { refresh: active ? 30 : 0 });
}

function screenPage(store) {
  const queues = db.prepare('SELECT * FROM queues WHERE store_id = ? AND is_open = 1 ORDER BY id').all(store.id);
  const ready = store.orders_enabled
    ? db.prepare(`SELECT number FROM orders WHERE store_id = ? AND status = 'ready' ORDER BY id DESC LIMIT 12`).all(store.id) : [];
  return page('شاشة العرض', `<div class="screen"><h1>${esc(store.name)}</h1>
${queues.map((q) => `<h2>${esc(q.name)}</h2><div class="num">${q.current_number || '—'}</div>
<p>المنتظرون: ${waitingCount(q)} · احجز دورك بالرمز: <b>${esc(store.code)}</b></p>`).join('')}
${ready.length ? `<h2>طلبات جاهزة</h2><div class="num" style="font-size:4em">${ready.map((o) => o.number).join(' · ')}</div>` : ''}
</div>`, { refresh: 10, bare: true });
}

function orderFormPage(store, err = '') {
  const items = db.prepare('SELECT * FROM menu_items WHERE store_id = ? AND available = 1 ORDER BY id').all(store.id);
  return page('اطلب مسبقاً', `<h1>${esc(store.name)} — طلب مسبق</h1>
${err ? `<div class="notice">${esc(err)}</div>` : ''}
<form method="post" class="card" action="/s/${esc(store.code)}/order">
${items.length ? `<table><tr><th>الصنف</th><th>السعر</th><th>الكمية</th></tr>
${items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.price)}</td><td><input name="qty_${i.id}" type="number" min="0" max="50" value="0" inputmode="numeric" style="width:5em"></td></tr>`).join('')}</table>`
  : '<p class="muted">لا توجد قائمة، اكتب طلبك في الملاحظات.</p>'}
<label>ملاحظات / تفاصيل الطلب</label><textarea name="note" maxlength="300" rows="2"></textarea>
<label>الاسم</label><input name="name" required maxlength="40">
<label>رقم الجوال (اختياري)</label><input name="phone" maxlength="20" inputmode="tel">
<label>متى ستصل؟</label><select name="pickup"><option>في أقرب وقت</option><option>خلال 15 دقيقة</option><option>خلال 30 دقيقة</option><option>خلال ساعة</option></select>
<button class="big">أرسل الطلب</button></form>`);
}

function orderPage(o) {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(o.store_id);
  const items = JSON.parse(o.items);
  const active = ['new', 'preparing', 'ready'].includes(o.status);
  return page(`طلب ${o.number}`, `<div class="card ${o.status === 'ready' ? 'called' : ''}">
<p>${esc(store.name)}</p><p class="muted">رقم طلبك</p><div class="num">${o.number}</div>
<h2 style="text-align:center">${ORDER_AR[o.status]}</h2>
<ul>${items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join('')}</ul>
${o.note ? `<p>ملاحظات: ${esc(o.note)}</p>` : ''}<p class="muted">الوصول: ${esc(o.pickup)}</p></div>
${active ? '<p class="muted">تتحدث الصفحة تلقائياً كل 30 ثانية.</p>' : ''}
<a class="btn btn2" href="/o/${esc(o.token)}">تحديث</a>`, { refresh: active ? 30 : 0 });
}

function authPage(kind, err = '') {
  const reg = kind === 'register';
  return page(reg ? 'تسجيل محل' : 'دخول', `<h1>${reg ? 'تسجيل محل / نقطة جديدة' : 'دخول أصحاب المحلات'}</h1>
${err ? `<div class="notice">${esc(err)}</div>` : ''}
<form method="post" class="card" action="/${kind}">
${reg ? `<label>اسم المحل أو النقطة</label><input name="name" required maxlength="60" placeholder="مثال: مخبز العائلات">
<label>المنطقة</label><input name="area" maxlength="60" placeholder="مثال: دير البلح - السوق">` : ''}
<label>اسم المستخدم</label><input name="username" required maxlength="30" autocomplete="username" dir="ltr">
<label>كلمة المرور</label><input name="password" type="password" required minlength="${reg ? 6 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}" dir="ltr">
<button class="big">${reg ? 'تسجيل' : 'دخول'}</button></form>
<p>${reg ? '<a href="/login">لديك حساب؟ ادخل</a>' : '<a href="/register">تسجيل محل جديد</a>'}</p>`);
}

function dashPage(store, msg = '') {
  const queues = db.prepare('SELECT * FROM queues WHERE store_id = ? ORDER BY id').all(store.id);
  const orders = db.prepare(`SELECT * FROM orders WHERE store_id = ? AND status IN ('new','preparing','ready') ORDER BY id`).all(store.id);
  const menu = db.prepare('SELECT * FROM menu_items WHERE store_id = ? ORDER BY id').all(store.id);
  const qHtml = queues.map((q) => {
    const serving = db.prepare(`SELECT * FROM tickets WHERE queue_id = ? AND status = 'called' LIMIT 1`).get(q.id);
    const next = db.prepare(`SELECT number, name FROM tickets WHERE queue_id = ? AND status = 'waiting' ORDER BY number LIMIT 5`).all(q.id);
    const b = `/dash/queue/${q.id}`;
    return `<div class="card"><h2>${esc(q.name)} ${q.is_open ? '<span class="ok">مفتوح</span>' : '<span class="bad">مغلق</span>'}</h2>
<div class="num">${q.current_number || '—'}</div>
<p style="text-align:center">${serving?.name ? esc(serving.name) + ' · ' : ''}المنتظرون: <b>${waitingCount(q)}</b> · متوسط الخدمة: ${mins(q.avg_minutes)}</p>
${next.length ? `<p class="muted">التالي: ${next.map((t) => t.number + (t.name ? ` (${esc(t.name)})` : '')).join('، ')}</p>` : ''}
${action(b + '/next', '▶ نادِ التالي', 'big')}
<div class="row">${action(b + '/skip', 'تخطي الحالي (لم يحضر)', 'btn2')}
${action(b + '/walkin', '+ تذكرة لشخص بدون جوال', 'btn2')}
${action(b + '/toggle', q.is_open ? 'إغلاق الحجز' : 'فتح الحجز', 'btn2')}
${action(b + '/reset', 'تصفير الطابور (يوم جديد)', 'warn')}</div></div>`;
  }).join('');
  const oHtml = orders.map((o) => {
    const items = JSON.parse(o.items).map((i) => `${esc(i.name)}×${i.qty}`).join('، ');
    const b = `/dash/order/${o.id}`;
    return `<tr><td><b>${o.number}</b></td><td>${esc(o.name)}<br><span class="muted">${esc(o.phone)} · ${esc(o.pickup)}</span></td>
<td>${items}${o.note ? `<br><span class="muted">${esc(o.note)}</span>` : ''}</td><td>${ORDER_AR[o.status]}</td>
<td><div class="row">${o.status === 'new' ? action(b, 'تحضير', '', { status: 'preparing' }) : ''}
${o.status !== 'ready' ? action(b, 'جاهز', '', { status: 'ready' }) : action(b, 'تم التسليم', '', { status: 'picked' })}
${action(b, 'إلغاء', 'btn2', { status: 'cancelled' })}</div></td></tr>`;
  }).join('');
  return page('لوحة المحل', `<h1>${esc(store.name)}</h1>
${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
<div class="card"><p>رمز محلك للزبائن: <b style="font-size:1.4em">${esc(store.code)}</b></p>
<p class="muted">صفحة الحجز: <a href="/s/${esc(store.code)}" dir="ltr">/s/${esc(store.code)}</a> · شاشة العرض: <a href="/s/${esc(store.code)}/screen" dir="ltr">/s/${esc(store.code)}/screen</a></p>
<p><a class="btn btn2" href="/dash">تحديث</a></p></div>
${qHtml}
<form method="post" class="card" action="/dash/queue"><h2>إضافة طابور</h2>
<label>اسم الطابور</label><input name="name" required maxlength="40" placeholder="مثال: خبز، مياه، حلاقة">
<label>مدة خدمة الشخص تقريباً (دقائق)</label><input name="avg" type="number" min="0.2" max="120" step="0.1" value="3" inputmode="decimal">
<button>إضافة</button></form>
<div class="card"><h2>الطلبات المسبقة</h2>
${action('/dash/settings', store.orders_enabled ? 'إيقاف الطلب المسبق' : 'تفعيل الطلب المسبق', 'btn2', { orders: store.orders_enabled ? 0 : 1 })}
${store.orders_enabled ? (orders.length ? `<table><tr><th>#</th><th>الزبون</th><th>الطلب</th><th>الحالة</th><th></th></tr>${oHtml}</table>` : '<p class="muted">لا توجد طلبات حالياً.</p>') : ''}</div>
${store.orders_enabled ? `<div class="card"><h2>القائمة</h2><table>${menu.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.price)}</td>
<td><div class="row">${action(`/dash/menu/${m.id}/toggle`, m.available ? 'متوفر' : 'غير متوفر', 'btn2')}${action(`/dash/menu/${m.id}/delete`, 'حذف', 'warn')}</div></td></tr>`).join('')}</table>
<form method="post" action="/dash/menu"><label>صنف جديد</label><input name="name" required maxlength="50">
<label>السعر (اختياري)</label><input name="price" maxlength="20"><button>إضافة صنف</button></form></div>` : ''}
${action('/logout', 'تسجيل الخروج', 'btn2')}`, { nav: '<a href="/dash">اللوحة</a>' });
}

const notFound = (req, res) => send(req, res, 404, page('غير موجود', '<h1>الصفحة غير موجودة</h1><a class="btn" href="/">الرئيسية</a>'));

// ---------- router ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const ip = req.socket.remoteAddress || '';
  const post = req.method === 'POST';
  // Basic CSRF defence: cross-site POSTs are refused (cookie is also SameSite=Lax).
  const origin = req.headers.origin;
  let originHost = null;
  try { if (origin && origin !== 'null') originHost = new URL(origin).host; } catch {}
  if (post && originHost && req.headers.host && originHost !== req.headers.host) {
    return send(req, res, 403, page('مرفوض', '<p>طلب مرفوض.</p>'));
  }
  const body = post ? await readBody(req) : {};
  let m;

  if (p === '/' && !post) return send(req, res, 200, homePage());
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  if (p === '/find') {
    const code = clip(url.searchParams.get('code'), 12).toLowerCase();
    const s = db.prepare('SELECT code FROM stores WHERE code = ?').get(code);
    return s ? redirect(res, `/s/${s.code}`) : send(req, res, 404, homePage('لم نجد محلاً بهذا الرمز.'));
  }

  // ----- public store pages -----
  if ((m = p.match(/^\/s\/([a-z0-9]+)(\/[a-z]+)?$/))) {
    const store = db.prepare('SELECT * FROM stores WHERE code = ?').get(m[1]);
    if (!store) return notFound(req, res);
    const sub = m[2] || '';
    if (sub === '' && !post) return send(req, res, 200, storePage(store));
    if (sub === '/screen') return send(req, res, 200, screenPage(store));
    if (sub === '/join' && post) {
      if (limited(ip, 'join', 20, 60 * 60 * 1000)) return send(req, res, 429, storePage(store, 'حجوزات كثيرة من هذا الجهاز، حاول لاحقاً.'));
      const q = db.prepare('SELECT * FROM queues WHERE id = ? AND store_id = ?').get(Number(body.queue_id), store.id);
      if (!q || !q.is_open) return send(req, res, 400, storePage(store, 'هذا الطابور مغلق.'));
      const phone = clip(body.phone, 20).replace(/[^\d+]/g, '');
      if (phone) { // one active ticket per phone per queue — keeps lines fair
        const dup = db.prepare(`SELECT token FROM tickets WHERE queue_id = ? AND phone = ? AND status IN ('waiting','called')`).get(q.id, phone);
        if (dup) return redirect(res, `/t/${dup.token}`);
      }
      const t = issueTicket(q, clip(body.name, 40), phone);
      return redirect(res, `/t/${t.token}`);
    }
    if (sub === '/order' && store.orders_enabled) {
      if (!post) return send(req, res, 200, orderFormPage(store));
      if (limited(ip, 'order', 10, 60 * 60 * 1000)) return send(req, res, 429, orderFormPage(store, 'طلبات كثيرة، حاول لاحقاً.'));
      const menu = db.prepare('SELECT * FROM menu_items WHERE store_id = ? AND available = 1').all(store.id);
      const items = menu.map((i) => ({ name: i.name, qty: Math.min(50, Math.max(0, parseInt(body['qty_' + i.id], 10) || 0)) })).filter((i) => i.qty > 0);
      const note = clip(body.note, 300), name = clip(body.name, 40);
      if (!name || (!items.length && !note)) return send(req, res, 400, orderFormPage(store, 'اكتب اسمك واختر صنفاً واحداً على الأقل.'));
      const number = (db.prepare('SELECT MAX(number) n FROM orders WHERE store_id = ?').get(store.id).n || 0) + 1;
      const token = rand(12);
      db.prepare(`INSERT INTO orders (store_id, number, token, name, phone, items, note, pickup, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(store.id, number, token, name, clip(body.phone, 20), JSON.stringify(items), note, clip(body.pickup, 30), now());
      return redirect(res, `/o/${token}`);
    }
    return notFound(req, res);
  }

  if ((m = p.match(/^\/t\/([\w-]+)(\/cancel)?$/))) {
    const t = db.prepare('SELECT * FROM tickets WHERE token = ?').get(m[1]);
    if (!t) return notFound(req, res);
    if (m[2] && post) {
      db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE id = ? AND status = 'waiting'`).run(t.id);
      return redirect(res, `/t/${t.token}`);
    }
    return send(req, res, 200, ticketPage(t));
  }
  if ((m = p.match(/^\/o\/([\w-]+)$/))) {
    const o = db.prepare('SELECT * FROM orders WHERE token = ?').get(m[1]);
    return o ? send(req, res, 200, orderPage(o)) : notFound(req, res);
  }

  // ----- store auth -----
  if (p === '/login' || p === '/register') {
    const kind = p.slice(1);
    if (!post) return send(req, res, 200, authPage(kind));
    if (limited(ip, 'auth', 15, 15 * 60 * 1000)) return send(req, res, 429, authPage(kind, 'محاولات كثيرة، انتظر قليلاً.'));
    const username = clip(body.username, 30).toLowerCase(), password = String(body.password || '');
    let store;
    if (kind === 'register') {
      const name = clip(body.name, 60);
      if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return send(req, res, 400, authPage(kind, 'اسم المستخدم: 3 أحرف إنجليزية أو أرقام على الأقل.'));
      if (password.length < 6 || !name) return send(req, res, 400, authPage(kind, 'أكمل البيانات (كلمة المرور 6 أحرف على الأقل).'));
      if (db.prepare('SELECT 1 FROM stores WHERE username = ?').get(username)) return send(req, res, 400, authPage(kind, 'اسم المستخدم مستخدم مسبقاً.'));
      let code; do { code = crypto.randomBytes(3).toString('hex').slice(0, 4); } while (db.prepare('SELECT 1 FROM stores WHERE code = ?').get(code));
      const r = db.prepare('INSERT INTO stores (code, name, area, username, pass_hash, created_at) VALUES (?,?,?,?,?,?)')
        .run(code, name, clip(body.area, 60), username, hashPass(password), now());
      store = { id: Number(r.lastInsertRowid) };
    } else {
      store = db.prepare('SELECT * FROM stores WHERE username = ?').get(username);
      if (!store || !checkPass(password, store.pass_hash)) return send(req, res, 401, authPage(kind, 'اسم المستخدم أو كلمة المرور غير صحيحة.'));
    }
    const sid = rand(24);
    db.prepare('INSERT INTO sessions (token, store_id, expires_at) VALUES (?,?,?)').run(sid, store.id, now() + SESSION_DAYS * 864e5);
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return redirect(res, '/dash', { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}` });
  }

  // ----- store dashboard (login required) -----
  if (p === '/logout' || p.startsWith('/dash')) {
    const store = currentStore(req);
    if (!store) return redirect(res, '/login');
    if (p === '/logout' && post) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(cookies(req).sid);
      return redirect(res, '/', { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
    }
    if (p === '/dash' && !post) return send(req, res, 200, dashPage(store));
    if (!post) return notFound(req, res);

    if (p === '/dash/queue') {
      const name = clip(body.name, 40);
      const avg = Math.min(120, Math.max(0.2, Number(body.avg) || 3));
      if (name) db.prepare('INSERT INTO queues (store_id, name, avg_minutes) VALUES (?,?,?)').run(store.id, name, avg);
      return redirect(res, '/dash');
    }
    if ((m = p.match(/^\/dash\/queue\/(\d+)\/(next|skip|walkin|toggle|reset)$/))) {
      const q = db.prepare('SELECT * FROM queues WHERE id = ? AND store_id = ?').get(Number(m[1]), store.id);
      if (!q) return notFound(req, res);
      let msg = '';
      if (m[2] === 'next') { if (!callNext(q)) msg = 'لا يوجد أحد في الانتظار.'; }
      if (m[2] === 'skip') {
        db.prepare(`UPDATE tickets SET status = 'skipped' WHERE queue_id = ? AND status = 'called'`).run(q.id);
        callNext(db.prepare('SELECT * FROM queues WHERE id = ?').get(q.id));
      }
      if (m[2] === 'walkin') msg = `تذكرة جديدة: رقم ${issueTicket(q).number} — اكتبه للشخص على ورقة.`;
      if (m[2] === 'toggle') db.prepare('UPDATE queues SET is_open = 1 - is_open WHERE id = ?').run(q.id);
      if (m[2] === 'reset') {
        db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE queue_id = ? AND status IN ('waiting','called')`).run(q.id);
        db.prepare('UPDATE queues SET last_number = 0, current_number = 0, last_called_at = NULL WHERE id = ?').run(q.id);
      }
      return msg ? send(req, res, 200, dashPage(store, msg)) : redirect(res, '/dash');
    }
    if ((m = p.match(/^\/dash\/order\/(\d+)$/))) {
      if (['preparing', 'ready', 'picked', 'cancelled'].includes(body.status))
        db.prepare('UPDATE orders SET status = ? WHERE id = ? AND store_id = ?').run(body.status, Number(m[1]), store.id);
      return redirect(res, '/dash');
    }
    if (p === '/dash/settings') {
      db.prepare('UPDATE stores SET orders_enabled = ? WHERE id = ?').run(body.orders === '1' ? 1 : 0, store.id);
      return redirect(res, '/dash');
    }
    if (p === '/dash/menu') {
      const name = clip(body.name, 50);
      if (name) db.prepare('INSERT INTO menu_items (store_id, name, price) VALUES (?,?,?)').run(store.id, name, clip(body.price, 20));
      return redirect(res, '/dash');
    }
    if ((m = p.match(/^\/dash\/menu\/(\d+)\/(toggle|delete)$/))) {
      const sql = m[2] === 'toggle' ? 'UPDATE menu_items SET available = 1 - available WHERE id = ? AND store_id = ?'
        : 'DELETE FROM menu_items WHERE id = ? AND store_id = ?';
      db.prepare(sql).run(Number(m[1]), store.id);
      return redirect(res, '/dash');
    }
  }
  return notFound(req, res);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) send(req, res, 500, page('خطأ', '<p>حدث خطأ، حاول مرة أخرى.</p>'));
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`دور running on http://localhost:${PORT}`));
  setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now()), 864e5).unref();
}
module.exports = server;
