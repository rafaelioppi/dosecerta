/**
 * <site-footer>
 * Rodapé com marca, navegação, contato, redes sociais e aviso legal.
 * Aguarda o evento "dosecerta:content" (ver content-client.js) antes de renderizar
 * os dados dinâmicos (descrição, contato, redes, disclaimer).
 */
const FOOTER_NAV = [
  { label: "Início", href: "/#inicio" },
  { label: "Sobre", href: "/#sobre" },
  { label: "Serviços", href: "/#servicos" },
  { label: "Equipe", href: "/#equipe" },
  { label: "Contato", href: "/#contato" },
];

class SiteFooter extends HTMLElement {
  connectedCallback() {
    if (window.SITE_CONTENT) {
      this._render(window.SITE_CONTENT);
    } else {
      this.innerHTML = `<footer class="site-footer"></footer>`; // placeholder até o conteúdo chegar
      document.addEventListener("dosecerta:content", (e) => this._render(e.detail), { once: true });
    }
  }

  _render(content) {
    const icons = window.ICONS;
    const contact = content.contact || { info: [], social: [] };
    const footer = content.footer || {};
    const year = new Date().getFullYear();

    this.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer__grid">
            <div class="footer__brand">
              <a href="/" class="brand" aria-label="DoseCerta — página inicial">
                ${icons.logo}
                <span>DoseCerta</span>
              </a>
              <p>${footer.description || ""}</p>
              <div class="social-row">
                ${(contact.social || [])
                  .map((s) => `<a href="${s.href}" aria-label="${s.label}" target="_blank" rel="noopener noreferrer">${icons[s.icon] || ""}</a>`)
                  .join("")}
              </div>
            </div>

            <div class="footer__col">
              <h4>${footer.linksTitle || "Navegação"}</h4>
              <div class="footer__links">
                ${FOOTER_NAV.map((item) => `<a href="${item.href}">${item.label}</a>`).join("")}
              </div>
            </div>

            <div class="footer__col">
              <h4>${footer.contactTitle || "Contato"}</h4>
              <div class="footer__links">
                ${(contact.info || []).map((i) => `<p>${i.value}</p>`).join("")}
              </div>
            </div>

            <div class="footer__col">
              <h4>${footer.legalTitle || "Legal"}</h4>
              <div class="footer__links">
                ${(footer.legalLinks || []).map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
              </div>
            </div>
          </div>

          <div class="footer__bottom">
            <p>&copy; ${year} DoseCerta. Todos os direitos reservados.</p>
            <p class="footer__disclaimer">${footer.disclaimer || ""}</p>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define("site-footer", SiteFooter);
