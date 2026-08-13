/**
 * routes/medications.js
 * Consulta de medicamentos e cálculo de dose — exige usuário autenticado
 * (admin ou profissional). Nenhum valor é calculado sem uma fonte registrada.
 */
const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const SAFETY_NOTICE =
  "Ferramenta de apoio à decisão clínica, com fontes citadas por medicamento. Não substitui o julgamento médico nem a bula vigente — confirme a dose antes de administrar.";

// `notes` vai junto na listagem porque 31 dos 75 itens não têm dose por kg:
// para eles a nota da fonte é o próprio resultado que a calculadora mostra,
// e não há POST /calculate a fazer (não existe peso a informar).
// `presentations` (JSON de {label, concentration_mg_per_ml}) vira array aqui,
// pra calculadora montar o seletor de concentração sem parse no cliente.
const MED_FIELDS = `id, name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
                    route, presentation, notes, source_name, source_url, presentations`;

function parsePresentations(med) {
  try {
    const p = JSON.parse(med.presentations || "[]");
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

router.get("/", requireAuth, (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const rows = q
    ? db
        .prepare(
          `SELECT ${MED_FIELDS} FROM medications WHERE name LIKE ? OR category LIKE ? ORDER BY name`
        )
        .all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT ${MED_FIELDS} FROM medications ORDER BY name`).all();

  rows.forEach((r) => (r.presentations = parsePresentations(r)));
  res.json({ notice: SAFETY_NOTICE, items: rows });
});

router.get("/:id", requireAuth, (req, res) => {
  const med = db.prepare("SELECT * FROM medications WHERE id = ?").get(req.params.id);
  if (!med) return res.status(404).json({ error: "Medicamento não encontrado." });
  med.presentations = parsePresentations(med);
  res.json({ notice: SAFETY_NOTICE, medication: med });
});

router.post("/calculate", requireAuth, (req, res) => {
  const { medicationId, weightKg, presentationIndex } = req.body || {};
  const weight = Number(weightKg);

  if (!medicationId) {
    return res.status(400).json({ error: "Informe o medicamento." });
  }
  if (!weight || weight <= 0 || weight > 150) {
    return res.status(400).json({ error: "Informe um peso válido (kg)." });
  }

  const med = db.prepare("SELECT * FROM medications WHERE id = ?").get(medicationId);
  if (!med) return res.status(404).json({ error: "Medicamento não encontrado." });

  if (med.dose_mg_per_kg == null) {
    return res.status(422).json({
      error: "Este medicamento não tem dose por kg cadastrada (ver notes). Consulte a fonte diretamente.",
      medication: med,
    });
  }

  let doseMg = Math.round(med.dose_mg_per_kg * weight * 100) / 100;
  let cappedByMax = false;
  if (med.max_dose_mg != null && doseMg > med.max_dose_mg) {
    doseMg = med.max_dose_mg;
    cappedByMax = true;
  }

  // Conversão mg -> mL quando a apresentação líquida tem concentração conhecida.
  // O cliente manda presentationIndex (índice no array presentations); o servidor
  // nunca aceita concentração arbitrária vinda do cliente — só a que está no
  // catálogo, pra não calcular volume pra uma apresentação que não existe.
  const presentations = parsePresentations(med);
  let doseMl = null;
  let presentation = null;
  if (presentations.length) {
    const idx = Number.isInteger(Number(presentationIndex)) ? Number(presentationIndex) : 0;
    presentation = presentations[idx] || presentations[0];
    if (presentation && Number(presentation.concentration_mg_per_ml) > 0) {
      doseMl = Math.round((doseMg / Number(presentation.concentration_mg_per_ml)) * 100) / 100;
    }
  }

  res.json({
    notice: SAFETY_NOTICE,
    medication: {
      id: med.id,
      name: med.name,
      category: med.category,
      frequency: med.frequency,
      route: med.route,
      presentation: med.presentation,
      source_name: med.source_name,
      source_url: med.source_url,
      notes: med.notes,
      presentations,
    },
    input: { weightKg: weight, presentationIndex: presentation ? presentations.indexOf(presentation) : null },
    result: {
      doseMg,
      doseMl,
      cappedByMax,
      maxDoseMg: med.max_dose_mg,
      presentation: presentation || null,
    },
  });
});

module.exports = router;
