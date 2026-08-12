/**
 * admin/app.js
 * Lógica do painel admin: tabs, editor de conteúdo (JSON por bloco), mensagens
 * de contato e CRUD de medicamentos. Tudo protegido por dosecertaRequireAuth('admin').
 */
dosecertaRequireAuth("admin");

// As abas não dependem da sessão — ligamos os cliques já de cara, pra não
// haver uma janela em que clicar não faz nada enquanto o /api/auth/me resolve.
initTabs();

document.addEventListener("dosecerta:session", (e) => {
  if (e.detail && e.detail.role === "admin") {
    document.getElementById("admin-app").hidden = false;
    loadContent();
    loadMessages();
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

/* ===== Conteúdo ===== */
async function loadContent() {
  const res = await fetch("/api/content", { credentials: "same-origin" });
  const content = await res.json();
  const container = document.getElementById("content-blocks");
  container.innerHTML = Object.entries(content)
    .map(
      ([key, value]) => `
    <div class="card form-card" style="margin-bottom:var(--space-md);">
      <h3 style="font-family:var(--font-heading); margin-bottom:var(--space-sm); text-transform:capitalize;">${escapeHtml(key)}</h3>
      <textarea data-key="${escapeHtml(key)}" style="min-height:160px; width:100%; font-family:monospace; font-size:0.8rem; border:1.5px solid var(--color-border); border-radius:var(--radius-sm); padding:0.75rem; background:var(--color-bg); color:var(--color-text);">${escapeHtml(JSON.stringify(value, null, 2))}</textarea>
      <div style="display:flex; align-items:center; gap:var(--space-sm); margin-top:var(--space-sm);">
        <button class="btn btn--primary btn--sm" data-save-key="${escapeHtml(key)}">Salvar</button>
        <span class="form-status" data-status-key="${escapeHtml(key)}"></span>
      </div>
    </div>`
    )
    .join("");

  container.querySelectorAll("[data-save-key]").forEach((btn) => {
    btn.addEventListener("click", () => saveContentBlock(btn.dataset.saveKey));
  });
}

async function saveContentBlock(key) {
  const textarea = document.querySelector(`textarea[data-key="${key}"]`);
  const status = document.querySelector(`[data-status-key="${key}"]`);
  status.textContent = "";
  status.className = "form-status";

  let parsed;
  try {
    parsed = JSON.parse(textarea.value);
  } catch {
    status.textContent = "JSON inválido — corrija antes de salvar.";
    status.classList.add("error");
    return;
  }

  const res = await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(parsed),
  });

  if (res.ok) {
    status.textContent = "Salvo.";
    status.classList.add("success");
  } else {
    const body = await res.json().catch(() => ({}));
    status.textContent = body.error || "Falha ao salvar.";
    status.classList.add("error");
  }
}

/* ===== Mensagens ===== */
async function loadMessages() {
  const res = await fetch("/api/admin/messages", { credentials: "same-origin" });
  if (!res.ok) return;
  const messages = await res.json();
  const unread = messages.filter((m) => !m.read).length;
  document.getElementById("unread-badge").textContent = unread ? `(${unread})` : "";

  document.getElementById("messages-tbody").innerHTML = messages
    .map(
      (m) => `
    <tr>
      <td>${new Date(m.created_at).toLocaleString("pt-BR")}</td>
      <td>${escapeHtml(m.name)}</td>
      <td><a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></td>
      <td>${escapeHtml(m.subject)}</td>
      <td style="max-width:280px; white-space:pre-wrap;">${escapeHtml(m.message)}</td>
      <td>${m.read ? '<span class="tag">Lida</span>' : `<button class="btn btn--ghost btn--sm" data-mark-read="${m.id}">Marcar como lida</button>`}</td>
    </tr>`
    )
    .join("");

  document.querySelectorAll("[data-mark-read]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/messages/${btn.dataset.markRead}/read`, { method: "PUT", credentials: "same-origin" });
      loadMessages();
    });
  });
}

/* ===== Medicamentos ===== */
async function loadMeds() {
  const res = await fetch("/api/admin/medications", { credentials: "same-origin" });
  if (!res.ok) return;
  const meds = await res.json();

  document.getElementById("meds-tbody").innerHTML = meds
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.category)}</td>
      <td>${m.dose_mg_per_kg != null ? m.dose_mg_per_kg + " " + escapeHtml(m.dose_unit || "") : "ver notas"}</td>
      <td><a href="${m.source_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.source_name)}</a></td>
      <td style="white-space:nowrap;">
        <button class="btn btn--ghost btn--sm" data-edit="${m.id}">Editar</button>
        <button class="btn btn--ghost btn--sm" data-delete="${m.id}">Excluir</button>
      </td>
    </tr>`
    )
    .join("");

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const med = meds.find((m) => String(m.id) === btn.dataset.edit);
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

function fillMedForm(med) {
  document.getElementById("med-form-title").textContent = "Editar medicamento";
  document.getElementById("med-id").value = med.id;
  document.getElementById("med-name").value = med.name || "";
  document.getElementById("med-category").value = med.category || "";
  document.getElementById("med-indication").value = med.indication || "";
  document.getElementById("med-dose").value = med.dose_mg_per_kg ?? "";
  document.getElementById("med-dose-unit").value = med.dose_unit || "";
  document.getElementById("med-frequency").value = med.frequency || "";
  document.getElementById("med-max").value = med.max_dose_mg ?? "";
  document.getElementById("med-route").value = med.route || "";
  document.getElementById("med-presentation").value = med.presentation || "";
  document.getElementById("med-notes").value = med.notes || "";
  document.getElementById("med-source-name").value = med.source_name || "";
  document.getElementById("med-source-url").value = med.source_url || "";
  document.getElementById("med-cancel").hidden = false;
  window.scrollTo({ top: document.getElementById("panel-meds").offsetTop - 100, behavior: "smooth" });
}

function resetMedForm() {
  document.getElementById("med-form-title").textContent = "Adicionar medicamento";
  document.getElementById("med-id").value = "";
  ["name", "category", "indication", "dose", "dose-unit", "frequency", "max", "route", "presentation", "notes", "source-name", "source-url"].forEach(
    (field) => (document.getElementById(`med-${field}`).value = "")
  );
  document.getElementById("med-cancel").hidden = true;
}

document.getElementById("med-cancel").addEventListener("click", resetMedForm);

document.getElementById("med-save").addEventListener("click", async () => {
  const status = document.getElementById("med-status");
  status.textContent = "";
  status.className = "form-status";

  const id = document.getElementById("med-id").value;
  const payload = {
    name: document.getElementById("med-name").value.trim(),
    category: document.getElementById("med-category").value.trim(),
    indication: document.getElementById("med-indication").value.trim() || null,
    dose_mg_per_kg: document.getElementById("med-dose").value ? Number(document.getElementById("med-dose").value) : null,
    dose_unit: document.getElementById("med-dose-unit").value.trim() || null,
    frequency: document.getElementById("med-frequency").value.trim() || null,
    max_dose_mg: document.getElementById("med-max").value ? Number(document.getElementById("med-max").value) : null,
    route: document.getElementById("med-route").value.trim() || null,
    presentation: document.getElementById("med-presentation").value.trim() || null,
    notes: document.getElementById("med-notes").value.trim() || null,
    source_name: document.getElementById("med-source-name").value.trim(),
    source_url: document.getElementById("med-source-url").value.trim(),
  };

  if (!payload.name || !payload.category || !payload.source_name || !payload.source_url) {
    status.textContent = "Nome, categoria e fonte (nome + URL) são obrigatórios — não cadastre sem fonte.";
    status.classList.add("error");
    return;
  }

  const url = id ? `/api/admin/medications/${id}` : "/api/admin/medications";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    status.textContent = "Salvo.";
    status.classList.add("success");
    resetMedForm();
    loadMeds();
  } else {
    const body = await res.json().catch(() => ({}));
    status.textContent = body.error || "Falha ao salvar.";
    status.classList.add("error");
  }
});
