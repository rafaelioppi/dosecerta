/**
 * server/index.js
 * Bootstrap do Express: sessão (SQLite), rotas da API e arquivos estáticos (public/).
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const SqliteSessionStore = require("./session-store");

const authRoutes = require("./routes/auth");
const contentRoutes = require("./routes/content");
const contactRoutes = require("./routes/contact");
const medicationRoutes = require("./routes/medications");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3300;
const isProd = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.set("trust proxy", 1); // atrás do Nginx na VM

app.use(express.json({ limit: "200kb" }));

app.use(
  session({
    store: new SqliteSessionStore(),
    name: "dosecerta.sid",
    secret: process.env.SESSION_SECRET || "dev-secret-troque-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));

// 404 da API em JSON; site é multi-página (não SPA), então qualquer outra rota
// não encontrada em public/ também vira 404 comum, sem mascarar como home.
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, "..", "public", "404.html"), (err) => {
  if (err) res.status(404).type("text/plain").send("Página não encontrada.");
}));

// Handler de erro genérico — nunca vaza stack trace pro cliente
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

app.listen(PORT, () => {
  console.log(`DoseCerta rodando em http://localhost:${PORT} (${isProd ? "produção" : "desenvolvimento"})`);
});
