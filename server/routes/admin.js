/**
 * routes/admin.js
 * CRUD de usuários e do catálogo de medicamentos. Tudo aqui exige role 'admin'.
 */
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("admin"));

const SALT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Usuários ----
// Cria conta diretamente pelo admin (sem passar pelo cadastro público em
// /cadastro.html) — inclusive contas admin. Continua não existindo rota
// pra alguém virar admin sozinho: só quem já é admin acessa isto.
router.get("/users", (_req, res) => {
  res.json(
    db
      .prepare("SELECT id, name, email, role, council_type, council_number, created_at FROM users ORDER BY created_at DESC")
      .all()
  );
});

router.post("/users", async (req, res) => {
  const { name, email, password, role, councilType, councilNumber } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Informe um nome válido." });
  }
  if (!email || !EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  }
  if (role !== "admin" && role !== "professional") {
    return res.status(400).json({ error: "Papel inválido — use 'admin' ou 'professional'." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
  }

  const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, council_type, council_number)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(String(name).trim(), normalizedEmail, passwordHash, role, councilType || null, councilNumber || null);

  res.status(201).json({ id: result.lastInsertRowid, name: String(name).trim(), email: normalizedEmail, role });
});

router.get("/medications", (_req, res) => {
  res.json(db.prepare("SELECT * FROM medications ORDER BY name").all());
});

router.post("/medications", (req, res) => {
  const m = req.body || {};
  if (!m.name || !m.category || !m.source_name || !m.source_url) {
    return res.status(400).json({ error: "name, category, source_name e source_url são obrigatórios." });
  }
  const result = db
    .prepare(
      `INSERT INTO medications
        (name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
         route, presentation, notes, source_name, source_url, created_by)
       VALUES (@name, @category, @indication, @dose_mg_per_kg, @dose_unit, @frequency, @max_dose_mg,
               @route, @presentation, @notes, @source_name, @source_url, @created_by)`
    )
    .run({
      name: m.name,
      category: m.category,
      indication: m.indication || null,
      dose_mg_per_kg: m.dose_mg_per_kg ?? null,
      dose_unit: m.dose_unit || null,
      frequency: m.frequency || null,
      max_dose_mg: m.max_dose_mg ?? null,
      route: m.route || null,
      presentation: m.presentation || null,
      notes: m.notes || null,
      source_name: m.source_name,
      source_url: m.source_url,
      created_by: req.session.userId,
    });
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put("/medications/:id", (req, res) => {
  const m = req.body || {};
  const existing = db.prepare("SELECT id FROM medications WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Medicamento não encontrado." });

  db.prepare(
    `UPDATE medications SET
       name = @name, category = @category, indication = @indication,
       dose_mg_per_kg = @dose_mg_per_kg, dose_unit = @dose_unit, frequency = @frequency,
       max_dose_mg = @max_dose_mg, route = @route, presentation = @presentation, notes = @notes,
       source_name = @source_name, source_url = @source_url, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id: req.params.id,
    name: m.name,
    category: m.category,
    indication: m.indication || null,
    dose_mg_per_kg: m.dose_mg_per_kg ?? null,
    dose_unit: m.dose_unit || null,
    frequency: m.frequency || null,
    max_dose_mg: m.max_dose_mg ?? null,
    route: m.route || null,
    presentation: m.presentation || null,
    notes: m.notes || null,
    source_name: m.source_name,
    source_url: m.source_url,
  });
  res.json({ ok: true });
});

router.delete("/medications/:id", (req, res) => {
  db.prepare("DELETE FROM medications WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
