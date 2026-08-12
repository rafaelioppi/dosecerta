/**
 * render-static.js
 * Preenche os textos estáticos do index.html (hero, sobre, cabeçalhos de seção,
 * contato) a partir do conteúdo buscado via content-client.js (GET /api/content).
 * Roda antes de main.js, que cuida de comportamento (scroll-spy, menu, tema) e
 * das grades dinâmicas (serviços/equipe).
 */
(function () {
  "use strict";

  let domReady = false;
  let content = null;

  document.addEventListener("DOMContentLoaded", () => {
    domReady = true;
    tryRender();
  });
  document.addEventListener("dosecerta:content", (e) => {
    content = e.detail;
    tryRender();
  });

  function tryRender() {
    if (!domReady || !content) return;
    render(content);
  }

  function render(raw) {
    const icons = window.ICONS;
    const c = {
      hero: raw.hero || { stats: [], ctaPrimary: {}, ctaSecondary: {} },
      about: raw.about || { paragraphs: [], values: [] },
      services: raw.services || {},
      team: raw.team || {},
      contact: raw.contact || { info: [], social: [] },
    };

    // Hero
    setText("hero-eyebrow", c.hero.eyebrow);
    setText("hero-title", c.hero.title);
    setText("hero-lede", c.hero.lede);
    setLinkText("hero-cta-primary", c.hero.ctaPrimary.label, c.hero.ctaPrimary.href);
    setLinkText("hero-cta-secondary", c.hero.ctaSecondary.label, c.hero.ctaSecondary.href);

    const statsEl = document.getElementById("hero-stats");
    if (statsEl) {
      statsEl.innerHTML = c.hero.stats
        .map((s) => `<div class="hero__stat"><strong>${s.value}</strong><span>${s.label}</span></div>`)
        .join("");
    }

    // Sobre
    setText("about-eyebrow", c.about.eyebrow);
    setText("about-title", c.about.title);
    const paragraphsEl = document.getElementById("about-paragraphs");
    if (paragraphsEl) {
      paragraphsEl.innerHTML = c.about.paragraphs.map((p) => `<p>${p}</p>`).join("");
    }
    setText("about-notice", c.about.notice);

    const valuesGrid = document.getElementById("values-grid");
    if (valuesGrid) {
      valuesGrid.innerHTML = c.about.values
        .map(
          (v) => `
        <div class="card value-card" data-reveal>
          <div class="value-card__icon">${icons[v.icon] || ""}</div>
          <h3>${v.title}</h3>
          <p>${v.text}</p>
        </div>`
        )
        .join("");
    }

    // Serviços
    setText("services-eyebrow", c.services.eyebrow);
    setText("services-title", c.services.title);
    setText("services-subtitle", c.services.subtitle);

    // Equipe
    setText("team-eyebrow", c.team.eyebrow);
    setText("team-title", c.team.title);
    setText("team-subtitle", c.team.subtitle);

    // Contato
    setText("contact-eyebrow", c.contact.eyebrow);
    setText("contact-title", c.contact.title);
    setText("contact-subtitle", c.contact.subtitle);

    const infoList = document.getElementById("contact-info-list");
    if (infoList) {
      infoList.innerHTML = c.contact.info
        .map(
          (i) => `
        <div class="contact-info-item">
          <div class="contact-info-item__icon">${icons[i.icon] || ""}</div>
          <div>
            <h3>${i.title}</h3>
            <p>${i.value}</p>
          </div>
        </div>`
        )
        .join("");
    }

    const socialList = document.getElementById("contact-social-list");
    if (socialList) {
      socialList.innerHTML = c.contact.social
        .map(
          (s) =>
            `<a href="${s.href}" aria-label="${s.label}" target="_blank" rel="noopener noreferrer">${icons[s.icon] || ""}</a>`
        )
        .join("");
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setLinkText(id, text, href) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      if (href) el.setAttribute("href", href);
    }
  }
})();
