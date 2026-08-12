/**
 * routes/contact.js
 * Recebe o formulário de contato público e grava no banco (o admin lê em routes/admin.js).
 */
const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas mensagens em pouco tempo. Tente novamente mais tarde." },
});

router.post("/", contactLimiter, (req, res) => {
  const { name, email, subject, message } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Informe seu nome." });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  if (!subject || String(subject).trim().length < 3) {
    return res.status(400).json({ error: "Descreva brevemente o assunto." });
  }
  if (!message || String(message).trim().length < 10) {
    return res.status(400).json({ error: "Escreva uma mensagem com pelo menos 10 caracteres." });
  }

  db.prepare(
    "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)"
  ).run(String(name).trim(), String(email).trim().toLowerCase(), String(subject).trim(), String(message).trim());

  res.status(201).json({ ok: true });
});

module.exports = router;
