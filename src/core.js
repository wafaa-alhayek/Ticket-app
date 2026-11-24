'use strict';
// Shared queue / order / auth logic used by both the HTML routes (server.js) and the JSON API (api.js).
const crypto = require('node:crypto');
const db = require('./db');

const now = () => Date.now();
const rand = (n = 16) => crypto.randomBytes(n).toString('base64url');
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const SESSION_DAYS = 30;
const PURGE_DAYS = 7;

const STATUS_AR = { waiting: 'في الانتظار', called: 'حان دورك!', done: 'تمّت خدمتك، شكراً لك', skipped: 'مرّ دورك — كلّم المسؤول عن الطابور', cancelled: 'أُلغي دورك' };
const ORDER_AR = { new: 'وصلنا الطلب', preparing: 'قيد التحضير', ready: 'جاهز للاستلام ✅', picked: 'تم التسليم', cancelled: 'أُلغي الطلب' };
const ORDER_STATUSES = ['preparing', 'ready', 'picked', 'cancelled'];

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

// ---------- tiny rate limiter (per IP, per bucket; shared by HTML and API) ----------
const hits = new Map();
function limited(ip, bucket, max, windowMs) {
  const key = bucket + ip, t = now();
  const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();
const LIMITS = { join: [20, 3600e3], order: [10, 3600e3], auth: [15, 900e3] };
const isLimited = (ip, bucket) => limited(ip, bucket, ...LIMITS[bucket]);

// ---------- lookups ----------
const storeByCode = (code) => db.prepare('SELECT * FROM stores WHERE code = ?').get(clip(code, 12).toLowerCase()) || null;
const storeById = (id) => db.prepare('SELECT * FROM stores WHERE id = ?').get(id) || null;
const queuesOf = (storeId, openOnly = false) =>
  db.prepare(`SELECT * FROM queues WHERE store_id = ? ${openOnly ? 'AND is_open = 1' : ''} ORDER BY id`).all(storeId);
const queueOf = (storeId, id) => db.prepare('SELECT * FROM queues WHERE id = ? AND store_id = ?').get(Number(id), storeId) || null;
const ticketByToken = (t) => db.prepare('SELECT * FROM tickets WHERE token = ?').get(String(t)) || null;
const orderByToken = (t) => db.prepare('SELECT * FROM orders WHERE token = ?').get(String(t)) || null;
const menuOf = (storeId, availableOnly = false) =>
  db.prepare(`SELECT * FROM menu_items WHERE store_id = ? ${availableOnly ? 'AND available = 1' : ''} ORDER BY id`).all(storeId);
const activeOrders = (storeId) =>
  db.prepare(`SELECT * FROM orders WHERE store_id = ? AND status IN ('new','preparing','ready') ORDER BY id`).all(storeId);
const readyOrderNumbers = (storeId) =>
  db.prepare(`SELECT number FROM orders WHERE store_id = ? AND status = 'ready' ORDER BY id DESC LIMIT 12`).all(storeId).map((o) => o.number);

// ---------- queue logic ----------
const waitingAhead = (q, number) => db.prepare(
  `SELECT COUNT(*) c FROM tickets WHERE queue_id = ? AND status = 'waiting' AND number < ?`).get(q.id, number).c;
const waitingCount = (q) => db.prepare(
  `SELECT COUNT(*) c FROM tickets WHERE queue_id = ? AND status = 'waiting'`).get(q.id).c;
const serving = (q) => db.prepare(`SELECT * FROM tickets WHERE queue_id = ? AND status = 'called' LIMIT 1`).get(q.id) || null;
const nextWaiting = (q, n = 5) => db.prepare(
  `SELECT number, name FROM tickets WHERE queue_id = ? AND status = 'waiting' ORDER BY number LIMIT ?`).all(q.id, n);

function issueTicket(q, name = '', phone = '') {
  const number = q.last_number + 1;
  db.prepare('UPDATE queues SET last_number = ? WHERE id = ?').run(number, q.id);
  const token = rand(12);
  db.prepare(`INSERT INTO tickets (queue_id, number, token, name, phone, created_at) VALUES (?,?,?,?,?,?)`)
    .run(q.id, number, token, name, phone, now());
  return { number, token };
}

// Join a line. Returns { error } or { token, number, existing }.
function joinQueue(store, queueId, name, phone) {
  const q = queueOf(store.id, queueId);
  if (!q) return { error: 'not_found' };
  if (!q.is_open) return { error: 'queue_closed' };
  phone = clip(phone, 20).replace(/[^\d+]/g, '');
  if (phone) { // one active ticket per phone per queue — keeps lines fair
    const dup = db.prepare(`SELECT token, number FROM tickets WHERE queue_id = ? AND phone = ? AND status IN ('waiting','called')`).get(q.id, phone);
    if (dup) return { ...dup, existing: true };
  }
  return { ...issueTicket(q, clip(name, 40), phone), existing: false };
}

function cancelTicket(t) {
  return db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE id = ? AND status = 'waiting'`).run(t.id).changes > 0;
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
function skipCurrent(q) {
  db.prepare(`UPDATE tickets SET status = 'skipped' WHERE queue_id = ? AND status = 'called'`).run(q.id);
  return callNext(db.prepare('SELECT * FROM queues WHERE id = ?').get(q.id));
}
const toggleQueue = (q) => db.prepare('UPDATE queues SET is_open = 1 - is_open WHERE id = ?').run(q.id);
function resetQueue(q) {
  db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE queue_id = ? AND status IN ('waiting','called')`).run(q.id);
  db.prepare('UPDATE queues SET last_number = 0, current_number = 0, last_called_at = NULL WHERE id = ?').run(q.id);
}
function createQueue(store, name, avg) {
  name = clip(name, 40);
  if (!name) return null;
  avg = Math.min(120, Math.max(0.2, Number(avg) || 3));
  return Number(db.prepare('INSERT INTO queues (store_id, name, avg_minutes) VALUES (?,?,?)').run(store.id, name, avg).lastInsertRowid);
}

// ---------- orders & menu ----------
// qtyOf(item) -> requested quantity for a menu item.
function placeOrder(store, { qtyOf, note, name, phone, pickup }) {
  const items = menuOf(store.id, true)
    .map((i) => ({ name: i.name, qty: Math.min(50, Math.max(0, parseInt(qtyOf(i), 10) || 0)) }))
    .filter((i) => i.qty > 0);
  note = clip(note, 300); name = clip(name, 40);
  if (!name || (!items.length && !note)) return { error: 'invalid_input' };
  const number = (db.prepare('SELECT MAX(number) n FROM orders WHERE store_id = ?').get(store.id).n || 0) + 1;
  const token = rand(12);
  db.prepare(`INSERT INTO orders (store_id, number, token, name, phone, items, note, pickup, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(store.id, number, token, name, clip(phone, 20), JSON.stringify(items), note, clip(pickup, 30), now());
  return { token, number };
}
function setOrderStatus(store, id, status) {
  if (!ORDER_STATUSES.includes(status)) return false;
  return db.prepare('UPDATE orders SET status = ? WHERE id = ? AND store_id = ?').run(status, Number(id), store.id).changes > 0;
}
const setOrdersEnabled = (store, on) => db.prepare('UPDATE stores SET orders_enabled = ? WHERE id = ?').run(on ? 1 : 0, store.id);
function addMenuItem(store, name, price) {
  name = clip(name, 50);
  if (!name) return null;
  return Number(db.prepare('INSERT INTO menu_items (store_id, name, price) VALUES (?,?,?)').run(store.id, name, clip(price, 20)).lastInsertRowid);
}
const toggleMenuItem = (store, id) =>
  db.prepare('UPDATE menu_items SET available = 1 - available WHERE id = ? AND store_id = ?').run(Number(id), store.id).changes > 0;
const deleteMenuItem = (store, id) =>
  db.prepare('DELETE FROM menu_items WHERE id = ? AND store_id = ?').run(Number(id), store.id).changes > 0;

// ---------- accounts & sessions ----------
// Returns { error, message_ar } or { store }.
function registerStore({ name, area, username, password }) {
  username = clip(username, 30).toLowerCase(); password = String(password || ''); name = clip(name, 60);
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return { error: 'invalid_input', message_ar: 'اسم المستخدم: 3 أحرف على الأقل، بالإنجليزية أو أرقام.' };
  if (password.length < 6 || !name) return { error: 'invalid_input', message_ar: 'اكتب اسم المحل، وكلمة مرور من 6 أحرف على الأقل.' };
  if (db.prepare('SELECT 1 FROM stores WHERE username = ?').get(username)) return { error: 'username_taken', message_ar: 'اسم المستخدم محجوز. اختر اسماً آخر.' };
  let code; do { code = crypto.randomBytes(3).toString('hex').slice(0, 4); } while (db.prepare('SELECT 1 FROM stores WHERE code = ?').get(code));
  const r = db.prepare('INSERT INTO stores (code, name, area, username, pass_hash, created_at) VALUES (?,?,?,?,?,?)')
    .run(code, name, clip(area, 60), username, hashPass(password), now());
  return { store: storeById(Number(r.lastInsertRowid)) };
}
function loginStore(username, password) {
  const store = db.prepare('SELECT * FROM stores WHERE username = ?').get(clip(username, 30).toLowerCase());
  return store && checkPass(String(password || ''), store.pass_hash) ? store : null;
}
function createSession(store) {
  const token = rand(24), expires_at = now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions (token, store_id, expires_at) VALUES (?,?,?)').run(token, store.id, expires_at);
  return { token, expires_at };
}
function storeBySession(token) {
  if (!token) return null;
  return db.prepare(`SELECT s.* FROM sessions x JOIN stores s ON s.id = x.store_id
    WHERE x.token = ? AND x.expires_at > ?`).get(String(token), now()) || null;
}
const deleteSession = (token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token || ''));

// ---------- retention (NFR-7) ----------
function purgeOld(days = PURGE_DAYS) {
  const cutoff = now() - days * 864e5;
  const t = db.prepare(`DELETE FROM tickets WHERE status IN ('done','skipped','cancelled') AND created_at < ?`).run(cutoff).changes;
  const o = db.prepare(`DELETE FROM orders WHERE status IN ('picked','cancelled') AND created_at < ?`).run(cutoff).changes;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  return { tickets: t, orders: o };
}
function startPurge(intervalMs = 3600e3) {
  purgeOld();
  return setInterval(purgeOld, intervalMs).unref();
}

module.exports = {
  db, now, rand, clip, SESSION_DAYS, STATUS_AR, ORDER_AR, ORDER_STATUSES,
  hashPass, checkPass, limited, isLimited,
  storeByCode, storeById, queuesOf, queueOf, ticketByToken, orderByToken, menuOf, activeOrders, readyOrderNumbers,
  waitingAhead, waitingCount, serving, nextWaiting, issueTicket, joinQueue, cancelTicket, callNext, skipCurrent,
  toggleQueue, resetQueue, createQueue,
  placeOrder, setOrderStatus, setOrdersEnabled, addMenuItem, toggleMenuItem, deleteMenuItem,
  registerStore, loginStore, createSession, storeBySession, deleteSession,
  purgeOld, startPurge,
};
