// "Administrador — Financeiro" no Novo Parceiro: só o ADMIN-001 cria conta
// admin com partners.perfil_admin = 'financeiro' (migration 089). Banco em
// memória (PGlite) com o app de verdade; nunca toca produção.
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
const SENHA_INICIAL = 'provisoria-981';

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

const novoFinanceiro = (token, extra = {}) => chamar('POST', '/api/partners', token, {
  name: 'Edmar Financeiro', email: `edmar${Math.random().toString(36).slice(2, 7)}@teste.local`,
  type: 'employee', password: SENHA_INICIAL, perfil_admin: 'financeiro', ...extra,
});

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('senha-certa', 4);
  const partner = async (code, type, extra = {}) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, is_admin, perfil_admin, must_change_password,
                           pix_key, pix_key_type, documento, tipo_parceiro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, $11, $12) RETURNING id`,
    [code, `Nome ${code}`, `${code.toLowerCase()}@teste.local`, hash, type, extra.nivel || null, Boolean(extra.admin), extra.perfil || null,
      extra.pix || null, extra.pix ? 'email' : null, extra.doc || null, extra.doc ? 'autonomo' : null]
  )).rows[0].id;
  ids.principal = await partner('ADMIN-001', 'accounting', { admin: true });
  ids.outroAdmin = await partner('ADMIN-002', 'accounting', { admin: true, perfil: 'financeiro' });
  ids.outroAdminCompleto = await partner('ADMIN-T09', 'accounting', { admin: true });
  ids.func = await partner('FUNC-IT-CS-981', 'employee');
  ids.partner = await partner('PARTNER-981', 'movv_partner', { nivel: 'mobile', pix: 'p981@teste.local', doc: '52998224725' });
  ids.fernando = (await db.query(
    `INSERT INTO internal_collaborators (name, email, password_hash, role, must_change_password)
     VALUES ('Fernando 981', 'fernando981@teste.local', 'x', 'comercial_full', false) RETURNING id`)).rows[0].id;
  const assinar = id => jwt.sign({ id, userType: 'partner' }, process.env.JWT_SECRET);
  t.principal = assinar(ids.principal);
  t.outroAdmin = assinar(ids.outroAdmin);
  t.outroAdminCompleto = assinar(ids.outroAdminCompleto);
  t.func = assinar(ids.func);
  t.partner = assinar(ids.partner);
  t.fernando = jwt.sign({ id: ids.fernando, userType: 'internal', role: 'comercial_full' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

test('ADMIN-001 cria "Administrador — Financeiro": perfil financeiro, ADMIN-00N e troca de senha obrigatória', async () => {
  const r = await novoFinanceiro(t.principal);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.code, /^ADMIN-\d{3}$/);
  assert.equal(r.body.perfil_admin, 'financeiro');
  assert.ok(!('password_hash' in r.body));

  const c = (await db.query('SELECT * FROM partners WHERE id = $1', [r.body.id])).rows[0];
  assert.equal(c.perfil_admin, 'financeiro', 'mesma coluna/valor da ADMIN-002 (migration 089)');
  assert.equal(c.is_admin, true);
  assert.equal(c.must_change_password, true);
  assert.equal(c.type, 'accounting', 'tipo do pedido (employee) é ignorado');
  assert.equal(c.parent_id, null);
  assert.ok(await bcrypt.compare(SENHA_INICIAL, c.password_hash));

  // admin_acoes: quem criou, código e perfil; sem senha e com e-mail mascarado
  const a = (await db.query(`SELECT * FROM admin_acoes WHERE acao = 'admin_financeiro_criado' AND alvo_id = $1`, [c.id])).rows[0];
  assert.ok(a, 'ação registrada');
  assert.equal(a.admin_id, ids.principal);
  assert.match(a.admin_nome, /ADMIN-001/);
  const det = typeof a.detalhes === 'string' ? JSON.parse(a.detalhes) : a.detalhes;
  assert.equal(det.codigo, c.code);
  assert.equal(det.perfil, 'financeiro');
  assert.match(det.email, /^e\*\*\*@teste\.local$/);
  const texto = JSON.stringify(a);
  assert.ok(!texto.includes(SENHA_INICIAL), 'sem senha');
  assert.ok(!texto.includes(c.email), 'sem e-mail inteiro');
});

test('servidor recusa a criação para outro admin, financeiro, Fernando, funcionário e Partner', async () => {
  const antes = Number((await db.query(`SELECT COUNT(*) n FROM partners WHERE perfil_admin = 'financeiro'`)).rows[0].n);
  for (const [quem, token] of [['outro admin completo', t.outroAdminCompleto], ['admin financeiro', t.outroAdmin],
    ['Fernando', t.fernando], ['funcionário', t.func], ['Partner', t.partner]]) {
    const r = await novoFinanceiro(token);
    assert.equal(r.status, 403, `${quem}: ${JSON.stringify(r.body)}`);
  }
  // perfil desconhecido também é recusado
  assert.equal((await novoFinanceiro(t.principal, { perfil_admin: 'superadmin' })).status, 400);
  const depois = Number((await db.query(`SELECT COUNT(*) n FROM partners WHERE perfil_admin = 'financeiro'`)).rows[0].n);
  assert.equal(depois, antes, 'nenhuma conta nova');
});

test('o Financeiro criado enxerga Comissões do Partner e não enxerga Universidade, Regras nem criar administrador', async () => {
  const r = await novoFinanceiro(t.principal);
  assert.equal(r.status, 201);

  // login de verdade e troca da senha provisória
  const login = await chamar('POST', '/api/auth/login', null, { identifier: r.body.code, password: SENHA_INICIAL });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const tk = login.body.token;
  let x = await chamar('GET', '/api/partner-comissoes/admin/lancamentos', tk);
  assert.equal(x.status, 403, 'antes de trocar a senha provisória, nada abre');
  assert.equal((await chamar('PUT', '/api/auth/force-change-password', tk, { newPassword: 'nova-senha-981' })).status, 200);
  const me = await chamar('GET', '/api/auth/me', tk);
  assert.equal(me.body.perfil, 'financeiro');
  assert.equal(me.body.is_admin, false, 'no servidor não é admin completo');

  // Comissões do Partner: lançamentos, aprovar, pagar, Cadastro para pagamento
  const pc = require('../src/services/partnerComissoes');
  const lanc = (await pc.criarLancamento(db, {
    partner_id: ids.partner, origem: 'azul', produto: 'Consignado INSS', cliente_nome: 'Cliente 981',
    competencia: '2026-09', base_valor: '100.00', percentual: '30', status: 'confirmado', criado_por: 'teste',
  })).lancamento;
  x = await chamar('GET', '/api/partner-comissoes/admin/lancamentos', tk);
  assert.equal(x.status, 200);
  assert.ok(x.body.some(l => l.id === lanc.id));
  x = await chamar('POST', '/api/partner-comissoes/admin/lancamentos/aprovar', tk, { ids: [lanc.id] });
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.deepEqual(x.body.alterados.map(l => l.id), [lanc.id]);
  x = await chamar('POST', '/api/partner-comissoes/admin/lancamentos/pagar', tk, { ids: [lanc.id], data_pagamento: '2026-10-20' });
  assert.equal(x.status, 200, JSON.stringify(x.body));
  assert.deepEqual(x.body.alterados.map(l => l.id), [lanc.id]);
  assert.equal((await chamar('GET', '/api/partner-comissoes/admin/cadastros', tk)).status, 200);
  x = await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.partner}/documento`, tk, { documento: '390.533.447-05', tipo_parceiro: 'autonomo' });
  assert.equal(x.status, 200, JSON.stringify(x.body));

  // não enxerga
  assert.equal((await chamar('GET', '/api/universidade/admin/progresso', tk)).status, 403, 'Universidade');
  x = await chamar('POST', '/api/partner-comissoes/admin/regras', tk, { origem: 'azul', nivel_partner: 'mobile', percentual: '50', vigente_desde: '2026-11-01' });
  assert.equal(x.status, 403, 'Regras de comissão');
  assert.equal((await novoFinanceiro(tk)).status, 403, 'criar administrador financeiro');
  x = await chamar('POST', '/api/partners', tk, { name: 'X', email: 'x981@teste.local', type: 'employee', password: '123456', is_admin: true });
  assert.equal(x.status, 201, 'cria só contabilidade (como antes)');
  const criada = (await db.query('SELECT type, is_admin, perfil_admin FROM partners WHERE id = $1', [x.body.id])).rows[0];
  assert.deepEqual(criada, { type: 'accounting', is_admin: false, perfil_admin: null });
});

test('criar funcionário e contabilidade continua igual a antes', async () => {
  const contab = await chamar('POST', '/api/partners', t.principal, { name: 'Contab 981', email: 'contab981@teste.local', type: 'accounting', password: '123456' });
  assert.equal(contab.status, 201, JSON.stringify(contab.body));
  assert.match(contab.body.code, /^CONT-IT-\d{3}$/);
  const func = await chamar('POST', '/api/partners', t.principal, {
    name: 'Func 981', email: 'func981@teste.local', type: 'employee', password: '123456', parent_id: contab.body.id,
  });
  assert.equal(func.status, 201, JSON.stringify(func.body));
  assert.match(func.body.code, /^FUNC-IT-CS-\d{3}$/);
  for (const id of [contab.body.id, func.body.id]) {
    const c = (await db.query('SELECT is_admin, perfil_admin, must_change_password FROM partners WHERE id = $1', [id])).rows[0];
    assert.deepEqual(c, { is_admin: false, perfil_admin: null, must_change_password: false });
  }
  assert.equal((await db.query('SELECT parent_id FROM partners WHERE id = $1', [func.body.id])).rows[0].parent_id, contab.body.id);
  // sem ação de admin financeiro para contas comuns
  const n = Number((await db.query(`SELECT COUNT(*) n FROM admin_acoes WHERE acao = 'admin_financeiro_criado' AND alvo_id = ANY($1::int[])`, [[contab.body.id, func.body.id]])).rows[0].n);
  assert.equal(n, 0);
  // e-mail repetido continua 409
  assert.equal((await chamar('POST', '/api/partners', t.principal, { name: 'Dup', email: 'contab981@teste.local', type: 'accounting', password: '123456' })).status, 409);
  // Fernando continua cadastrando contabilidade
  const f = await chamar('POST', '/api/partners', t.fernando, { name: 'Contab F 981', email: 'contabf981@teste.local', type: 'employee', password: '123456' });
  assert.equal(f.status, 201, JSON.stringify(f.body));
  assert.equal(f.body.type, 'accounting');
});
