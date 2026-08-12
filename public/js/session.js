/**
 * session.js
 * Busca a sessão atual (GET /api/auth/me) uma vez e expõe o resultado via
 * window.DOSECERTA_SESSION + evento "dosecerta:session" para quem precisar
 * (header, guards de página protegida).
 */
(function () {
  "use strict";

  window.DOSECERTA_SESSION = null; // null = ainda carregando; false = deslogado; objeto = logado

  async function loadSession() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      window.DOSECERTA_SESSION = res.ok ? await res.json() : false;
    } catch {
      window.DOSECERTA_SESSION = false;
    }
    document.dispatchEvent(new CustomEvent("dosecerta:session", { detail: window.DOSECERTA_SESSION }));
  }

  window.dosecertaLogout = async function dosecertaLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/";
  };

  /**
   * Protege uma página: se não logado, redireciona pro login (preservando destino).
   * Se `role` for passado, exige esse papel específico (senão manda pra home).
   */
  window.dosecertaRequireAuth = function dosecertaRequireAuth(role) {
    document.addEventListener("dosecerta:session", function onSession(e) {
      document.removeEventListener("dosecerta:session", onSession);
      const session = e.detail;
      if (!session) {
        const redirect = encodeURIComponent(window.location.pathname);
        window.location.href = `/login.html?redirect=${redirect}`;
        return;
      }
      if (role && session.role !== role) {
        window.location.href = "/";
      }
    });
  };

  loadSession();
})();
