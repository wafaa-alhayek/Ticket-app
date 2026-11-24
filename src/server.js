'use strict';
// "دور" (Dor) — queue tickets & pickup orders. Zero dependencies, Node >= 22.5.
const http = require('node:http');
const zlib = require('node:zlib');
const db = require('./db');
const { esc, page, action, mins } = require('./html');
const qr = require('./qr');

const FONT = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'fonts', 'readex-ar.woff2'));
const PORT = Number(process.env.PORT || 3000);
const core = require('./core');
const { now, clip, SESSION_DAYS, STATUS_AR, ORDER_AR, waitingAhead, waitingCount, callNext, issueTicket } = core;
const api = require('./api');

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
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'", ...headers };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 600) {
    body = zlib.gzipSync(body, { level: 9 }); h['Content-Encoding'] = 'gzip';
  }
  h['Content-Length'] = body.length;
  res.writeHead(status, h); res.end(body);
}
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };

const currentStore = (req) => core.storeBySession(cookies(req).sid);

// ---------- pages ----------
// WCAG 2.2.1: auto-refreshing pages offer a way to stop the timed reload (?live=0).
const liveToggle = (base, live) => `<a class="btn btn2" href="${base}${live ? '?live=0' : ''}">${live ? 'إيقاف التحديث التلقائي' : 'تشغيل التحديث التلقائي'}</a>`;
function homePage(err = '') {
  return page('الرئيسية', `
<h1>دور — بدون طوابير</h1>
<p>احجز دورك في طابور الخبز، تعبئة المياه، الحلاق، أو اطلب طلبك مسبقاً واستلمه جاهزاً.</p>
${err ? `<div class="notice" role="alert">${esc(err)}</div>` : ''}
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
<label for="n${q.id}">الاسم (اختياري)</label><input id="n${q.id}" name="name" maxlength="40" autocomplete="name">
<label for="p${q.id}">رقم الجوال (اختياري)</label><input id="p${q.id}" name="phone" maxlength="20" inputmode="tel" autocomplete="tel" dir="ltr">
<button class="big">احجز دوري</button></form>` : ''}</div>`;
  }).join('') || '<p class="muted">لا توجد طوابير مفتوحة حالياً.</p>';
  return page(store.name, `<h1>${esc(store.name)}</h1><p class="muted">${esc(store.area)} · الرمز: <b>${esc(store.code)}</b></p>
${err ? `<div class="notice" role="alert">${esc(err)}</div>` : ''}
${store.orders_enabled ? `<a class="btn big" href="/s/${esc(store.code)}/order"><span aria-hidden="true">🛍️</span> اطلب مسبقاً واستلم جاهزاً</a>` : ''}
${qs}<p class="muted"><a href="/s/${esc(store.code)}">تحديث</a></p>`);
}

function ticketPage(t, live = true) {
  const q = db.prepare('SELECT q.*, s.name sname, s.code FROM queues q JOIN stores s ON s.id = q.store_id WHERE q.id = ?').get(t.queue_id);
  const ahead = t.status === 'waiting' ? waitingAhead(q, t.number) : 0;
  const active = t.status === 'waiting' || t.status === 'called';
  return page(`تذكرة ${t.number}`, `
<div class="card ${t.status === 'called' ? 'called' : ''}" role="status" aria-live="polite">
<p>${esc(q.sname)} — ${esc(q.name)}</p>
<p class="muted">رقمك</p><div class="num">${t.number}</div>
<h1 style="text-align:center">${STATUS_AR[t.status]}</h1>
${t.status === 'waiting' ? `<table>
<tr><th scope="row">الدور الحالي</th><td><b>${q.current_number || '—'}</b></td></tr>
<tr><th scope="row">أمامك</th><td><b>${ahead}</b> شخص</td></tr>
<tr><th scope="row">الانتظار المتوقع</th><td><b>${mins(ahead * q.avg_minutes)}</b></td></tr></table>
${ahead <= 3 ? '<div class="notice">اقترب دورك، توجّه إلى المكان الآن.</div>' : ''}` : ''}
${t.status === 'called' ? '<div class="notice">توجّه إلى الشباك فوراً.</div>' : ''}
</div>
${active ? `<p class="ok">دورك محفوظ.</p><p class="muted">آخر تحديث: ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit' })}${live ? ' · تتحدث الصفحة تلقائياً كل 30 ثانية.' : ''} احفظ هذا الرابط أو صوّر الشاشة.</p>
<div class="row"><a class="btn btn2" href="/t/${esc(t.token)}${live ? '' : '?live=0'}">تحديث الآن</a>
${liveToggle(`/t/${esc(t.token)}`, live)}
${t.status === 'waiting' ? action(`/t/${t.token}/cancel`, 'إلغاء دوري', 'warn') : ''}</div>` : `<a class="btn" href="/s/${esc(q.code)}">احجز دوراً جديداً</a>`}`,
  { refresh: active && live ? 30 : 0 });
}

function screenPage(store) {
  const queues = db.prepare('SELECT * FROM queues WHERE store_id = ? AND is_open = 1 ORDER BY id').all(store.id);
  const ready = store.orders_enabled
    ? db.prepare(`SELECT number FROM orders WHERE store_id = ? AND status = 'ready' ORDER BY id DESC LIMIT 12`).all(store.id) : [];
  return page('شاشة العرض', `<main class="screen"><h1>${esc(store.name)}</h1>
${queues.map((q) => `<h2>${esc(q.name)}</h2><div class="num">${q.current_number || '—'}</div>
<p>المنتظرون: ${waitingCount(q)} · احجز دورك بالرمز: <b>${esc(store.code)}</b></p>`).join('')}
${ready.length ? `<h2>طلبات جاهزة</h2><div class="num" style="font-size:4em">${ready.map((o) => o.number).join(' · ')}</div>` : ''}
</main>`, { refresh: 10, bare: true });
}

function orderFormPage(store, err = '') {
  const items = db.prepare('SELECT * FROM menu_items WHERE store_id = ? AND available = 1 ORDER BY id').all(store.id);
  return page('اطلب مسبقاً', `<h1>${esc(store.name)} — طلب مسبق</h1>
${err ? `<div class="notice" role="alert">${esc(err)}</div>` : ''}
<form method="post" class="card" action="/s/${esc(store.code)}/order">
${items.length ? `<table><tr><th>الصنف</th><th>السعر</th><th>الكمية</th></tr>
${items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.price)}</td><td><input name="qty_${i.id}" aria-label="كمية ${esc(i.name)}" type="number" min="0" max="50" value="0" inputmode="numeric" style="width:5em"></td></tr>`).join('')}</table>`
  : '<p class="muted">لا توجد قائمة، اكتب طلبك في الملاحظات.</p>'}
<label for="note">ملاحظات / تفاصيل الطلب</label><textarea id="note" name="note" maxlength="300" rows="2"></textarea>
<label for="name">الاسم</label><input id="name" name="name" required maxlength="40" autocomplete="name">
<label for="phone">رقم الجوال (اختياري)</label><input id="phone" name="phone" maxlength="20" inputmode="tel" autocomplete="tel" dir="ltr">
<label for="pickup">متى ستصل؟</label><select id="pickup" name="pickup"><option>في أقرب وقت</option><option>خلال 15 دقيقة</option><option>خلال 30 دقيقة</option><option>خلال ساعة</option></select>
<button class="big">أرسل الطلب</button></form>`);
}

function orderPage(o, live = true) {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(o.store_id);
  const items = JSON.parse(o.items);
  const active = ['new', 'preparing', 'ready'].includes(o.status);
  return page(`طلب ${o.number}`, `<div class="card ${o.status === 'ready' ? 'called' : ''}" role="status" aria-live="polite">
<p>${esc(store.name)}</p><p class="muted">رقم طلبك</p><div class="num">${o.number}</div>
<h1 style="text-align:center">${ORDER_AR[o.status]}</h1>
<ul>${items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join('')}</ul>
${o.note ? `<p>ملاحظات: ${esc(o.note)}</p>` : ''}<p class="muted">الوصول: ${esc(o.pickup)}</p></div>
${active && live ? '<p class="muted">تتحدث الصفحة تلقائياً كل 30 ثانية.</p>' : ''}
<div class="row"><a class="btn btn2" href="/o/${esc(o.token)}${live ? '' : '?live=0'}">تحديث</a>
${active ? liveToggle(`/o/${esc(o.token)}`, live) : ''}</div>`, { refresh: active && live ? 30 : 0 });
}

function authPage(kind, err = '') {
  const reg = kind === 'register';
  return page(reg ? 'تسجيل محل' : 'دخول', `<h1>${reg ? 'تسجيل محل / نقطة جديدة' : 'دخول أصحاب المحلات'}</h1>
${err ? `<div class="notice" role="alert">${esc(err)}</div>` : ''}
<form method="post" class="card" action="/${kind}">
${reg ? `<label for="sn">اسم المحل أو النقطة</label><input id="sn" name="name" required maxlength="60" placeholder="مثال: مخبز العائلات">
<label for="area">المنطقة</label><input id="area" name="area" maxlength="60" placeholder="مثال: دير البلح - السوق">` : ''}
<label for="u">اسم المستخدم</label><input id="u" name="username" required maxlength="30" autocomplete="username" dir="ltr">
<label for="pw">كلمة المرور</label><input id="pw" name="password" type="password" required minlength="${reg ? 6 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}" dir="ltr">
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
${action(b + '/next', '<span aria-hidden="true">▶</span> نادِ التالي', 'big')}
<div class="row">${action(b + '/skip', 'تخطي الحالي (لم يحضر)', 'btn2')}
${action(b + '/walkin', '<span aria-hidden="true">+</span> تذكرة لشخص بدون جوال', 'btn2')}
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
${msg ? `<div class="notice" role="status">${esc(msg)}</div>` : ''}
<div class="card"><p>رمز محلك للزبائن: <b style="font-size:1.4em">${esc(store.code)}</b></p>
<p class="muted">صفحة الحجز: <a href="/s/${esc(store.code)}" dir="ltr">/s/${esc(store.code)}</a> · شاشة العرض: <a href="/s/${esc(store.code)}/screen" dir="ltr">/s/${esc(store.code)}/screen</a></p>
<div class="row"><a class="btn" href="/s/${esc(store.code)}/poster"><span aria-hidden="true">🖨️</span> ملصق QR للطباعة</a><a class="btn btn2" href="/dash">تحديث</a></div></div>
${qHtml}
<form method="post" class="card" action="/dash/queue"><h2>إضافة طابور</h2>
<label for="qn">اسم الطابور</label><input id="qn" name="name" required maxlength="40" placeholder="مثال: خبز، مياه، حلاقة">
<label for="qa">مدة خدمة الشخص تقريباً (دقائق)</label><input id="qa" name="avg" type="number" min="0.2" max="120" step="0.1" value="3" inputmode="decimal">
<button>إضافة</button></form>
<div class="card"><h2>الطلبات المسبقة</h2>
${action('/dash/settings', store.orders_enabled ? 'إيقاف الطلب المسبق' : 'تفعيل الطلب المسبق', 'btn2', { orders: store.orders_enabled ? 0 : 1 })}
${store.orders_enabled ? (orders.length ? `<div class="tw"><table><tr><th scope="col">#</th><th scope="col">الزبون</th><th scope="col">الطلب</th><th scope="col">الحالة</th><th scope="col"><span class="vh">إجراءات</span></th></tr>${oHtml}</table></div>` : '<p class="muted">لا توجد طلبات حالياً.</p>') : ''}</div>
${store.orders_enabled ? `<div class="card"><h2>القائمة</h2><table>${menu.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.price)}</td>
<td><div class="row">${action(`/dash/menu/${m.id}/toggle`, m.available ? 'متوفر' : 'غير متوفر', 'btn2')}${action(`/dash/menu/${m.id}/delete`, 'حذف', 'warn')}</div></td></tr>`).join('')}</table>
<form method="post" action="/dash/menu"><label for="mn">صنف جديد</label><input id="mn" name="name" required maxlength="50">
<label for="mp">السعر (اختياري)</label><input id="mp" name="price" maxlength="20"><button>إضافة صنف</button></form></div>` : ''}
${action('/logout', 'تسجيل الخروج', 'btn2')}`, { nav: '<a href="/dash">اللوحة</a>' });
}

// Public base URL for links printed on paper (poster QR). Behind a proxy, trust x-forwarded-proto.
function baseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' ? 'https' : 'http';
  const host = String(req.headers.host || '');
  return `${proto}://${/^[a-z0-9.\-]+(:\d+)?$|^\[[0-9a-f:.]+\](:\d+)?$/i.test(host) ? host : 'localhost'}`;
}

const POSTER_CSS = `
.poster{max-width:180mm;margin:0 auto;text-align:center;padding:12px}
.poster h1{font-size:2.2em;color:#14532d;margin:.2em 0}
.poster .qr{width:min(100%,110mm);height:auto;display:block;margin:12px auto;border:6px solid #14532d;border-radius:12px}
.poster .code{font-size:2.4em;font-weight:bold;letter-spacing:.15em;direction:ltr;unicode-bidi:isolate}
.poster ol{text-align:right;font-size:1.3em;max-width:150mm;margin:12px auto;padding-right:1.4em}
.poster .url{direction:ltr;unicode-bidi:isolate;white-space:nowrap}.poster p.url{white-space:normal;word-break:break-all}
.paper{border:3px dashed #9a3412;border-radius:10px;padding:10px;font-size:1.25em;font-weight:bold;color:#7c2d12}
@page{size:A4;margin:12mm}
@media print{body{background:#fff;font-size:14pt;line-height:1.4}.poster .qr{width:95mm;margin:6mm auto}.poster h1{font-size:28pt}.poster ol{font-size:15pt}header,.noprint{display:none}main{max-width:none;padding:0}.poster{padding:0}a{color:#000;text-decoration:none}}
`;

function posterPage(store, base) {
  const url = `${base}/s/${store.code}`;
  return page(`ملصق ${store.name}`, `<div class="poster">
<p class="muted">احجز دورك بدون طابور مع <b>دور</b></p>
<h1>${esc(store.name)}</h1>${store.area ? `<p>${esc(store.area)}</p>` : ''}
${qr.svg(url, { label: `رمز QR لصفحة الحجز: ${url}` }).replace('<svg ', '<svg class="qr" ')}
<p>رمز المحل</p><div class="code">${esc(store.code)}</div>
<ol><li>صوّر الرمز بكاميرا جوالك، أو افتح <span class="url">${esc(base.replace(/^https?:\/\//, ''))}</span> واكتب الرمز <b>${esc(store.code)}</b>.</li>
<li>اختر الطابور واضغط «احجز دوري».</li>
<li>احفظ صفحة تذكرتك وارجع عندما يقترب دورك.</li></ol>
<p class="paper">ما عندك جوال؟ اطلب رقماً ورقياً من الشباك.</p>
<p class="url muted">${esc(url)}</p>
<p class="noprint"><a class="btn" href="/dash">رجوع للوحة</a> <span class="muted">اطبع هذه الصفحة من قائمة المتصفح (طباعة).</span></p>
</div>`, { css: POSTER_CSS });
}

const notFound = (req, res) => send(req, res, 404, page('غير موجود', '<h1>الصفحة غير موجودة</h1><a class="btn" href="/">الرئيسية</a>'));

// ---------- router ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const ip = req.socket.remoteAddress || '';
  const post = req.method === 'POST';
  if (p.startsWith('/api/')) return api.handle(req, res, p, url, ip);
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
  if (p === '/font/readex-ar.woff2') {
    res.writeHead(200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': FONT.length });
    return res.end(FONT);
  }
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
    if (sub === '/poster' && !post) return send(req, res, 200, posterPage(store, baseUrl(req)));
    if (sub === '/join' && post) {
      if (core.isLimited(ip, 'join')) return send(req, res, 429, storePage(store, 'حجوزات كثيرة من هذا الجهاز، حاول لاحقاً.'));
      const t = core.joinQueue(store, body.queue_id, body.name, body.phone);
      if (t.error) return send(req, res, 400, storePage(store, 'هذا الطابور مغلق.'));
      return redirect(res, `/t/${t.token}`);
    }
    if (sub === '/order' && store.orders_enabled) {
      if (!post) return send(req, res, 200, orderFormPage(store));
      if (core.isLimited(ip, 'order')) return send(req, res, 429, orderFormPage(store, 'طلبات كثيرة، حاول لاحقاً.'));
      const o = core.placeOrder(store, { qtyOf: (i) => body['qty_' + i.id], note: body.note, name: body.name, phone: body.phone, pickup: body.pickup });
      if (o.error) return send(req, res, 400, orderFormPage(store, 'اكتب اسمك واختر صنفاً واحداً على الأقل.'));
      const token = o.token;
      return redirect(res, `/o/${token}`);
    }
    return notFound(req, res);
  }

  if ((m = p.match(/^\/t\/([\w-]+)(\/cancel)?$/))) {
    const t = db.prepare('SELECT * FROM tickets WHERE token = ?').get(m[1]);
    if (!t) return notFound(req, res);
    if (m[2] && post) {
      core.cancelTicket(t);
      return redirect(res, `/t/${t.token}`);
    }
    return send(req, res, 200, ticketPage(t, url.searchParams.get('live') !== '0'));
  }
  if ((m = p.match(/^\/o\/([\w-]+)$/))) {
    const o = db.prepare('SELECT * FROM orders WHERE token = ?').get(m[1]);
    return o ? send(req, res, 200, orderPage(o, url.searchParams.get('live') !== '0')) : notFound(req, res);
  }

  // ----- store auth -----
  if (p === '/login' || p === '/register') {
    const kind = p.slice(1);
    if (!post) return send(req, res, 200, authPage(kind));
    if (core.isLimited(ip, 'auth')) return send(req, res, 429, authPage(kind, 'محاولات كثيرة، انتظر قليلاً.'));
    let store;
    if (kind === 'register') {
      const r = core.registerStore(body);
      if (r.error) return send(req, res, 400, authPage(kind, r.message_ar));
      store = r.store;
    } else {
      store = core.loginStore(body.username, body.password);
      if (!store) return send(req, res, 401, authPage(kind, 'اسم المستخدم أو كلمة المرور غير صحيحة.'));
    }
    const sid = core.createSession(store).token;
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return redirect(res, '/dash', { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}` });
  }

  // ----- store dashboard (login required) -----
  if (p === '/logout' || p.startsWith('/dash')) {
    const store = currentStore(req);
    if (!store) return redirect(res, '/login');
    if (p === '/logout' && post) {
      core.deleteSession(cookies(req).sid);
      return redirect(res, '/', { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
    }
    if (p === '/dash' && !post) return send(req, res, 200, dashPage(store));
    if (!post) return notFound(req, res);

    if (p === '/dash/queue') {
      core.createQueue(store, body.name, body.avg);
      return redirect(res, '/dash');
    }
    if ((m = p.match(/^\/dash\/queue\/(\d+)\/(next|skip|walkin|toggle|reset)$/))) {
      const q = core.queueOf(store.id, m[1]);
      if (!q) return notFound(req, res);
      let msg = '';
      if (m[2] === 'next') { if (!callNext(q)) msg = 'لا يوجد أحد في الانتظار.'; }
      if (m[2] === 'skip') core.skipCurrent(q);
      if (m[2] === 'walkin') msg = `تذكرة جديدة: رقم ${issueTicket(q).number} — اكتبه للشخص على ورقة.`;
      if (m[2] === 'toggle') core.toggleQueue(q);
      if (m[2] === 'reset') {
        if (body.confirm !== '1') return send(req, res, 200, page('تأكيد التصفير', `<h1>تصفير طابور «${esc(q.name)}»؟</h1>
<div class="notice">سيتم إلغاء كل التذاكر المنتظرة ويبدأ الترقيم من 1. لا يمكن التراجع.</div>
<div class="row">${action(`/dash/queue/${q.id}/reset`, 'نعم، صفّر الطابور', 'warn', { confirm: 1 })}<a class="btn btn2" href="/dash">إلغاء</a></div>`));
        core.resetQueue(q);
      }
      return msg ? send(req, res, 200, dashPage(store, msg)) : redirect(res, '/dash');
    }
    if ((m = p.match(/^\/dash\/order\/(\d+)$/))) {
      core.setOrderStatus(store, m[1], body.status);
      return redirect(res, '/dash');
    }
    if (p === '/dash/settings') {
      core.setOrdersEnabled(store, body.orders === '1');
      return redirect(res, '/dash');
    }
    if (p === '/dash/menu') {
      core.addMenuItem(store, body.name, body.price);
      return redirect(res, '/dash');
    }
    if ((m = p.match(/^\/dash\/menu\/(\d+)\/(toggle|delete)$/))) {
      if (m[2] === 'toggle') core.toggleMenuItem(store, m[1]); else core.deleteMenuItem(store, m[1]);
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
  core.startPurge(); // closed tickets/orders > 7 days, expired sessions
}
module.exports = server;
