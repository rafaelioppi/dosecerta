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

router.get("/", requireAuth, (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const rows = q
    ? db
        .prepare(
          `SELECT id, name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
                  route, presentation, source_name, source_url
           FROM medications WHERE name LIKE ? OR category LIKE ? ORDER BY name`
        )
        .all(`%${q}%`, `%${q}%`)
    : db
        .prepare(
          `SELECT id, name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
                  route, presentation, source_name, source_url
           FROM medications ORDER BY name`
        )
        .all();

  res.json({ notice: SAFETY_NOTICE, items: rows });
});

router.get("/:id", requireAuth, (req, res) => {
  const med = db.prepare("SELECT * FROM medications WHERE id = ?").get(req.params.id);
  if (!med) return res.status(404).json({ error: "Medicamento não encontrado." });
  res.json({ notice: SAFETY_NOTICE, medication: med });
});

router.post("/calculate", requireAuth, (req, res) => {
  const { medicationId, weightKg } = req.body || {};
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
    },
    input: { weightKg: weight },
    result: {
      doseMg,
      cappedByMax,
      maxDoseMg: med.max_dose_mg,
    },
  });
});

module.exports = router;
