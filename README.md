# DoseCerta — Calculadora de doses pediátricas (com login, admin e backend)

Aplicação Node.js/Express + SQLite para uma calculadora clínica de doses pediátricas, com:
site institucional, cadastro/login de profissionais de saúde, calculadora de doses de
verdade (com catálogo pesquisado e citado por fonte), e painel admin (conteúdo do site,
mensagens de contato, CRUD do catálogo de medicamentos).

> ⚠️ **Importante — o que é placeholder e o que é real aqui**
> - Marca ("DoseCerta"), equipe (seção "Equipe" do site) e dados de contato são
>   **fictícios/ilustrativos** — troque antes de publicar de verdade.
> - O catálogo de medicamentos em [seed/medications.json](seed/medications.json) foi **pesquisado de fontes
>   reais** (bulas ANVISA, diretrizes SBP/ASBAI, Ministério da Saúde), cada item com
>   `source_name` + `source_url`. Mesmo assim, **é uma ferramenta de apoio à decisão
>   clínica — não substitui o julgamento médico nem a bula vigente**. Vários itens têm
>   ressalvas importantes no campo `notes` (idade mínima, alertas de QT, dose em UI em vez
>   de mg/kg, etc.) — leia antes de confiar cegamente na calculadora.

## Como rodar localmente

Requer **Node.js ≥ 22.5** (o projeto usa o módulo nativo `node:sqlite` — sem dependência
compilada, então não precisa de toolchain de C++/Visual Studio instalado).

```bash
npm install
cp .env.example .env        # ajuste SESSION_SECRET antes de ir pra produção
npm run seed                # popula o banco com o conteúdo do site e os medicamentos
node server/scripts/create-admin.js "Seu Nome" seu@email.com "SenhaForte123!"
npm run dev                 # ou: npm start
```

Acesse `http://localhost:3300`. Cadastro de profissional em `/cadastro.html`, login em
`/login.html`, painel admin em `/admin/` (só pra quem tem role `admin`, criado só via
script acima — não existe rota HTTP pública pra virar admin).

## Como customizar

- **Conteúdo do site institucional** (Sobre/Serviços/Equipe/Contato): edite pelo painel
  admin (`/admin/`, aba "Conteúdo") depois do primeiro deploy, ou ajuste
  [seed/content.json](seed/content.json) e rode `npm run seed` de novo antes do primeiro deploy.
- **Catálogo de medicamentos**: pelo painel admin (aba "Medicamentos") ou editando
  [seed/medications.json](seed/medications.json). Nome, categoria, fonte e URL da fonte são obrigatórios —
  o formulário do admin não deixa salvar sem fonte, de propósito.
- **Cores/tipografia**: tokens em [css/variables.css](public/css/variables.css).

## Estrutura

```
public/                  # tudo servido como estático pelo Express
  index.html              # site institucional (conteúdo vem de GET /api/content)
  login.html, cadastro.html, calculadora.html
  admin/                  # painel admin (index.html + app.js)
  css/, js/, assets/       # design system, Web Components, ícones
server/
  index.js                 # bootstrap do Express (sessão, rotas, estáticos)
  db.js                     # schema SQLite (node:sqlite) + migrações idempotentes
  session-store.js          # session store própria sobre SQLite (sem dependência nativa)
  middleware/auth.js         # requireAuth / requireRole
  routes/                    # auth, content, contact, medications, admin
  scripts/seed.js            # popula content_blocks + medications a partir de seed/*.json
  scripts/create-admin.js    # cria/promove um usuário a admin (uso manual, uma vez)
seed/
  content.json               # conteúdo inicial do site (migra pra content_blocks)
  medications.json           # catálogo inicial de medicamentos (fontes citadas)
data/                        # dosecerta.sqlite (gerado, fora do controle de versão)
```

## Modelo de dados (SQLite)

`users` (admin/professional, senha com bcrypt) · `medications` (dose, fonte obrigatória) ·
`content_blocks` (textos do site, editáveis pelo admin) · `contact_messages` (formulário
público) · `sessions` (sessão de login).

## Segurança e limitações conhecidas

- Rate limiting em login/cadastro/contato (`express-rate-limit`), senha com bcrypt,
  cookie de sessão `httpOnly`, `sameSite=lax`, `secure` em produção (`COOKIE_SECURE=true`
  atrás de HTTPS).
- Sem recuperação de senha por e-mail, sem 2FA, sem histórico de cálculos por usuário —
  fora do escopo desta primeira entrega.
- `npm audit` acusa 2 vulnerabilidades (1 alta, 1 crítica) numa dependência transitiva de
  build (`tar`, via `@mapbox/node-pre-gyp`, usado só na instalação do `bcrypt`) — não afeta
  o código que roda em produção, mas vale revisar antes de publicar caso o `bcrypt` seja
  atualizado.

## Verificação

Não há suíte de testes automatizada no repositório (o fluxo completo — cadastro, login,
calculadora, admin, proteção de rotas por papel — foi validado manualmente ponta a ponta
antes da entrega). Pra revalidar: suba o servidor, teste cadastro → calculadora → logout →
login admin → editar conteúdo → ver mensagem de contato → confirmar que profissional
recebe 403 em `/api/admin/*`.
