/**
 * scripts/create-admin.js
 * Cria (ou promove) um usuário admin. Rodado manualmente uma vez — não existe
 * rota HTTP pública para criar admin, por design.
 *
 * Uso: node server/scripts/create-admin.js "Nome" email@exemplo.com "senha-forte"
 */
require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("../db");

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('Uso: node server/scripts/create-admin.js "Nome" email@exemplo.com "senha-forte"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("A senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(normalizedEmail);
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ?, name = ? WHERE id = ?").run(
      passwordHash,
      name.trim(),
      existing.id
    );
    console.log(`Usuário existente (id ${existing.id}) promovido a admin e senha atualizada.`);
  } else {
    const result = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, accepted_disclaimer_at)
         VALUES (?, ?, ?, 'admin', datetime('now'))`
      )
      .run(name.trim(), normalizedEmail, passwordHash);
    console.log(`Admin criado com sucesso (id ${result.lastInsertRowid}).`);
  }
}

main().catch((err) => {
  console.error("Falha ao criar admin:", err);
  process.exit(1);
});
