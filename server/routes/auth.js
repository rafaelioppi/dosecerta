/**
 * routes/auth.js
 * Cadastro de profissional, login (admin ou profissional), logout, "quem sou eu".
 * Admins não são criados por esta rota — só pelo script one-off (scripts/create-admin.js).
 */
const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();
const SALT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

router.post("/signup", authLimiter, async (req, res) => {
  const { name, email, password, councilType, councilNumber, acceptedDisclaimer } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Informe um nome válido." });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }
  if (!acceptedDisclaimer) {
    return res.status(400).json({
      error: "É necessário confirmar que você é profissional de saúde e ciência do uso responsável da ferramenta.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
  }

  const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);

  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, council_type, council_number, accepted_disclaimer_at)
       VALUES (?, ?, ?, 'professional', ?, ?, datetime('now'))`
    )
    .run(String(name).trim(), normalizedEmail, passwordHash, councilType || null, councilNumber || null);

  req.session.userId = result.lastInsertRowid;
  req.session.role = "professional";
  req.session.name = String(name).trim();

  res.status(201).json({ id: result.lastInsertRowid, name: String(name).trim(), email: normalizedEmail, role: "professional" });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);

  // Mensagem genérica de propósito, para não revelar se o e-mail existe ou não.
  const invalidMsg = { error: "E-mail ou senha inválidos." };
  if (!user) return res.status(401).json(invalidMsg);

  const matches = await bcrypt.compare(String(password), user.password_hash);
  if (!matches) return res.status(401).json(invalidMsg);

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("dosecerta.sid");
    res.status(204).end();
  });
});

router.get("/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  res.json({ id: req.session.userId, name: req.session.name, role: req.session.role });
});

module.exports = router;
