/**
 * main.js
 * Orquestra o comportamento do site após os componentes serem montados:
 * header com scroll-spy e menu mobile, toggle de tema, reveal on-scroll,
 * ano dinâmico e preferências de acessibilidade (prefers-reduced-motion).
 */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderScroll();
    initMobileMenu();
    initScrollSpy();
    initThemeToggle();
    initHeroCtaBySession();

    // As grades de serviços/equipe dependem do conteúdo buscado via API
    // (content-client.js). Só depois delas existirem no DOM é que o reveal-on-scroll
    // pode observar esses elementos com segurança.
    if (window.SITE_CONTENT) {
      renderContent(window.SITE_CONTENT);
      initRevealOnScroll();
    } else {
      document.addEventListener(
        "dosecerta:content",
        (e) => {
          renderContent(e.detail);
          initRevealOnScroll();
        },
        { once: true }
      );
    }
  });

  function renderContent(raw) {
    const services = raw.services || { items: [] };
    const team = raw.team || { members: [] };

    const servicesGrid = document.getElementById("services-grid");
    if (servicesGrid) {
      servicesGrid.innerHTML = (services.items || [])
        .map(
          (item) =>
            `<service-card icon="${item.icon}" title="${escapeAttr(item.title)}" text="${escapeAttr(item.text)}"></service-card>`
        )
        .join("");
    }

    const teamGrid = document.getElementById("team-grid");
    if (teamGrid) {
      teamGrid.innerHTML = (team.members || [])
        .map(
          (m) =>
            `<team-card name="${escapeAttr(m.name)}" role="${escapeAttr(m.role)}" bio="${escapeAttr(m.bio)}" initials="${escapeAttr(m.initials)}"></team-card>`
        )
        .join("");
    }
  }

  // O CTA principal do hero é "Começar agora" -> /cadastro.html por padrão
  // (visitante deslogado). Se já está logado, deve levar direto pra onde a
  // pessoa realmente usa o site — senão fica sem saber "onde clicar".
  // render-static.js também escreve nesse link (a partir do /api/content) de
  // forma assíncrona e em ordem imprevisível em relação à sessão — por isso
  // reaplicamos em resposta aos dois eventos, não só uma vez.
  function initHeroCtaBySession() {
    const applyIfLoggedIn = () => {
      const cta = document.getElementById("hero-cta-primary");
      if (!cta || !window.DOSECERTA_SESSION) return;
      cta.textContent = "Ir para a calculadora";
      cta.setAttribute("href", "/calculadora.html");
    };

    applyIfLoggedIn();
    document.addEventListener("dosecerta:session", applyIfLoggedIn);
    document.addEventListener("dosecerta:content", applyIfLoggedIn);
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function initHeaderScroll() {
    const header = document.getElementById("site-header");
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initMobileMenu() {
    const nav = document.getElementById("main-nav");
    const toggle = document.getElementById("menu-toggle");
    if (!nav || !toggle) return;

    const icons = window.ICONS;

    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      toggle.innerHTML = open ? icons.close : icons.menu;
    };

    toggle.addEventListener("click", () => {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.querySelectorAll("[data-nav-link], .nav__cta a, .nav__cta button").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // Os links do header usam "/#id" (pra funcionar a partir de qualquer página);
  // scroll-spy só faz sentido na própria home, então precisamos do fragmento puro.
  function hashOf(href) {
    const i = href.indexOf("#");
    return i === -1 ? "" : href.slice(i);
  }

  function initScrollSpy() {
    const links = Array.from(document.querySelectorAll("[data-nav-link]"));
    if (!links.length) return;

    const sections = links
      .map((link) => {
        const hash = hashOf(link.getAttribute("href"));
        return hash ? document.querySelector(hash) : null;
      })
      .filter(Boolean);

    if (!sections.length) return;

    const setActive = (id) => {
      links.forEach((link) => {
        link.classList.toggle("is-active", hashOf(link.getAttribute("href")) === `#${id}`);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  function initThemeToggle() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    const icons = window.ICONS;
    const root = document.documentElement;
    const stored = localStorage.getItem("dosecerta-theme");

    const apply = (theme) => {
      if (theme) {
        root.setAttribute("data-theme", theme);
      } else {
        root.removeAttribute("data-theme");
      }
      const isDark =
        theme === "dark" ||
        (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.querySelector(".theme-toggle__icon").innerHTML = isDark ? icons.sun : icons.moon;
    };

    apply(stored);

    toggle.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const isDark =
        current === "dark" || (!current && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const next = isDark ? "light" : "dark";
      localStorage.setItem("dosecerta-theme", next);
      apply(next);
    });
  }

  function initRevealOnScroll() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length || prefersReducedMotion || !("IntersectionObserver" in window)) {
      return; // conteúdo já é visível por padrão (ver components.css)
    }

    // Só ativa o efeito "oculto até revelar" depois que o observer existe,
    // evitando qualquer janela em que o conteúdo fique invisível sem controle.
    document.documentElement.classList.add("js-reveal-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    items.forEach((el) => observer.observe(el));

    // Rede de segurança: se por algum motivo um item nunca intersectar
    // (ex.: layout instável durante testes automatizados), garante a revelação.
    window.setTimeout(() => {
      items.forEach((el) => el.classList.add("is-visible"));
    }, 1500);
  }
})();
