'use strict';
// Data layer: one SQLite file, no external dependencies (uses Node's built-in node:sqlite).
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'dor.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,          -- short public code clients type, e.g. "ab12"
  name TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT '',
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  orders_enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- A store can run several lines at once (e.g. bread, water, flour).
CREATE TABLE IF NOT EXISTS queues (
  id INTEGER PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avg_minutes REAL NOT NULL DEFAULT 3,   -- learned from real service times
  is_open INTEGER NOT NULL DEFAULT 1,
  last_number INTEGER NOT NULL DEFAULT 0,
  current_number INTEGER NOT NULL DEFAULT 0,
  last_called_at INTEGER
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,       -- secret in the client's link
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | called | done | skipped | cancelled
  created_at INTEGER NOT NULL,
  called_at INTEGER
);
CREATE INDEX IF NOT EXISTS tickets_queue ON tickets(queue_id, status, number);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL,              -- JSON [{name, qty}]
  note TEXT NOT NULL DEFAULT '',
  pickup TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new', -- new | preparing | ready | picked | cancelled
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_store ON orders(store_id, status);
`);

module.exports = db;
