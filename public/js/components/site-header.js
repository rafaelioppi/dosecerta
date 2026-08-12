/**
 * <site-header>
 * Cabeçalho fixo com logo, navegação, scroll-spy, menu mobile, toggle de tema
 * e a área de conta (Entrar/Cadastrar ou Calculadora/Admin/Sair, conforme sessão).
 */
const NAV_ITEMS = [
  { label: "Início", href: "/#inicio" },
  { label: "Sobre", href: "/#sobre" },
  { label: "Serviços", href: "/#servicos" },
  { label: "Equipe", href: "/#equipe" },
  { label: "Contato", href: "/#contato" },
];

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

          <nav class="nav" id="main-nav" aria-label="Navegação principal">
            <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="nav-list" aria-label="Abrir menu">
              ${icons.menu}
            </button>
            <ul class="nav__list" id="nav-list">
              ${NAV_ITEMS.map((item) => `<li><a class="nav__link" href="${item.href}" data-nav-link>${item.label}</a></li>`).join("")}
              <li class="nav__cta" id="nav-account-mobile"></li>
            </ul>
          </nav>

          <div class="nav__extra">
            <button class="theme-toggle" id="theme-toggle" aria-label="Alternar tema claro/escuro" aria-pressed="false">
              <span class="theme-toggle__icon">${icons.moon}</span>
            </button>
            <span id="nav-account-desktop" class="nav__extra-cta"></span>
          </div>
        </div>
      </header>
    `;

    this._renderAccount(window.DOSECERTA_SESSION);
    document.addEventListener("dosecerta:session", (e) => this._renderAccount(e.detail));
  }

  _renderAccount(session) {
    const desktop = this.querySelector("#nav-account-desktop");
    const mobile = this.querySelector("#nav-account-mobile");
    if (!desktop || !mobile) return;

    let html;
    if (!session) {
      html = `<a class="btn btn--ghost btn--sm" href="/login.html">Entrar</a>
              <a class="btn btn--primary btn--sm" href="/cadastro.html">Cadastrar</a>`;
    } else if (session.role === "admin") {
      // Admin também usa a calculadora normalmente — não só o painel.
      html = `<a class="btn btn--ghost btn--sm" href="/calculadora.html">Calculadora</a>
              <a class="btn btn--ghost btn--sm" href="/admin/">Admin</a>
              <button class="btn btn--primary btn--sm" data-logout>Sair</button>`;
    } else {
      html = `<a class="btn btn--ghost btn--sm" href="/calculadora.html">Calculadora</a>
              <button class="btn btn--primary btn--sm" data-logout>Sair</button>`;
    }

    desktop.innerHTML = html;
    mobile.innerHTML = html;
    this.querySelectorAll("[data-logout]").forEach((btn) =>
      btn.addEventListener("click", () => window.dosecertaLogout())
    );
  }
}

customElements.define("site-header", SiteHeader);
