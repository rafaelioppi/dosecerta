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
  "oral (ou IV se rebaixamento de consciência)",
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
// Mesma lógica de detecção usada em public/calculadora.html (categoryFlag):
// minúsculo + sem acento + substring "contraindicado". Mantida em sincronia
// de propósito — as duas decidem a mesma coisa (é ou não contraindicado) e
// precisam concordar, senão o auditor offline pode aprovar uma categoria que
// a calculadora ao vivo trataria como alerta de segurança, ou vice-versa.
function isContraindicatedCategory(category) {
  const norm = String(category ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return norm.includes("contraindicado");
}

meds.forEach((m) => {
  const isContraindicated = isContraindicatedCategory(m.category);
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

// ---- 10b. presentations: formato e coerência com dose_mg_per_kg ----
meds.forEach((m) => {
  const pres = m.presentations;
  if (pres == null) return; // ausente = sem apresentações líquidas (ok, resultado em mg)
  if (!Array.isArray(pres)) {
    errors.push(`[${m.name}] presentations não é array`);
    return;
  }
  const names = new Set();
  pres.forEach((p, i) => {
    if (!p || typeof p !== "object") {
      errors.push(`[${m.name}] presentations[${i}] não é objeto`);
      return;
    }
    if (!p.label || !String(p.label).trim()) {
      errors.push(`[${m.name}] presentations[${i}] sem label`);
    }
    const c = Number(p.concentration_mg_per_ml);
    if (!Number.isFinite(c) || c <= 0) {
      errors.push(`[${m.name}] presentations[${i}] concentração inválida: ${JSON.stringify(p.concentration_mg_per_ml)}`);
    }
    const normLabel = String(p.label || "").trim().toLowerCase();
    if (names.has(normLabel)) {
      errors.push(`[${m.name}] presentations com label duplicado: "${p.label}"`);
    }
    names.add(normLabel);
  });
  // Apresentação líquida com concentração faz sentido só onde há dose por kg:
  // sem dose_mg_per_kg a calculadora não converte mg->mL (mostra a regra).
  if (pres.length && m.dose_mg_per_kg == null) {
    flag(warnings, m, `tem presentations mas dose_mg_per_kg é nulo — a calculadora não usará estas concentrações (item vai pra "ver notas")`);
  }
});

// ---- 10c. presentations em texto livre deveria ter concentração estruturada ----
// Só aviso: se o campo presentation (texto) cita mg/mL mas não há presentations
// cadastradas, a calculadora cai em mg — pode ser omissão (ex.: frasco que a
// bula descreve e que deveria virar linha no seletor).
meds.forEach((m) => {
  const pres = Array.isArray(m.presentations) ? m.presentations : [];
  if (!pres.length && m.presentation && /mg\s*\/\s*5?\s*mL|mg\/mL|%\s*\(/i.test(m.presentation) && m.dose_mg_per_kg != null) {
    flag(warnings, m, `apresentação em texto cita concentração mas presentations está vazio — resultado continuará em mg; conferir se deveria ter linhas de mL`);
  }
});

// ---- 11a. max_dose_basis obrigatório sempre que dá pra aplicar teto ----
// Achado da auditoria de 16/ago/2026: sem esse campo, o servidor não sabia
// se max_dose_mg era teto por TOMADA ou por DIA e cortava sempre no valor
// por tomada — errado em pelo menos 5 itens (Ibuprofeno, Claritromicina,
// Domperidona, Dimenidrinato gotas, Hidroxizina) para pesos dentro da própria
// faixa aceita pela calculadora (0,5-150 kg).
const VALID_BASIS = ["per_dose", "per_day", "per_session"];
meds.forEach((m) => {
  if (m.dose_mg_per_kg != null && m.max_dose_mg != null) {
    if (!m.max_dose_basis) {
      errors.push(`[${m.name}] tem dose_mg_per_kg e max_dose_mg mas não tem max_dose_basis — o servidor não vai saber se o teto é por dose, por dia ou por sessão`);
    } else if (!VALID_BASIS.includes(m.max_dose_basis)) {
      errors.push(`[${m.name}] max_dose_basis="${m.max_dose_basis}" fora do vocabulário (${VALID_BASIS.join(", ")})`);
    }
  }
});

// ---- 11b. peso no teto da faixa aceita (150 kg) também bate o teste dose×dia ----
// A checagem #6 usava só 3 kg — pega erro na ponta de baixo, mas os casos reais
// de teto por dose confundido com teto por tomada acontecem na ponta de CIMA
// (crianças/adolescentes grandes, ainda dentro dos 150 kg que a calculadora aceita).
const CALC_MAX_WEIGHT_KG = 150;
meds.forEach((m) => {
  if (m.dose_mg_per_kg != null && m.max_dose_mg != null) {
    const doseAtMaxWeight = m.dose_mg_per_kg * CALC_MAX_WEIGHT_KG;
    const reachable = doseAtMaxWeight > m.max_dose_mg;
    const unitIsDaily = /\/dia/i.test(m.dose_unit || "");
    if (reachable && !unitIsDaily && m.max_dose_basis === "per_day" && m.doses_per_day == null) {
      errors.push(`[${m.name}] max_dose_basis="per_day" mas dose_unit não é "/dia" e doses_per_day está vazio — o servidor não consegue converter o teto diário num valor por tomada nesse item`);
    }
  }
});

// ---- 11c. apresentação sólida (comprimido/cápsula) não pode ter mg/mL ----
// Achado nº4 da auditoria: "Comprimido 250 mg" com concentration_mg_per_ml
// fazia a calculadora dividir a dose por 250 e devolver o resultado em
// mililitros de um comprimido sólido.
meds.forEach((m) => {
  (Array.isArray(m.presentations) ? m.presentations : []).forEach((p, i) => {
    if (p && /comprimido|c[áa]psula/i.test(p.label || "") && p.concentration_mg_per_ml != null) {
      errors.push(`[${m.name}] presentations[${i}] ("${p.label}") é forma sólida mas tem concentration_mg_per_ml=${p.concentration_mg_per_ml} — a calculadora vai devolver "mL" de um comprimido/cápsula`);
    }
  });
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

// Uma passada só pro relatório de contagem por categoria, em vez de refiltrar
// o array inteiro uma vez por categoria (O(categorias × meds)).
const categoryCounts = new Map();
meds.forEach((m) => categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1));

console.log(`Categorias distintas (${categories.length}):`);
categories.sort().forEach((c) => console.log(`  · ${c} — ${categoryCounts.get(c)} item(ns)`));

console.log(`\n❌ Erros (${errors.length}) — dado inconsistente, corrigir:`);
errors.forEach((e) => console.log(`  - ${e}`));
if (!errors.length) console.log("  (nenhum)");

console.log(`\n⚠️  Avisos (${warnings.length}) — vale revisão humana, não necessariamente errado:`);
warnings.forEach((w) => console.log(`  - ${w}`));
if (!warnings.length) console.log("  (nenhum)");

console.log(`\nResumo: ${meds.length} itens, ${categories.length} categorias, ${errors.length} erro(s), ${warnings.length} aviso(s).\n`);

process.exit(errors.length ? 1 : 0);
