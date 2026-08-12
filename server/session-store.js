/**
 * session-store.js
 * Session store mínima sobre SQLite (via node:sqlite, ver db.js), no lugar de
 * connect-sqlite3 — evita a dependência nativa `sqlite3` (que exige toolchain
 * de compilação) já que o projeto usa node:sqlite para tudo o mais.
 */
const session = require("express-session");
const db = require("./db");

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias, alinhado ao cookie maxAge

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this._cleanupExpired();
    // Limpeza periódica de sessões expiradas (a cada hora), sem travar o processo.
    this._interval = setInterval(() => this._cleanupExpired(), 1000 * 60 * 60);
    this._interval.unref();
  }

  _cleanupExpired() {
    try {
      db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    } catch (err) {
      console.error("Falha ao limpar sessões expiradas:", err);
    }
  }

  get(sid, callback) {
    try {
      const row = db.prepare("SELECT sess, expires FROM sessions WHERE sid = ?").get(sid);
      if (!row || row.expires < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const ttl = sessionData.cookie?.maxAge || DEFAULT_TTL_MS;
      const expires = Date.now() + ttl;
      db.prepare(
        `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`
      ).run(sid, JSON.stringify(sessionData), expires);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }
}

module.exports = SqliteSessionStore;
