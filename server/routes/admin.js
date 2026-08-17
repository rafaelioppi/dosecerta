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

// Regras de validação compartilhadas entre criar (POST) e editar (PUT) um
// usuário — únicas exceções: PUT não exige senha (mantém a atual se omitida),
// mas ainda valida o comprimento se uma nova senha for enviada.
function validateUserPayload({ name, email, password, role }, { requirePassword }) {
  if (!name || String(name).trim().length < 2) return "Informe um nome válido.";
  if (!email || !EMAIL_RE.test(String(email))) return "Informe um e-mail válido.";
  if (requirePassword && (!password || String(password).length < 8)) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (!requirePassword && password && String(password).length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (role !== "admin" && role !== "professional") {
    return "Papel inválido — use 'admin' ou 'professional'.";
  }
  return null;
}

router.post("/users", async (req, res) => {
  const { name, email, password, role, councilType, councilNumber } = req.body || {};

  const validationError = validateUserPayload({ name, email, password, role }, { requirePassword: true });
  if (validationError) return res.status(400).json({ error: validationError });

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

// Edita um usuário existente — o único jeito de "resetar login": nome, papel,
// conselho e (opcionalmente) senha. Sem isto, um profissional que esquece a
// senha ficava sem saída, já que só existia criação, nunca edição.
router.put("/users/:id", async (req, res) => {
  const { name, email, password, role, councilType, councilNumber } = req.body || {};

  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });

  const validationError = validateUserPayload({ name, email, password, role }, { requirePassword: false });
  if (validationError) return res.status(400).json({ error: validationError });

  const normalizedEmail = String(email).trim().toLowerCase();
  const emailTaken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(normalizedEmail, req.params.id);
  if (emailTaken) {
    return res.status(409).json({ error: "Já existe uma conta com este e-mail." });
  }

  const name2 = String(name).trim();
  if (password) {
    const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
    db.prepare(
      "UPDATE users SET name = ?, email = ?, role = ?, council_type = ?, council_number = ?, password_hash = ? WHERE id = ?"
    ).run(name2, normalizedEmail, role, councilType || null, councilNumber || null, passwordHash, req.params.id);
  } else {
    db.prepare(
      "UPDATE users SET name = ?, email = ?, role = ?, council_type = ?, council_number = ? WHERE id = ?"
    ).run(name2, normalizedEmail, role, councilType || null, councilNumber || null, req.params.id);
  }

  res.json({ id: Number(req.params.id), name: name2, email: normalizedEmail, role });
});

router.get("/medications", (_req, res) => {
  res.json(db.prepare("SELECT * FROM medications ORDER BY name").all());
});

// Normaliza presentations: aceita array [{label, concentration_mg_per_ml}] ou
// string JSON. Validação mínima de formato; valores numéricos de concentração
// positivos e label presente. Concentração ausente/inválida vira [] (sem mL).
function normalizePresentations(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((p) => p && typeof p.label === "string" && p.label.trim())
    .map((p) => {
      const c = Number(p.concentration_mg_per_ml);
      return {
        label: p.label.trim(),
        concentration_mg_per_ml: Number.isFinite(c) && c > 0 ? c : null,
      };
    })
    .filter((p) => p.concentration_mg_per_ml != null);
}

// Campos compartilhados entre criar e editar um medicamento — mesma forma nos
// dois INSERTs/UPDATEs, pra um campo novo (ex.: presentations, no passado)
// não poder ser adicionado em só um dos dois caminhos por esquecimento.
const VALID_MAX_DOSE_BASIS = ["per_dose", "per_day", "per_session"];

function medicationFields(m) {
  return {
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
    max_dose_basis: VALID_MAX_DOSE_BASIS.includes(m.max_dose_basis) ? m.max_dose_basis : null,
    doses_per_day: Number.isFinite(Number(m.doses_per_day)) && m.doses_per_day !== null && m.doses_per_day !== ""
      ? Number(m.doses_per_day)
      : null,
  };
}

function validateMedicationFields(m) {
  if (!m.name || !m.category || !m.source_name || !m.source_url) {
    return "name, category, source_name e source_url são obrigatórios.";
  }
  // Mesma regra do server/scripts/check-medications.js: sem isso o servidor
  // de cálculo não sabe se max_dose_mg é teto por tomada ou por dia (ver
  // achado da auditoria de 16/ago/2026 — routes/medications.js).
  if (m.dose_mg_per_kg != null && m.max_dose_mg != null && !VALID_MAX_DOSE_BASIS.includes(m.max_dose_basis)) {
    return `max_dose_basis é obrigatório (${VALID_MAX_DOSE_BASIS.join(", ")}) quando dose_mg_per_kg e max_dose_mg estão preenchidos.`;
  }
  return null;
}

router.post("/medications", (req, res) => {
  const m = req.body || {};
  const validationError = validateMedicationFields(m);
  if (validationError) return res.status(400).json({ error: validationError });

  const result = db
    .prepare(
      `INSERT INTO medications
        (name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
         route, presentation, notes, source_name, source_url, presentations, created_by,
         max_dose_basis, doses_per_day)
       VALUES (@name, @category, @indication, @dose_mg_per_kg, @dose_unit, @frequency, @max_dose_mg,
               @route, @presentation, @notes, @source_name, @source_url, @presentations, @created_by,
               @max_dose_basis, @doses_per_day)`
    )
    .run({
      ...medicationFields(m),
      presentations: JSON.stringify(normalizePresentations(m.presentations)),
      created_by: req.session.userId,
    });
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put("/medications/:id", (req, res) => {
  const m = req.body || {};
  const validationError = validateMedicationFields(m);
  if (validationError) return res.status(400).json({ error: validationError });

  const existing = db.prepare("SELECT id, presentations FROM medications WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Medicamento não encontrado." });

  // `presentations` só é sobrescrito quando o payload realmente traz o campo.
  // Um caller que não manda `presentations` (ex.: cliente desatualizado, script
  // antigo) preserva o valor já salvo em vez de apagá-lo silenciosamente.
  const presentations =
    m.presentations === undefined ? existing.presentations || "[]" : JSON.stringify(normalizePresentations(m.presentations));

  db.prepare(
    `UPDATE medications SET
       name = @name, category = @category, indication = @indication,
       dose_mg_per_kg = @dose_mg_per_kg, dose_unit = @dose_unit, frequency = @frequency,
       max_dose_mg = @max_dose_mg, route = @route, presentation = @presentation, notes = @notes,
       source_name = @source_name, source_url = @source_url, presentations = @presentations,
       max_dose_basis = @max_dose_basis, doses_per_day = @doses_per_day,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id: req.params.id,
    ...medicationFields(m),
    presentations,
  });
  res.json({ ok: true });
});

router.delete("/medications/:id", (req, res) => {
  db.prepare("DELETE FROM medications WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
