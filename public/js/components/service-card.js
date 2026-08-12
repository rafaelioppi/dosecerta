/**
 * <service-card icon="calculator" title="..." text="..."></service-card>
 * Card reutilizável para a grade de Serviços.
 */
class ServiceCard extends HTMLElement {
  connectedCallback() {
    const icon = this.getAttribute("icon") || "target";
    const title = this.getAttribute("title") || "";
    const text = this.getAttribute("text") || "";
    const svg = (window.ICONS && window.ICONS[icon]) || "";

    this.innerHTML = `
      <article class="card service-card" data-reveal>
        <div class="service-card__icon">${svg}</div>
        <h3>${title}</h3>
        <p>${text}</p>
      </article>
    `;
  }
}

customElements.define("service-card", ServiceCard);
