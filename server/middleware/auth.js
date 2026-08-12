/**
 * middleware/auth.js
 * Guards de sessão: requireAuth (qualquer usuário logado) e requireRole (papel específico).
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado. Faça login para continuar." });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autenticado. Faça login para continuar." });
    }
    if (req.session.role !== role) {
      return res.status(403).json({ error: "Você não tem permissão para acessar este recurso." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
