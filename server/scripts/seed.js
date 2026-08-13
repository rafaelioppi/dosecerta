/**
 * scripts/seed.js
 * Popula medications a partir de seed/medications.json. Idempotente: pode ser
 * rodado de novo com segurança — só insere o que ainda não existe (dedup por
 * nome), pra não sobrescrever edições feitas pelo admin.
 */
const fs = require("fs");
const path = require("path");
const db = require("../db");

const SEED_DIR = path.join(__dirname, "..", "..", "seed");

function seedMedications() {
  const meds = JSON.parse(fs.readFileSync(path.join(SEED_DIR, "medications.json"), "utf8"));
  const exists = db.prepare("SELECT id FROM medications WHERE name = ?");
  const insert = db.prepare(
    `INSERT INTO medications
      (name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
       route, presentation, notes, source_name, source_url, presentations)
     VALUES (@name, @category, @indication, @dose_mg_per_kg, @dose_unit, @frequency, @max_dose_mg,
             @route, @presentation, @notes, @source_name, @source_url, @presentations)`
  );
  const backfill = db.prepare(
    `UPDATE medications SET presentations = ? WHERE id = ? AND (presentations IS NULL OR presentations = '')`
  );

  const toJson = (m) => JSON.stringify(Array.isArray(m.presentations) ? m.presentations : []);

  let inserted = 0;
  let skipped = 0;
  let backfilled = 0;
  db.withTransaction(() => {
    for (const m of meds) {
      const existing = exists.get(m.name);
      if (existing) {
        skipped++;
        // Backfill não-destrutivo: preenche presentations só se o registro no
        // banco ainda não tiver nenhuma (nunca sobrescreve edição do admin).
        const result = backfill.run(toJson(m), existing.id);
        if (result.changes) backfilled++;
        continue;
      }
      insert.run({
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
        presentations: toJson(m),
      });
      inserted++;
    }
  });
  console.log(
    `medications: ${inserted} inseridos, ${skipped} já existiam, ${backfilled} com presentations preenchidas (backfill não-destrutivo).`
  );
}

seedMedications();
console.log("Seed concluído.");
