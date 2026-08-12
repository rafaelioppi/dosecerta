/**
 * content-client.js
 * Busca o conteúdo institucional (GET /api/content) uma vez por página e expõe
 * via window.SITE_CONTENT + evento "dosecerta:content" quando pronto. Substitui
 * o antigo js/data/content.js estático — agora o conteúdo vem do banco (editável
 * pelo admin).
 */
(function () {
  "use strict";

  window.SITE_CONTENT = null;

  fetch("/api/content", { credentials: "same-origin" })
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}))
    .then((content) => {
      window.SITE_CONTENT = content;
      document.dispatchEvent(new CustomEvent("dosecerta:content", { detail: content }));
    });
})();
