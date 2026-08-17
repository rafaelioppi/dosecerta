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

// Itens que o seed.js já cadastrou no passado com um nome que foi depois
// desmembrado em outros (ex.: "Ondansetrona injetável" tinha dois esquemas de
// bula — quimioterapia e pós-operatório — misturados num único dose_mg_per_kg/
// max_dose_mg; virou dois itens em 16/ago/2026). O dedup por nome do seed não
// mexe em linha antiga com nome diferente do novo, então ela ficaria órfã no
// banco (visível na calculadora com o dado velho e ambíguo) se não for limpa
// explicitamente aqui — só roda de fato na primeira vez, depois é no-op.
const SUPERSEDED_NAMES = ["Ondansetrona (injetável)"];

function seedMedications() {
  const meds = JSON.parse(fs.readFileSync(path.join(SEED_DIR, "medications.json"), "utf8"));
  const exists = db.prepare("SELECT id FROM medications WHERE name = ?");
  const insert = db.prepare(
    `INSERT INTO medications
      (name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
       route, presentation, notes, source_name, source_url, presentations,
       max_dose_basis, doses_per_day)
     VALUES (@name, @category, @indication, @dose_mg_per_kg, @dose_unit, @frequency, @max_dose_mg,
             @route, @presentation, @notes, @source_name, @source_url, @presentations,
             @max_dose_basis, @doses_per_day)`
  );
  const backfill = db.prepare(
    `UPDATE medications SET presentations = ? WHERE id = ? AND (presentations IS NULL OR presentations = '')`
  );
  // Backfill não-destrutivo dos dois campos novos (max_dose_basis / doses_per_day)
  // nos registros que já existiam no banco antes desta migração — mesmo
  // critério do backfill de presentations: só preenche quem está NULL, nunca
  // sobrescreve valor já setado (edição manual do admin, se houver, prevalece).
  const backfillBasis = db.prepare(
    `UPDATE medications SET max_dose_basis = ? WHERE id = ? AND max_dose_basis IS NULL`
  );
  const backfillDosesPerDay = db.prepare(
    `UPDATE medications SET doses_per_day = ? WHERE id = ? AND doses_per_day IS NULL`
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
        // banco ainda não tiver nenhuma (nunca sobrescreve edição do admin) E
        // só quando o seed realmente trouxer dado novo — gravar '[]' quando o
        // seed não tem presentations ainda "usaria" o slot vazio e bloquearia
        // pra sempre um backfill futuro (a coluna deixaria de ser NULL/'').
        const hasPresentations = Array.isArray(m.presentations) && m.presentations.length > 0;
        if (hasPresentations) {
          const result = backfill.run(toJson(m), existing.id);
          if (result.changes) backfilled++;
        }
        if (m.max_dose_basis != null) backfillBasis.run(m.max_dose_basis, existing.id);
        if (m.doses_per_day != null) backfillDosesPerDay.run(m.doses_per_day, existing.id);
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
        max_dose_basis: m.max_dose_basis ?? null,
        doses_per_day: m.doses_per_day ?? null,
      });
      inserted++;
    }
  });

  let superseded = 0;
  db.withTransaction(() => {
    for (const name of SUPERSEDED_NAMES) {
      // Lista curada acima: só entra aqui um nome que o seed.js atual já não
      // usa mais (foi desmembrado em outro(s) item(ns) já inseridos). Remover
      // por nome exato é seguro porque o dedup deste script nunca recria uma
      // linha com esse nome de novo (não está mais em seed/medications.json).
      const result = db.prepare("DELETE FROM medications WHERE name = ?").run(name);
      superseded += result.changes;
    }
  });

  console.log(
    `medications: ${inserted} inseridos, ${skipped} já existiam, ${backfilled} com presentations preenchidas (backfill não-destrutivo), ${superseded} nome(s) antigo(s) removido(s) por desmembramento.`
  );
}

seedMedications();
console.log("Seed concluído.");
