/**
 * <site-header>
 * Cabeçalho simples: logo + área de conta (Entrar/Cadastrar ou Calculadora/Admin/Sair,
 * conforme sessão). Sem menu institucional — a ferramenta é só a calculadora.
 */
class SiteHeader extends HTMLElement {
  connectedCallback() {
    const icons = window.ICONS;

    this.innerHTML = `
      <header class="site-header" id="site-header">
        <div class="container site-header__bar">
          <a href="/" class="brand" aria-label="DoseCerta — página inicial">
            ${icons.logo}
            <span>DoseCerta</span>
          </a>
          <span id="nav-account" class="nav__extra-cta"></span>
        </div>
      </header>
    `;

    this._renderAccount(window.DOSECERTA_SESSION);
    document.addEventListener("dosecerta:session", (e) => this._renderAccount(e.detail));
  }

  _renderAccount(session) {
    const account = this.querySelector("#nav-account");
    if (!account) return;

    let html;
    if (!session) {
      html = `<a class="btn btn--ghost btn--sm" href="/login.html">Entrar</a>
              <a class="btn btn--primary btn--sm" href="/cadastro.html">Cadastrar</a>`;
    } else if (session.role === "admin") {
      html = `<a class="btn btn--ghost btn--sm" href="/calculadora.html">Calculadora</a>
              <a class="btn btn--ghost btn--sm" href="/admin/">Admin</a>
              <button class="btn btn--primary btn--sm" data-logout>Sair</button>`;
    } else {
      html = `<a class="btn btn--ghost btn--sm" href="/calculadora.html">Calculadora</a>
              <button class="btn btn--primary btn--sm" data-logout>Sair</button>`;
    }

    account.innerHTML = html;
    account.querySelectorAll("[data-logout]").forEach((btn) =>
      btn.addEventListener("click", () => window.dosecertaLogout())
    );
  }
}

customElements.define("site-header", SiteHeader);
