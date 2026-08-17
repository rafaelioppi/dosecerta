/**
 * admin/app.js
 * CRUD de usuários e do catálogo de medicamentos. Protegido por
 * dosecertaRequireAuth('admin').
 */
dosecertaRequireAuth("admin");

initTabs();

document.addEventListener("dosecerta:session", (e) => {
  if (e.detail && e.detail.role === "admin") {
    document.getElementById("admin-app").hidden = false;
    loadUsers();
    loadMeds();
  }
});

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("is-active");
    });
  });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Abre um card de formulário (usuário ou medicamento): revela, rola o painel
// até ele e foca o primeiro campo. Um único helper pros dois formulários —
// um ajuste de UX (offset de rolagem, foco) vale pros dois de uma vez.
function openFormCard(cardId, panelId, focusId) {
  document.getElementById(cardId).hidden = false;
  window.scrollTo({ top: document.getElementById(panelId).offsetTop - 100, behavior: "smooth" });
  document.getElementById(focusId).focus();
}

// POST (criar) ou PUT (editar) com o mesmo tratamento de sucesso/erro pros
// dois formulários admin — inclusive falha de rede, que nenhum dos dois
// tratava antes (um fetch() rejeitado por rede fora derrubava o handler sem
// aviso nenhum ao usuário).
async function submitForm({ id, baseUrl, payload, status, onSuccess }) {
  const url = id ? `${baseUrl}/${id}` : baseUrl;
  const method = id ? "PUT" : "POST";
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
  } catch {
    status.textContent = "Falha de conexão com o servidor. Tente novamente.";
    status.classList.add("error");
    return;
  }
  if (res.ok) {
    onSuccess();
  } else {
    const body = await res.json().catch(() => ({}));
    status.textContent = body.error || "Falha ao salvar.";
    status.classList.add("error");
  }
}

// Apresentações líquidas: array [{label, concentration_mg_per_ml}] <-> textarea
// no formato "rótulo | mg/mL" (uma linha por apresentação). A calculadora usa
// estas concentrações pra mostrar o resultado em mL.
function serializePresentations(value) {
  let arr = value;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) arr = [];
  return arr
    .map((p) => {
      const c = Number(p.concentration_mg_per_ml);
      return `${p.label || ""} | ${Number.isFinite(c) ? c : ""}`.trim();
    })
    .filter(Boolean)
    .join("\n");
}

// Retorna { presentations, invalidLines } em vez de descartar silenciosamente
// linhas com concentração vazia/inválida — o admin precisa ver que uma linha
// não foi salva, em vez de achar que salvou e descobrir semanas depois que a
// calculadora não tem aquela concentração.
function parsePresentationsText(text) {
  const presentations = [];
  const invalidLines = [];
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split("|");
      if (parts.length < 2 || !parts[0].trim()) {
        invalidLines.push(line);
        return;
      }
      const conc = Number(String(parts[1] ?? "").trim().replace(",", "."));
      if (!Number.isFinite(conc) || conc <= 0) {
        invalidLines.push(line);
        return;
      }
      presentations.push({ label: parts[0].trim(), concentration_mg_per_ml: conc });
    });
  return { presentations, invalidLines };
}

/* ===== Usuários ===== */
// Cache em memória da última carga: os filtros (busca/papel) rodam sobre ela
// sem refazer o fetch, e o resumo (stat cards) também lê daqui.
let allUsers = [];

async function loadUsers() {
  const res = await fetch("/api/admin/users", { credentials: "same-origin" });
  if (!res.ok) return;
  allUsers = await res.json();
  renderUserStats();
  renderUsers();
}

function renderUserStats() {
  const admins = allUsers.filter((u) => u.role === "admin").length;
  document.getElementById("stat-users-total").textContent = allUsers.length;
  document.getElementById("stat-users-breakdown").textContent = `${admins} admin${admins === 1 ? "" : "s"} · ${
    allUsers.length - admins
  } profissional(is)`;
}

function userRow(u) {
  return `
    <tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${u.council_type || u.council_number ? escapeHtml([u.council_type, u.council_number].filter(Boolean).join(" ")) : "—"}</td>
      <td>${new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn--ghost btn--sm" data-edit-user="${u.id}">Editar</button>
      </td>
    </tr>`;
}

// Reaplica busca (nome/e-mail) + filtro de papel sobre allUsers e separa o
// resultado em duas tabelas (Admins / Profissionais) em vez de uma lista
// única misturando os dois papéis.
function renderUsers() {
  const term = document.getElementById("user-search").value.trim().toLowerCase();
  const roleFilter = document.getElementById("user-role-filter").value;

  const filtered = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (!term) return true;
    return (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
  });

  const admins = filtered.filter((u) => u.role === "admin");
  const professionals = filtered.filter((u) => u.role !== "admin");

  document.getElementById("users-admin-tbody").innerHTML = admins.map(userRow).join("");
  document.getElementById("users-professional-tbody").innerHTML = professionals.map(userRow).join("");
  document.getElementById("users-empty").hidden = filtered.length > 0;

  document.querySelectorAll("[data-edit-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = allUsers.find((u) => String(u.id) === btn.dataset.editUser);
      fillUserForm(user);
    });
  });
}

document.getElementById("user-search").addEventListener("input", renderUsers);
document.getElementById("user-role-filter").addEventListener("change", renderUsers);

function openUserForm() {
  openFormCard("user-form-card", "panel-users", "user-name");
}

function closeUserForm() {
  document.getElementById("user-form-card").hidden = true;
  resetUserForm();
}

// Editar usuário existente: é o único jeito de resetar a senha de alguém que
// esqueceu — a senha some do formulário (não dá pra mostrar a atual, só o
// hash fica salvo) e fica opcional: em branco, mantém a senha de antes.
function fillUserForm(user) {
  document.getElementById("user-form-title").textContent = "Editar usuário";
  document.getElementById("user-id").value = user.id;
  document.getElementById("user-name").value = user.name || "";
  document.getElementById("user-email").value = user.email || "";
  document.getElementById("user-role").value = user.role || "professional";
  document.getElementById("user-council-type").value = user.council_type || "";
  document.getElementById("user-council-number").value = user.council_number || "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-password").required = false;
  document.getElementById("user-password-label").textContent = "Nova senha (opcional)";
  document.getElementById("user-password-hint").textContent =
    'Deixe em branco pra manter a senha atual. Pra resetar, digite uma nova (mín. 8 caracteres) ou use "Gerar senha".';
  setPasswordVisible(false);
  openUserForm();
}

function resetUserForm() {
  document.getElementById("user-form-title").textContent = "Adicionar usuário";
  document.getElementById("user-id").value = "";
  document.getElementById("user-name").value = "";
  document.getElementById("user-email").value = "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-password").required = true;
  document.getElementById("user-password-label").textContent = "Senha *";
  document.getElementById("user-password-hint").textContent =
    'Mínimo 8 caracteres. Use "Gerar senha" pra uma senha forte já visível, pronta pra copiar e enviar.';
  document.getElementById("user-role").value = "professional";
  document.getElementById("user-council-type").value = "";
  document.getElementById("user-council-number").value = "";
  setPasswordVisible(false);
}

function setPasswordVisible(visible) {
  const input = document.getElementById("user-password");
  const toggle = document.getElementById("user-password-toggle");
  input.type = visible ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(visible));
  toggle.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
}

document.getElementById("user-password-toggle").addEventListener("click", () => {
  const input = document.getElementById("user-password");
  setPasswordVisible(input.type === "password");
});

// Gera uma senha forte e já deixa visível — o ponto de digitar uma senha às
// cegas e não saber se acertou some quando é a própria página que gera.
document.getElementById("user-password-generate").addEventListener("click", () => {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  const password = Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
  document.getElementById("user-password").value = password;
  setPasswordVisible(true);
});

document.getElementById("user-add-btn").addEventListener("click", () => {
  resetUserForm();
  openUserForm();
});

document.getElementById("user-cancel").addEventListener("click", closeUserForm);

document.getElementById("user-save").addEventListener("click", async () => {
  const status = document.getElementById("user-status");
  status.textContent = "";
  status.className = "form-status";

  const id = document.getElementById("user-id").value;
  const password = document.getElementById("user-password").value;

  const payload = {
    name: document.getElementById("user-name").value.trim(),
    email: document.getElementById("user-email").value.trim(),
    password,
    role: document.getElementById("user-role").value,
    councilType: document.getElementById("user-council-type").value.trim() || null,
    councilNumber: document.getElementById("user-council-number").value.trim() || null,
  };

  if (!payload.name || !payload.email) {
    status.textContent = "Nome e e-mail são obrigatórios.";
    status.classList.add("error");
    return;
  }
  // Criando: senha é obrigatória. Editando: só valida se digitou algo.
  if (!id && !payload.password) {
    status.textContent = "Nome, e-mail e senha são obrigatórios.";
    status.classList.add("error");
    return;
  }
  if (payload.password && payload.password.length < 8) {
    status.textContent = "A senha deve ter pelo menos 8 caracteres.";
    status.classList.add("error");
    return;
  }
  if (!payload.password) delete payload.password; // editando sem trocar senha

  await submitForm({
    id,
    baseUrl: "/api/admin/users",
    payload,
    status,
    onSuccess: () => {
      closeUserForm();
      loadUsers();
    },
  });
});

// Igual à regra de save ([app.js] med-save) e ao check-medications.js: dose
// + teto preenchidos sem "teto é por..." é o bug que já mordeu 5 medicamentos
// (ver memória max-dose-basis-schema) — a listagem precisa deixar isso visível
// sem precisar abrir cada medicamento pra editar.
function medHasBasisIssue(m) {
  return m.dose_mg_per_kg != null && m.max_dose_mg != null && !m.max_dose_basis;
}

const MAX_BASIS_LABELS = { per_dose: "Tomada", per_day: "Dia", per_session: "Sessão" };

let allMeds = [];

async function loadMeds() {
  const res = await fetch("/api/admin/medications", { credentials: "same-origin" });
  if (!res.ok) return;
  allMeds = await res.json();
  populateCategoryFilter();
  renderMedStats();
  renderMeds();
}

function populateCategoryFilter() {
  const select = document.getElementById("med-category-filter");
  const current = select.value;
  const categories = [...new Set(allMeds.map((m) => m.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  select.innerHTML =
    `<option value="">Todas as categorias</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (categories.includes(current)) select.value = current;
}

function renderMedStats() {
  const categories = new Set(allMeds.map((m) => m.category).filter(Boolean));
  const issues = allMeds.filter(medHasBasisIssue).length;
  document.getElementById("stat-meds-total").textContent = allMeds.length;
  document.getElementById("stat-meds-categories").textContent = `${categories.size} categoria(s)`;
  document.getElementById("stat-meds-issues-card").hidden = issues === 0;
  document.getElementById("stat-meds-issues").textContent = issues;
}

function medRow(m) {
  const issue = medHasBasisIssue(m);
  const basisTag = m.max_dose_basis
    ? `<span class="tag">${MAX_BASIS_LABELS[m.max_dose_basis] || escapeHtml(m.max_dose_basis)}</span>`
    : issue
    ? `<span class="tag tag--warning">Faltando</span>`
    : "—";
  return `
    <tr${issue ? ' data-flag="warning"' : ""}>
      <td>${escapeHtml(m.name)}</td>
      <td>${m.dose_mg_per_kg != null ? m.dose_mg_per_kg + " " + escapeHtml(m.dose_unit || "") : "ver notas"}</td>
      <td>${basisTag}</td>
      <td>${m.doses_per_day != null ? escapeHtml(String(m.doses_per_day)) + "x" : "—"}</td>
      <td><a href="${m.source_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.source_name)}</a></td>
      <td style="white-space:nowrap;">
        <button class="btn btn--ghost btn--sm" data-edit="${m.id}">Editar</button>
        <button class="btn btn--ghost btn--sm" data-delete="${m.id}">Excluir</button>
      </td>
    </tr>`;
}

// Reaplica busca/categoria/pendência sobre allMeds e agrupa o resultado por
// categoria (uma linha de cabeçalho por grupo) em vez de uma lista plana —
// era o jeito que fazia achar "todos os antieméticos" exigir rolar a tabela
// toda lendo a coluna Categoria linha a linha.
function renderMeds() {
  const term = document.getElementById("med-search").value.trim().toLowerCase();
  const categoryFilter = document.getElementById("med-category-filter").value;
  const onlyIssues = document.getElementById("med-issues-filter").checked;

  const filtered = allMeds.filter((m) => {
    if (categoryFilter && m.category !== categoryFilter) return false;
    if (onlyIssues && !medHasBasisIssue(m)) return false;
    if (!term) return true;
    return (m.name || "").toLowerCase().includes(term);
  });

  const byCategory = new Map();
  filtered.forEach((m) => {
    const key = m.category || "Sem categoria";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(m);
  });
  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  document.getElementById("meds-tbody").innerHTML = categories
    .map((cat) => {
      const meds = byCategory.get(cat).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const groupHeader = `<tr class="table-group-row"><td colspan="6">${escapeHtml(cat)} · ${meds.length}</td></tr>`;
      return groupHeader + meds.map(medRow).join("");
    })
    .join("");
  document.getElementById("meds-empty").hidden = filtered.length > 0;

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const med = allMeds.find((m) => String(m.id) === btn.dataset.edit);
      fillMedForm(med);
    });
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este medicamento do catálogo?")) return;
      await fetch(`/api/admin/medications/${btn.dataset.delete}`, { method: "DELETE", credentials: "same-origin" });
      loadMeds();
    });
  });
}

document.getElementById("med-search").addEventListener("input", renderMeds);
document.getElementById("med-category-filter").addEventListener("change", renderMeds);
document.getElementById("med-issues-filter").addEventListener("change", renderMeds);

function openMedForm() {
  openFormCard("med-form-card", "panel-meds", "med-name");
}

function closeMedForm() {
  document.getElementById("med-form-card").hidden = true;
  resetMedForm();
}

// Mapa campo do form -> propriedade do medicamento (com transformação opcional
// pro texto do input). Usado tanto por fillMedForm quanto por resetMedForm,
// pra um campo novo (ex.: presentations, no passado) não poder ser esquecido
// em só um dos dois — a lista de campos existe uma vez só.
const MED_FORM_FIELDS = [
  ["name", (m) => m.name || ""],
  ["category", (m) => m.category || ""],
  ["indication", (m) => m.indication || ""],
  ["dose", (m) => m.dose_mg_per_kg ?? ""],
  ["dose-unit", (m) => m.dose_unit || ""],
  ["frequency", (m) => m.frequency || ""],
  ["max", (m) => m.max_dose_mg ?? ""],
  ["max-basis", (m) => m.max_dose_basis || ""],
  ["doses-per-day", (m) => m.doses_per_day ?? ""],
  ["route", (m) => m.route || ""],
  ["presentation", (m) => m.presentation || ""],
  ["notes", (m) => m.notes || ""],
  ["presentations", (m) => serializePresentations(m.presentations)],
  ["source-name", (m) => m.source_name || ""],
  ["source-url", (m) => m.source_url || ""],
];

function fillMedForm(med) {
  document.getElementById("med-form-title").textContent = "Editar medicamento";
  document.getElementById("med-id").value = med.id;
  MED_FORM_FIELDS.forEach(([field, getValue]) => {
    document.getElementById(`med-${field}`).value = getValue(med);
  });
  openMedForm();
}

function resetMedForm() {
  document.getElementById("med-form-title").textContent = "Adicionar medicamento";
  document.getElementById("med-id").value = "";
  MED_FORM_FIELDS.forEach(([field]) => (document.getElementById(`med-${field}`).value = ""));
}

document.getElementById("med-add-btn").addEventListener("click", () => {
  resetMedForm();
  openMedForm();
});

document.getElementById("med-cancel").addEventListener("click", closeMedForm);

document.getElementById("med-save").addEventListener("click", async () => {
  const status = document.getElementById("med-status");
  status.textContent = "";
  status.className = "form-status";

  const id = document.getElementById("med-id").value;

  const { presentations, invalidLines } = parsePresentationsText(document.getElementById("med-presentations").value);
  if (invalidLines.length) {
    status.textContent = `Linha(s) de apresentação inválida(s) (formato "rótulo | mg/mL", concentração > 0): ${invalidLines
      .map((l) => `"${l}"`)
      .join(", ")}. Corrija ou remova antes de salvar.`;
    status.classList.add("error");
    return;
  }

  const payload = {
    name: document.getElementById("med-name").value.trim(),
    category: document.getElementById("med-category").value.trim(),
    indication: document.getElementById("med-indication").value.trim() || null,
    dose_mg_per_kg: document.getElementById("med-dose").value ? Number(document.getElementById("med-dose").value) : null,
    dose_unit: document.getElementById("med-dose-unit").value.trim() || null,
    frequency: document.getElementById("med-frequency").value.trim() || null,
    max_dose_mg: document.getElementById("med-max").value ? Number(document.getElementById("med-max").value) : null,
    max_dose_basis: document.getElementById("med-max-basis").value || null,
    doses_per_day: document.getElementById("med-doses-per-day").value
      ? Number(document.getElementById("med-doses-per-day").value)
      : null,
    route: document.getElementById("med-route").value.trim() || null,
    presentation: document.getElementById("med-presentation").value.trim() || null,
    notes: document.getElementById("med-notes").value.trim() || null,
    presentations,
    source_name: document.getElementById("med-source-name").value.trim(),
    source_url: document.getElementById("med-source-url").value.trim(),
  };

  if (!payload.name || !payload.category || !payload.source_name || !payload.source_url) {
    status.textContent = "Nome, categoria e fonte (nome + URL) são obrigatórios — não cadastre sem fonte.";
    status.classList.add("error");
    return;
  }

  // Mesma regra do check-medications.js (auditoria de 16/ago/2026): sem
  // "teto é por..." preenchido, a calculadora não sabe se corta o valor
  // calculado por tomada ou o total do dia — e errava justo nesse ponto.
  if (payload.dose_mg_per_kg != null && payload.max_dose_mg != null && !payload.max_dose_basis) {
    status.textContent = 'Preencha "Teto é por..." — obrigatório sempre que Dose (mg/kg) e Dose máxima estiverem preenchidas juntas.';
    status.classList.add("error");
    return;
  }

  await submitForm({
    id,
    baseUrl: "/api/admin/medications",
    payload,
    status,
    onSuccess: () => {
      closeMedForm();
      loadMeds();
    },
  });
});
