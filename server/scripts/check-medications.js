/**
 * scripts/check-medications.js
 * Auditoria offline do catálogo (seed/medications.json) — só conferência
 * interna de consistência dos dados já cadastrados, NÃO valida contra a
 * internet (não confirma se a bula ainda diz o mesmo, não checa se a URL
 * da fonte ainda responde). Isso é responsabilidade de revisão humana
 * periódica; este script pega o que dá pra pegar sem sair da máquina:
 * campo faltando, número fora de faixa plausível, inconsistência entre
 * campos, duplicata, categoria com grafia divergente etc.
 *
 * Uso: node server/scripts/check-medications.js
 * Saída: relatório no console + exit code 1 se achou algo em nível "erro".
 */
const fs = require("fs");
const path = require("path");

const SEED_PATH = path.join(__dirname, "..", "..", "seed", "medications.json");
const meds = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));

const errors = []; // problema real de dado — bloqueia
const warnings = []; // merece revisão humana, mas não é necessariamente erro

const ROUTE_VOCAB = [
  "oral", "IV", "IM", "tópica", "tópica (mucosa oral)", "tópica (aplicação profissional em consultório)",
  "inalatória", "inalatória (nebulização)", "inalatória (máscara nasal)",
  "infiltração/bloqueio odontológico", "IV (ou retal se acesso venoso não disponível)",
  "IV (via retal como alternativa se não houver acesso venoso)",
  "oral (ou IV/IM em infecções graves)", "IM profunda",
  "tópica (bochecho ou aplicação em gel com gaze/cotonete)",
  "oral (também usado por via tópica exclusivamente local: bochecho 4,8-10% ou gel bioadesivo 8%)",
  "oral (bochechar e manter na boca antes de engolir)",
  "tópica oral (aplicar sobre a lesão, manter na boca o máximo possível antes de engolir)",
  "oral tópica",
  "intranasal (cetamina) + oral (midazolam)",
];

function flag(list, item, msg) {
  list.push(`[${item.name || "(sem nome)"}] ${msg}`);
}

// ---- 1. Campos obrigatórios ----
meds.forEach((m) => {
  ["name", "category", "source_name", "source_url"].forEach((field) => {
    if (!m[field] || !String(m[field]).trim()) errors.push(`[${m.name || "?"}] campo obrigatório vazio: ${field}`);
  });
});

// ---- 2. source_url tem formato de URL (sem checar se responde) ----
meds.forEach((m) => {
  if (m.source_url && !/^https?:\/\/[^\s]+\.[^\s]+/.test(m.source_url)) {
    flag(errors, m, `source_url não parece uma URL válida: "${m.source_url}"`);
  }
});

// ---- 3. Nomes duplicados (o seed.js dedup por nome — dois itens com o
//         mesmo nome aqui significa que um deles nunca vai pro banco) ----
const nameCounts = {};
meds.forEach((m) => { nameCounts[m.name] = (nameCounts[m.name] || 0) + 1; });
Object.entries(nameCounts).forEach(([name, count]) => {
  if (count > 1) errors.push(`[${name}] aparece ${count}x no seed — só a primeira ocorrência vai pro banco`);
});

// ---- 4. dose_mg_per_kg em faixa plausível quando presente ----
meds.forEach((m) => {
  if (m.dose_mg_per_kg != null) {
    if (typeof m.dose_mg_per_kg !== "number" || Number.isNaN(m.dose_mg_per_kg)) {
      errors.push(`[${m.name}] dose_mg_per_kg não é número: ${JSON.stringify(m.dose_mg_per_kg)}`);
    } else if (m.dose_mg_per_kg <= 0) {
      errors.push(`[${m.name}] dose_mg_per_kg <= 0 (${m.dose_mg_per_kg})`);
    } else if (m.dose_mg_per_kg > 200) {
      flag(warnings, m, `dose_mg_per_kg = ${m.dose_mg_per_kg} — incomum, confirmar não é erro de digitação (ex.: 100x a mais)`);
    }
  }
});

// ---- 5. max_dose_mg em faixa plausível quando presente ----
meds.forEach((m) => {
  if (m.max_dose_mg != null) {
    if (typeof m.max_dose_mg !== "number" || Number.isNaN(m.max_dose_mg)) {
      errors.push(`[${m.name}] max_dose_mg não é número: ${JSON.stringify(m.max_dose_mg)}`);
    } else if (m.max_dose_mg <= 0) {
      errors.push(`[${m.name}] max_dose_mg <= 0 (${m.max_dose_mg})`);
    }
  }
});

// ---- 6. Um paciente de 3 kg já bateria no teto? (sinal de que o teto ou
//         a dose/kg podem estar trocados/errados) ----
meds.forEach((m) => {
  if (m.dose_mg_per_kg != null && m.max_dose_mg != null) {
    const doseAt3kg = m.dose_mg_per_kg * 3;
    if (doseAt3kg > m.max_dose_mg) {
      flag(warnings, m, `dose_mg_per_kg (${m.dose_mg_per_kg}) × 3kg = ${doseAt3kg} já ultrapassa max_dose_mg (${m.max_dose_mg}) — confirmar se o teto é por DOSE ou por DIA e se bate com dose_unit/frequency`);
    }
  }
});

// ---- 7. Regra de consistência "contraindicado" ----
meds.forEach((m) => {
  const isContraindicated = /contraindicad/i.test(m.category);
  if (isContraindicated && m.dose_mg_per_kg != null) {
    errors.push(`[${m.name}] categoria diz "contraindicado" mas tem dose_mg_per_kg=${m.dose_mg_per_kg} cadastrada — isso faria a calculadora sugerir uma dose pra algo que não deveria ter dose sugerida`);
  }
  if (isContraindicated && (!m.notes || m.notes.length < 30)) {
    flag(warnings, m, `categoria "contraindicado" mas notes ausente/curta — o alerta de segurança depende desse texto`);
  }
});

// ---- 8. Item sem dose_mg_per_kg deveria ter notes explicando o porquê ----
meds.forEach((m) => {
  if (m.dose_mg_per_kg == null && (!m.notes || !m.notes.trim())) {
    flag(warnings, m, `sem dose_mg_per_kg e sem notes — a calculadora vai devolver "ver notas" sem ter nada pra mostrar`);
  }
});

// ---- 9. Categoria: grafias divergentes (case/espaço/travessão) ----
const categories = [...new Set(meds.map((m) => m.category))];
const normalized = {};
categories.forEach((c) => {
  const key = c.toLowerCase().replace(/[\s\-–—]+/g, " ").trim();
  (normalized[key] = normalized[key] || []).push(c);
});
Object.values(normalized).forEach((variants) => {
  if (variants.length > 1) {
    warnings.push(`Categoria com grafias diferentes que provavelmente deveriam ser uma só: ${variants.map((v) => `"${v}"`).join(" vs ")}`);
  }
});

// ---- 10. route fora do vocabulário conhecido (só aviso — vocabulário pode crescer) ----
meds.forEach((m) => {
  if (m.route && !ROUTE_VOCAB.includes(m.route)) {
    flag(warnings, m, `route fora do vocabulário já visto: "${m.route}" — confirmar que não é grafia nova de algo existente`);
  }
});

// ---- 11. Espaço duplo / espaço nas pontas em campos de texto ----
["name", "category", "indication", "notes", "source_name"].forEach((field) => {
  meds.forEach((m) => {
    const v = m[field];
    if (typeof v === "string") {
      if (v !== v.trim()) flag(warnings, m, `campo "${field}" tem espaço sobrando no início/fim`);
      if (/ {2,}/.test(v)) flag(warnings, m, `campo "${field}" tem espaço duplo`);
    }
  });
});

// ---- Relatório ----
console.log(`\nAuditoria offline de ${meds.length} medicamentos (${SEED_PATH})\n`);

console.log(`Categorias distintas (${categories.length}):`);
categories.sort().forEach((c) => console.log(`  · ${c} — ${meds.filter((m) => m.category === c).length} item(ns)`));

console.log(`\n❌ Erros (${errors.length}) — dado inconsistente, corrigir:`);
errors.forEach((e) => console.log(`  - ${e}`));
if (!errors.length) console.log("  (nenhum)");

console.log(`\n⚠️  Avisos (${warnings.length}) — vale revisão humana, não necessariamente errado:`);
warnings.forEach((w) => console.log(`  - ${w}`));
if (!warnings.length) console.log("  (nenhum)");

console.log(`\nResumo: ${meds.length} itens, ${categories.length} categorias, ${errors.length} erro(s), ${warnings.length} aviso(s).\n`);

process.exit(errors.length ? 1 : 0);
