/**
 * <contact-form>
 * Formulário de contato com validação client-side acessível.
 * Envia via POST /api/contact (a mensagem fica salva e visível no painel admin).
 */
class ContactForm extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <form class="card form-card" id="contact-form" novalidate>
        <div class="form-row">
          <div class="field" data-field="name">
            <label for="cf-name">Nome</label>
            <input type="text" id="cf-name" name="name" autocomplete="name" required />
            <span class="field__error" id="cf-name-error"></span>
          </div>
          <div class="field" data-field="email">
            <label for="cf-email">E-mail</label>
            <input type="email" id="cf-email" name="email" autocomplete="email" required />
            <span class="field__error" id="cf-email-error"></span>
          </div>
        </div>

        <div class="field" data-field="subject">
          <label for="cf-subject">Assunto</label>
          <input type="text" id="cf-subject" name="subject" required />
          <span class="field__error" id="cf-subject-error"></span>
        </div>

        <div class="field" data-field="message">
          <label for="cf-message">Mensagem</label>
          <textarea id="cf-message" name="message" required></textarea>
          <span class="field__error" id="cf-message-error"></span>
        </div>

        <button type="submit" class="btn btn--primary btn--block">Enviar mensagem</button>
        <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
      </form>
    `;

    this._bind();
  }

  _bind() {
    const form = this.querySelector("#contact-form");
    const status = this.querySelector("#form-status");
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";
      status.className = "form-status";

      const data = Object.fromEntries(new FormData(form).entries());
      const errors = this._validate(data, form);

      if (Object.keys(errors).length > 0) {
        status.textContent = "Verifique os campos destacados antes de enviar.";
        status.classList.add("error");
        const firstInvalid = form.querySelector(".has-error input, .has-error textarea");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      submitBtn.disabled = true;
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(data),
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          status.textContent = body.error || "Não foi possível enviar. Tente novamente.";
          status.classList.add("error");
          return;
        }

        status.textContent = "Mensagem enviada! Vamos responder o quanto antes.";
        status.classList.add("success");
        form.reset();
      } catch {
        status.textContent = "Falha de conexão. Tente novamente em instantes.";
        status.classList.add("error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  _validate(data, form) {
    const errors = {};
    const rules = {
      name: (v) => v.trim().length >= 2,
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      subject: (v) => v.trim().length >= 3,
      message: (v) => v.trim().length >= 10,
    };
    const messages = {
      name: "Informe seu nome completo.",
      email: "Informe um e-mail válido.",
      subject: "Descreva brevemente o assunto.",
      message: "Escreva uma mensagem com pelo menos 10 caracteres.",
    };

    Object.keys(rules).forEach((key) => {
      const field = form.querySelector(`[data-field="${key}"]`);
      const errorEl = form.querySelector(`#cf-${key}-error`);
      const valid = rules[key](data[key] || "");

      if (!valid) {
        errors[key] = messages[key];
        field?.classList.add("has-error");
        if (errorEl) errorEl.textContent = messages[key];
      } else {
        field?.classList.remove("has-error");
        if (errorEl) errorEl.textContent = "";
      }
    });

    return errors;
  }
}

customElements.define("contact-form", ContactForm);
