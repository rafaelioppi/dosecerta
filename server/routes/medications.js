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

// `notes` vai junto na listagem porque 45 dos 76 itens não têm dose por kg:
// para eles a nota da fonte é o próprio resultado que a calculadora mostra,
// e não há POST /calculate a fazer (não existe peso a informar).
// `presentations` (JSON de {label, concentration_mg_per_ml}) vira array aqui,
// pra calculadora montar o seletor de concentração sem parse no cliente.
// `max_dose_basis`/`doses_per_day`: ver comentário em db.js — sem eles o
// servidor não distinguia teto por TOMADA de teto por DIA (auditoria de
// 16/ago/2026 achou 5 itens em que isso invertia o valor mostrado).
const MED_FIELDS = `id, name, category, indication, dose_mg_per_kg, dose_unit, frequency, max_dose_mg,
                    route, presentation, notes, source_name, source_url, presentations,
                    max_dose_basis, doses_per_day`;

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
  const { medicationId, weightKg, presentationIndex, confirmed } = req.body || {};
  const weight = Number(weightKg);

  if (!medicationId) {
    return res.status(400).json({ error: "Informe o medicamento." });
  }
  // O checkbox "revisei indicação, peso, apresentação e frequência" (UI) só
  // valia como gate no cliente — uma chamada direta à API pulava o passo
  // inteiro sem aviso. Isto não confirma que a revisão realmente aconteceu
  // (é um campo auto-declarado, como o próprio checkbox já era), mas fecha a
  // lacuna de uma integração/chamada direta ignorar o gate silenciosamente.
  if (confirmed !== true) {
    return res.status(400).json({ error: "Confirme a revisão clínica antes de calcular (campo 'confirmed')." });
  }
  if (!weight || weight < 0.5 || weight > 150) {
    return res.status(400).json({ error: "Informe um peso válido entre 0,5 e 150 kg." });
  }

  const med = db.prepare("SELECT * FROM medications WHERE id = ?").get(medicationId);
  if (!med) return res.status(404).json({ error: "Medicamento não encontrado." });

  if (med.dose_mg_per_kg == null) {
    return res.status(422).json({
      error: "Este medicamento não tem dose por kg cadastrada (ver notes). Consulte a fonte diretamente.",
      medication: med,
    });
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  // rawMg é o valor cru de dose_mg_per_kg × peso, na unidade que dose_unit
  // descreve (pode ser "por tomada" ou "por dia" — não dá pra saber só
  // olhando o número, por isso unitIsDaily abaixo).
  const rawMg = round2(med.dose_mg_per_kg * weight);
  const unitIsDaily = /\/dia/i.test(String(med.dose_unit || ""));
  const dosesPerDay = med.doses_per_day != null ? Number(med.doses_per_day) : null;

  // perDoseRawMg / dailyRawMg: os dois jeitos de ler o mesmo cálculo, sem
  // teto aplicado ainda. Quando dosesPerDay é desconhecido e a unidade não
  // bate com o que max_dose_basis precisa, o lado que falta fica null — é
  // melhor não adivinhar do que aplicar um teto na base errada (ver
  // auditoria de 16/ago/2026: aplicar teto DIÁRIO direto num valor POR
  // TOMADA inflava a dose de Ibuprofeno, Claritromicina, Domperidona,
  // Dimenidrinato gotas e Hidroxizina em pesos dentro da própria faixa
  // aceita pela calculadora).
  let perDoseRawMg = unitIsDaily ? (dosesPerDay ? round2(rawMg / dosesPerDay) : null) : rawMg;
  let dailyRawMg = unitIsDaily ? rawMg : (dosesPerDay ? round2(rawMg * dosesPerDay) : null);

  const basis = med.max_dose_basis || null; // 'per_dose' | 'per_day' | 'per_session' | null
  let cappedByMax = false;
  let perDoseMg = perDoseRawMg;
  let dailyMg = dailyRawMg;

  if (med.max_dose_mg != null) {
    const maxMg = Number(med.max_dose_mg);
    if (basis === "per_day") {
      // Teto é do dia inteiro: só corta se a gente sabe repartir por
      // tomada (dosesPerDay); sem isso, não há como derivar um valor por
      // tomada seguro a partir de um teto diário.
      if (dailyRawMg != null && dailyRawMg > maxMg) {
        cappedByMax = true;
        dailyMg = maxMg;
        perDoseMg = dosesPerDay ? round2(maxMg / dosesPerDay) : null;
      }
    } else {
      // 'per_dose', 'per_session' ou sem basis cadastrado (compatibilidade):
      // o teto se aplica direto no valor por tomada — comportamento igual
      // ao anterior, que já estava correto para esses casos.
      if (perDoseRawMg != null && perDoseRawMg > maxMg) {
        cappedByMax = true;
        perDoseMg = maxMg;
        dailyMg = dosesPerDay ? round2(maxMg * dosesPerDay) : dailyRawMg;
      }
    }
  }

  // Conversão mg -> mL quando a apresentação líquida tem concentração conhecida.
  // O cliente manda presentationIndex (índice no array presentations); o servidor
  // nunca aceita concentração arbitrária vinda do cliente — só a que está no
  // catálogo, pra não calcular volume pra uma apresentação que não existe.
  const presentations = parsePresentations(med);
  let doseMl = null;
  let dailyMl = null;
  let presentation = null;
  if (presentations.length) {
    const idx = Number.isInteger(Number(presentationIndex)) ? Number(presentationIndex) : 0;
    presentation = presentations[idx] || presentations[0];
    const conc = presentation ? Number(presentation.concentration_mg_per_ml) : 0;
    if (conc > 0) {
      if (perDoseMg != null) doseMl = round2(perDoseMg / conc);
      if (dailyMg != null) dailyMl = round2(dailyMg / conc);
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
      // doseMg/doseMl = valor POR TOMADA, já com o teto aplicado (o número
      // que se administra de uma vez). null quando a fonte é mg/kg/dia e não
      // diz quantas tomadas/dia tem — nesse caso só dailyMg é confiável.
      doseMg: perDoseMg,
      doseMl,
      // dailyMg/dailyMl = total do dia (soma das tomadas), pra mostrar a
      // conta e comparar com o teto sem confundir as duas grandezas.
      dailyMg,
      dailyMl,
      dosesPerDay,
      cappedByMax,
      maxDoseMg: med.max_dose_mg,
      maxDoseBasis: basis,
      presentation: presentation || null,
    },
  });
});

module.exports = router;
