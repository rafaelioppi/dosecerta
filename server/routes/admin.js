/**
 * routes/admin.js
 * Tudo aqui exige role 'admin': editar blocos de conteúdo do site, ler mensagens
 * de contato, e fazer CRUD do catálogo de medicamentos.
 */
const express = require("express");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("admin"));

// ---- Conteúdo do site ----
router.put("/content/:key", (req, res) => {
  const { key } = req.params;
  const value = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: "Corpo da requisição vazio." });
  }
  db.prepare(
    `INSERT INTO content_blocks (key, value_json, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`
  ).run(key, JSON.stringify(value));
  res.json({ ok: true });
});

// ---- Mensagens de contato ----
router.get("/messages", (_req, res) => {
  const rows = db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
  res.json(rows);
});

router.put("/messages/:id/read", (req, res) => {
  db.prepare("UPDATE contact_messages SET read = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---- CRUD de medicamentos ----
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
