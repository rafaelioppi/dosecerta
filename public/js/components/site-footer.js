/**
 * <site-footer>
 * Rodapé simples: marca, aviso de apoio à decisão clínica e uma linha de assinatura.
 */
class SiteFooter extends HTMLElement {
  connectedCallback() {
    const icons = window.ICONS;
    const year = new Date().getFullYear();

    this.innerHTML = `
      <footer class="site-footer">
        <div class="container footer__simple">
          <a href="/" class="brand" aria-label="DoseCerta — página inicial">
            ${icons.logo}
            <span>DoseCerta</span>
          </a>
          <p class="footer__disclaimer">Ferramenta de apoio à decisão clínica — não substitui o julgamento profissional nem a bula vigente.</p>
          <p class="footer__signature">© ${year} DoseCerta · feito com carinho para Oara</p>
        </div>
      </footer>
    `;
  }
}

customElements.define("site-footer", SiteFooter);
