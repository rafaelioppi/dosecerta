/**
 * db.js
 * Conexão SQLite via `node:sqlite` (nativo do Node ≥ 22.5, sem dependência
 * compilada) + migrações idempotentes. O arquivo do banco fica em
 * data/dosecerta.sqlite (fora do controle de versão).
 */
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "dosecerta.sqlite");
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'professional')),
    council_type TEXT,
    council_number TEXT,
    accepted_disclaimer_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    indication TEXT,
    dose_mg_per_kg REAL,
    dose_unit TEXT,
    frequency TEXT,
    max_dose_mg REAL,
    route TEXT,
    presentation TEXT,
    notes TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
`);

/**
 * Executa `fn` dentro de uma transação SQLite manual (node:sqlite não tem o
 * helper `.transaction()` do better-sqlite3). Uso: withTransaction(() => { ... }).
 */
function withTransaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = db;
module.exports.withTransaction = withTransaction;
