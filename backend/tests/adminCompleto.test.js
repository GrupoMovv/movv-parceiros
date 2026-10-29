// "Administrador — Completo" no Novo Parceiro (Junior, 29/10/2026): só o
// ADMIN-001 cria conta admin sem perfil (perfil_admin NULL = acesso total).
// Banco em memória (PGlite) com o app de verdade; nunca toca produção.
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
const SENHA_INICIAL = 'provisoria-982';

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

// o que a tela manda na opção "Administrador — Completo"
const novoCompleto = (token, extra = {}) => chamar('POST', '/api/partners', token, {
  name: 'Admin Completo', email: `completo${Math.random().toString(36).slice(2, 7)}@teste.local`,
  type: 'accounting', parent_id: '', password: SENHA_INICIAL, is_admin: true, ...extra,
});

// tudo o que vai para o console enquanto fn roda
async function capturarConsole(fn) {
  const linhas = [];
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(orig)) console[k] = (...a) => { linhas.push(a.map(String).join(' ')); };
  try { return { valor: await fn(), linhas }; } finally { Object.assign(console, orig); }
}

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('senha-certa', 4);
  const conta = async (code, type, extra = {}) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, is_admin, perfil_admin, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id`,
    [code, `Nome ${code}`, `${code.toLowerCase()}@teste.local`, hash, type, Boolean(extra.admin), extra.perfil || null]
  )).rows[0].id;
  ids.principal = await conta('ADMIN-001', 'accounting', { admin: true });
  ids.financeiro = await conta('ADMIN-002', 'accounting', { admin: true, perfil: 'financeiro' });
  ids.outroAdmin = await conta('ADMIN-T09', 'accounting', { admin: true });
  ids.contab = await conta('CONT-IT-982', 'accounting');
  for (const k of Object.keys(ids)) t[k] = jwt.sign({ id: ids[k], userType: 'partner' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

test('ADMIN-001 cria "Administrador — Completo": is_admin, sem perfil, ADMIN-00N, troca de senha obrigatória', async () => {
  const { valor: r, linhas } = await capturarConsole(() => novoCompleto(t.principal, { type: 'employee', parent_id: ids.contab }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.code, /^ADMIN-\d{3}$/);
  assert.equal(r.body.is_admin, true);
  assert.equal(r.body.perfil_admin, null);
  assert.ok(!('password_hash' in r.body));

  const c = (await db.query('SELECT * FROM partners WHERE id = $1', [r.body.id])).rows[0];
  assert.equal(c.is_admin, true);
  assert.equal(c.perfil_admin, null, 'sem perfil = admin completo');
  assert.equal(c.must_change_password, true);
  assert.equal(c.type, 'accounting', 'tipo do pedido (employee) é ignorado');
  assert.equal(c.parent_id, null, 'admin não fica vinculado a contabilidade');
  assert.ok(await bcrypt.compare(SENHA_INICIAL, c.password_hash));

  // admin_acoes: quem criou, código e perfil; sem senha e com e-mail mascarado
  const a = (await db.query(`SELECT * FROM admin_acoes WHERE acao = 'admin_completo_criado' AND alvo_id = $1`, [c.id])).rows[0];
  assert.ok(a, 'ação registrada');
  assert.equal(a.admin_id, ids.principal);
  assert.match(a.admin_nome, /ADMIN-001/);
  const det = typeof a.detalhes === 'string' ? JSON.parse(a.detalhes) : a.detalhes;
  assert.deepEqual(Object.keys(det).sort(), ['codigo', 'email', 'perfil']);
  assert.equal(det.codigo, c.code);
  assert.equal(det.perfil, 'completo');
  assert.match(det.email, /^c\*\*\*@teste\.local$/);
  const texto = JSON.stringify(a);
  assert.ok(!texto.includes(SENHA_INICIAL), 'sem senha em admin_acoes');
  assert.ok(!texto.includes(c.email), 'sem e-mail inteiro em admin_acoes');

  // nem no console
  assert.ok(!linhas.some(l => l.includes(SENHA_INICIAL)), 'sem senha no log');
  assert.ok(!linhas.some(l => l.includes(c.email)), 'sem e-mail inteiro no log');
});

test('só o ADMIN-001 cria admin completo: outro admin recebe 403 e o financeiro não cria admin', async () => {
  const conta = async () => Number((await db.query(`SELECT COUNT(*) n FROM partners WHERE is_admin`)).rows[0].n);
  const antes = await conta();
  const r = await novoCompleto(t.outroAdmin);
  assert.equal(r.status, 403, `outro admin completo: ${JSON.stringify(r.body)}`);
  // o financeiro não chega a criar admin: como antes, o servidor ignora o
  // is_admin dele e cadastra só uma contabilidade comum (adminFinanceiro.test.js)
  const f = await novoCompleto(t.financeiro);
  assert.equal(f.status, 201, JSON.stringify(f.body));
  assert.deepEqual([f.body.is_admin, f.body.perfil_admin], [false, null]);
  assert.match(f.body.code, /^CONT-IT-\d{3}$/);
  // contabilidade não cria nada
  assert.equal((await novoCompleto(t.contab)).status, 403);
  assert.equal(await conta(), antes, 'nenhuma conta admin nova');
  assert.equal((await db.query(`SELECT COUNT(*)::int AS n FROM admin_acoes WHERE acao LIKE 'admin_%_criado' AND admin_id <> $1`, [ids.principal])).rows[0].n, 0);
});

test('o admin completo troca a senha no 1º acesso e depois tem acesso total (Regras), sem criar admin', async () => {
  const r = await novoCompleto(t.principal);
  assert.equal(r.status, 201);

  const login = await chamar('POST', '/api/auth/login', null, { identifier: r.body.code, password: SENHA_INICIAL });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const tk = login.body.token;
  assert.equal((await chamar('GET', '/api/partner-comissoes/admin/regras', tk)).status, 403, 'antes de trocar a senha provisória, nada abre');
  assert.equal((await chamar('PUT', '/api/auth/force-change-password', tk, { newPassword: 'nova-senha-982' })).status, 200);

  const me = await chamar('GET', '/api/auth/me', tk);
  assert.equal(me.body.is_admin, true, 'no servidor é admin completo');
  assert.ok(!me.body.perfil, 'sem perfil financeiro');
  const regra = await chamar('POST', '/api/partner-comissoes/admin/regras', tk,
    { origem: 'movv_cred', nivel_partner: 'hub', base: 'comissao_recebida', percentual: '10', vigente_desde: '2027-01-01' });
  assert.equal(regra.status, 201, `Regras: ${JSON.stringify(regra.body)}`);

  // não cria admin (nem completo nem financeiro)
  assert.equal((await novoCompleto(tk)).status, 403);
  assert.equal((await novoCompleto(tk, { is_admin: undefined, perfil_admin: 'financeiro' })).status, 403);
});

test('Financeiro continua registrado como antes; contabilidade e funcionário seguem sem registro', async () => {
  const f = await chamar('POST', '/api/partners', t.principal, {
    name: 'Fin 982', email: 'fin982@teste.local', type: 'accounting', parent_id: '', password: SENHA_INICIAL, perfil_admin: 'financeiro',
  });
  assert.equal(f.status, 201, JSON.stringify(f.body));
  assert.equal(f.body.perfil_admin, 'financeiro');
  const a = (await db.query(`SELECT acao, detalhes FROM admin_acoes WHERE alvo_id = $1`, [f.body.id])).rows;
  assert.equal(a.length, 1);
  assert.equal(a[0].acao, 'admin_financeiro_criado');
  const det = typeof a[0].detalhes === 'string' ? JSON.parse(a[0].detalhes) : a[0].detalhes;
  assert.equal(det.perfil, 'financeiro');

  const contab = await chamar('POST', '/api/partners', t.principal, { name: 'Contab 982', email: 'contab982@teste.local', type: 'accounting', password: '123456' });
  assert.equal(contab.status, 201);
  assert.match(contab.body.code, /^CONT-IT-\d{3}$/);
  const func = await chamar('POST', '/api/partners', t.principal, {
    name: 'Func 982', email: 'func982@teste.local', type: 'employee', password: '123456', parent_id: contab.body.id,
  });
  assert.equal(func.status, 201);
  assert.match(func.body.code, /^FUNC-IT-CS-\d{3}$/);
  const n = (await db.query(`SELECT COUNT(*)::int AS n FROM admin_acoes WHERE alvo_id = ANY($1::int[])`, [[contab.body.id, func.body.id]])).rows[0].n;
  assert.equal(n, 0);
});
