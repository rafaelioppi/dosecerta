/**
 * admin/app.js
 * CRUD do catálogo de medicamentos. Protegido por dosecertaRequireAuth('admin').
 */
dosecertaRequireAuth("admin");

document.addEventListener("dosecerta:session", (e) => {
  if (e.detail && e.detail.role === "admin") {
    document.getElementById("admin-app").hidden = false;
    loadMeds();
  }
});

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

function openMedForm() {
  document.getElementById("med-form-card").hidden = false;
  window.scrollTo({ top: document.getElementById("panel-meds").offsetTop - 100, behavior: "smooth" });
  document.getElementById("med-name").focus();
}

function closeMedForm() {
  document.getElementById("med-form-card").hidden = true;
  resetMedForm();
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
  openMedForm();
}

function resetMedForm() {
  document.getElementById("med-form-title").textContent = "Adicionar medicamento";
  document.getElementById("med-id").value = "";
  ["name", "category", "indication", "dose", "dose-unit", "frequency", "max", "route", "presentation", "notes", "source-name", "source-url"].forEach(
    (field) => (document.getElementById(`med-${field}`).value = "")
  );
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
    closeMedForm();
    loadMeds();
  } else {
    const body = await res.json().catch(() => ({}));
    status.textContent = body.error || "Falha ao salvar.";
    status.classList.add("error");
  }
});
