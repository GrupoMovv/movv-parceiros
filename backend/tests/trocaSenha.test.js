// Troca de senha com a senha atual: "Alterar senha" do portal (Partner,
// contabilidade e equipe interna) e perfil do Indicador. O interceptor do
// portal (frontend/src/services/api.js) trata QUALQUER 401 como sessão
// expirada e manda para /login; senha atual errada tem de responder 400 e a
// sessão continua valendo. Banco em memória (PGlite); nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { novoBanco, usarNoApp } = require('./helpers/bancoTeste');

process.env.JWT_SECRET = 'segredo-de-teste';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_teste_sem_envio';

let db;
let servidor;
let base;
const t = {};
const ids = {};

async function chamar(metodo, rota, token, corpo) {
  const r = await fetch(base + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, body: json };
}

const hashDe = async (tabela, id) => (await db.query(`SELECT password_hash FROM ${tabela} WHERE id = $1`, [id])).rows[0].password_hash;

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('senha-certa', 4);
  const partner = async (code, type, extra = {}) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id`,
    [code, `Nome ${code}`, `${code.toLowerCase()}@teste.local`, hash, type, extra.nivel || null]
  )).rows[0].id;
  ids.partner = await partner('PARTNER-961', 'movv_partner', { nivel: 'mobile' });
  ids.contab = await partner('CONTAB-961', 'accounting');
  ids.interno = (await db.query(
    `INSERT INTO internal_collaborators (name, email, password_hash, role, must_change_password)
     VALUES ('Interno Teste', 'interno961@teste.local', $1, 'comercial_full', false) RETURNING id`, [hash]
  )).rows[0].id;
  ids.indicador = (await db.query(
    `INSERT INTO indicators (name, cpf, email, whatsapp, pix_key, pix_key_type, password_hash, status)
     VALUES ('Indicador Teste', '52998224725', 'ind961@teste.local', '64999990000', 'ind961@teste.local', 'email', $1, 'approved')
     RETURNING id`, [hash]
  )).rows[0].id;

  t.partner = jwt.sign({ id: ids.partner, userType: 'partner' }, process.env.JWT_SECRET);
  t.contab = jwt.sign({ id: ids.contab, userType: 'partner' }, process.env.JWT_SECRET);
  t.interno = jwt.sign({ id: ids.interno, userType: 'internal', role: 'comercial_full' }, process.env.JWT_SECRET);
  t.indicador = jwt.sign({ id: ids.indicador, userType: 'indicator' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

// [quem, token, tabela, rota da troca, rota que prova que a sessão vale]
const CASOS = [
  ['MOVV Partner', 'partner', 'partners', '/api/auth/change-password', '/api/auth/me'],
  ['contabilidade', 'contab', 'partners', '/api/auth/change-password', '/api/auth/me'],
  ['equipe interna', 'interno', 'internal_collaborators', '/api/auth/change-password', '/api/auth/me'],
  ['Indicador', 'indicador', 'indicators', '/api/indicators/me/password', '/api/indicators/me'],
];

for (const [quem, tk, tabela, rota, rotaSessao] of CASOS) {
  test(`troca de senha (${quem}): senha atual errada responde 400 e não derruba a sessão`, async () => {
    const antes = await hashDe(tabela, ids[tk]);
    const r = await chamar('PUT', rota, t[tk], { currentPassword: 'errada', newPassword: 'nova-senha-1' });
    assert.notEqual(r.status, 401, '401 desloga no portal');
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'Senha atual incorreta.');
    assert.equal(await hashDe(tabela, ids[tk]), antes, 'a senha não muda');
    const s = await chamar('GET', rotaSessao, t[tk]);
    assert.equal(s.status, 200, 'o mesmo token continua valendo');
  });

  test(`troca de senha (${quem}): senha atual certa continua trocando a senha`, async () => {
    const r = await chamar('PUT', rota, t[tk], { currentPassword: 'senha-certa', newPassword: 'nova-senha-1' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(await bcrypt.compare('nova-senha-1', await hashDe(tabela, ids[tk])));
    assert.equal(await bcrypt.compare('senha-certa', await hashDe(tabela, ids[tk])), false);
  });
}
