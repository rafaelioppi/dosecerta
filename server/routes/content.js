/**
 * routes/content.js
 * GET público dos blocos de conteúdo do site institucional (hero, sobre, serviços, equipe, contato).
 * A escrita (PUT) mora em routes/admin.js, protegida por requireRole('admin').
 */
const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT key, value_json FROM content_blocks").all();
  const content = {};
  for (const row of rows) {
    try {
      content[row.key] = JSON.parse(row.value_json);
    } catch {
      // bloco corrompido é ignorado em vez de derrubar a resposta inteira
    }
  }
  res.json(content);
});

module.exports = router;
