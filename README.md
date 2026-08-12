# DoseCerta — Calculadora de doses pediátricas (com login e admin de catálogo)

Aplicação Node.js/Express + SQLite para uma calculadora clínica de doses pediátricas
(com foco em odontopediatria), com login de profissional e um catálogo de medicamentos
pesquisado e citado por fonte. Projeto pessoal, sem site institucional.

> ⚠️ **Importante**
> O catálogo de medicamentos em [seed/medications.json](seed/medications.json) foi **pesquisado de
> fontes reais** (bulas ANVISA, diretrizes SBP/ASBAI/AAPD, Ministério da Saúde), cada item com
> `source_name` + `source_url`. Mesmo assim, **é uma ferramenta de apoio à decisão clínica —
> não substitui o julgamento profissional nem a bula vigente**. Vários itens têm ressalvas
> importantes no campo `notes` (idade mínima, contraindicações, dose em UI em vez de mg/kg
> etc.) — leia antes de confiar cegamente na calculadora. Alguns itens são cadastrados
> propositalmente como **contraindicados** (ex.: nimesulida, AAS, tetraciclinas em
> odontopediatria) só como alerta de segurança — não são sugestão de dose.

## Como rodar localmente

Requer **Node.js ≥ 22.5** (o projeto usa o módulo nativo `node:sqlite` — sem dependência
compilada, então não precisa de toolchain de C++/Visual Studio instalado).

```bash
npm install
cp .env.example .env        # ajuste SESSION_SECRET antes de ir pra produção
npm run seed                # popula o banco com o catálogo de medicamentos
node server/scripts/create-admin.js "Seu Nome" seu@email.com "SenhaForte123!"
npm run dev                 # ou: npm start
```

Acesse `http://localhost:3300` — quem chega em `/` é mandado direto pro login (ou pra
calculadora/admin, se já estiver logado). Cadastro de profissional em `/cadastro.html`,
login em `/login.html`, admin do catálogo em `/admin/` (só pra quem tem role `admin`,
criado só via script acima — não existe rota HTTP pública pra virar admin).

## Como customizar

- **Catálogo de medicamentos**: pelo admin (`/admin/`) ou editando
  [seed/medications.json](seed/medications.json) e rodando `npm run seed` de novo. Nome,
  categoria, fonte e URL da fonte são obrigatórios — o formulário do admin não deixa
  salvar sem fonte, de propósito.
- **Cores/tipografia**: tokens em [css/variables.css](public/css/variables.css).

## Estrutura

```
public/                  # tudo servido como estático pelo Express
  index.html              # só decide pra onde mandar quem chega em "/" (login/calculadora/admin)
  login.html, cadastro.html, calculadora.html
  admin/                  # admin do catálogo (index.html + app.js)
  css/, js/, assets/       # design system, Web Components, ícones
server/
  index.js                 # bootstrap do Express (sessão, rotas, estáticos)
  db.js                     # schema SQLite (node:sqlite) + migrações idempotentes
  session-store.js          # session store própria sobre SQLite (sem dependência nativa)
  middleware/auth.js         # requireAuth / requireRole
  routes/                    # auth, medications, admin
  scripts/seed.js            # popula medications a partir de seed/medications.json
  scripts/create-admin.js    # cria/promove um usuário a admin (uso manual, uma vez)
seed/
  medications.json           # catálogo de medicamentos (fontes citadas)
data/                        # dosecerta.sqlite (gerado, fora do controle de versão)
```

## Modelo de dados (SQLite)

`users` (admin/professional, senha com bcrypt) · `medications` (dose, fonte obrigatória) ·
`sessions` (sessão de login).

## Segurança e limitações conhecidas

- Rate limiting em login/cadastro (`express-rate-limit`), senha com bcrypt,
  cookie de sessão `httpOnly`, `sameSite=lax`, `secure` em produção (`COOKIE_SECURE=true`
  atrás de HTTPS).
- Sem recuperação de senha por e-mail, sem 2FA, sem histórico de cálculos por usuário —
  fora do escopo deste projeto.

## Verificação

Não há suíte de testes automatizada no repositório. Pra revalidar: suba o servidor, teste
cadastro → calculadora → logout → login admin → editar catálogo → confirmar que
profissional recebe 403 em `/api/admin/*`.
