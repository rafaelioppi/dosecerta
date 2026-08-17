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

/**
 * Migração idempotente: adiciona colunas que ainda não existem em tabelas já
 * criadas (CREATE TABLE IF NOT EXISTS não altera tabela existente — em
 * produção a tabela medications já existe há tempo). Roda em todo boot.
 */
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

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

ensureColumn("medications", "presentations", "TEXT");
// presentations = JSON array de { label, concentration_mg_per_ml } das
// apresentações líquidas do medicamento (xarope/suspensão/solução/gotas).
// O calculador usa estas concentrações pra converter mg -> mL. NULL = o
// medicamento não tem apresentação líquida com concentração conhecida.

ensureColumn("medications", "max_dose_basis", "TEXT");
// max_dose_basis = 'per_dose' | 'per_day' | 'per_session' | NULL — o que
// max_dose_mg realmente limita. Sem isso o servidor não tinha como saber se
// devia cortar o valor calculado por TOMADA ou o total do DIA, e aplicava o
// teto direto em cima do mg/kg calculado nos dois casos — errado sempre que
// dose_unit é "/dose" mas o teto da fonte é diário (ex.: Ibuprofeno, 800
// mg/dia tratado como se fosse 800 mg por tomada). NULL = medicamento sem
// dose_mg_per_kg ou sem max_dose_mg (teto não se aplica ao cálculo).

ensureColumn("medications", "doses_per_day", "REAL");
// doses_per_day = número de tomadas em 24h, quando a fonte deixa isso claro
// na bula (não é estimativa "chutada" a partir de frequency por regex no
// cliente). Usado para (a) dividir mg/kg/dia em dose por tomada e (b) aplicar
// max_dose_basis='per_day' corretamente. NULL = sem dose por kg ou fonte não
// especifica quantas tomadas/dia (a UI cai de volta na leitura do total do
// dia, com aviso explícito).

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
