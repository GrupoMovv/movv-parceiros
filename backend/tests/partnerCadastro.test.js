// Chave PIX e documento do MOVV Partner (migration 098). Banco em memória
// (PGlite) com o app de verdade; nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { novoBanco, usarNoApp } = require('./helpers/bancoTeste');
const v = require('../src/utils/validators');

process.env.JWT_SECRET = 'segredo-de-teste';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_teste_sem_envio';

// ─── Validação e máscara ────────────────────────────────────────────────────

test('PIX por tipo: valida e normaliza', () => {
  assert.deepEqual(v.validarPix('cpf', '529.982.247-25'), { chave: '52998224725' });
  assert.match(v.validarPix('cpf', '111.111.111-11').erro, /CPF/);
  assert.deepEqual(v.validarPix('cnpj', '11.222.333/0001-81'), { chave: '11222333000181' });
  assert.match(v.validarPix('cnpj', '11.222.333/0001-80').erro, /CNPJ/);
  assert.deepEqual(v.validarPix('email', ' Ana@Exemplo.com '), { chave: 'ana@exemplo.com' });
  assert.match(v.validarPix('email', 'ana@').erro, /E-mail/);
  assert.deepEqual(v.validarPix('telefone', '(64) 99999-1234'), { chave: '+5564999991234' });
  assert.deepEqual(v.validarPix('telefone', '+55 64 99999-1234'), { chave: '+5564999991234' });
  assert.match(v.validarPix('telefone', '(64) 3333-1234').erro, /Celular/);
  assert.deepEqual(v.validarPix('aleatoria', '123E4567-E89B-12D3-A456-426614174000'), { chave: '123e4567-e89b-12d3-a456-426614174000' });
  assert.match(v.validarPix('aleatoria', 'abc').erro, /aleatória/);
  assert.match(v.validarPix('outro', 'x').erro, /tipo/);
  assert.match(v.validarPix('email', '').erro, /Informe/);
});

test('máscaras nunca mostram o valor inteiro', () => {
  assert.equal(v.mascararCpf('52998224725'), '529.***.***-25');
  assert.equal(v.mascararCnpj('11222333000181'), '11.***.***/****-81');
  assert.equal(v.mascararDocumento('11222333000181'), '11.***.***/****-81');
  assert.equal(v.mascararDocumento('52998224725'), '529.***.***-25');
  assert.equal(v.mascararPix('email', 'ana@exemplo.com'), 'a***@exemplo.com');
  assert.equal(v.mascararPix('telefone', '+5564999991234'), '+55 (64) *****-1234');
  assert.equal(v.mascararPix('aleatoria', '123e4567-e89b-12d3-a456-426614174000'), '123e…4000');
  assert.equal(v.mascararPix('cpf', '52998224725'), '529.***.***-25');
});

// ─── Pela API ───────────────────────────────────────────────────────────────

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

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('senha-certa', 4);
  const partner = async (code, type, extra = {}) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, is_admin, perfil_admin, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING id`,
    [code, `Nome ${code}`, `${code.toLowerCase()}@teste.local`, hash, type, extra.nivel || null, Boolean(extra.admin), extra.perfil || null]
  )).rows[0].id;
  ids.admin = await partner('ADMIN-951', 'accounting', { admin: true });
  ids.fin = await partner('FIN-951', 'accounting', { admin: true, perfil: 'financeiro' });
  ids.a = await partner('PARTNER-951', 'movv_partner', { nivel: 'mobile' });
  ids.b = await partner('PARTNER-952', 'movv_partner', { nivel: 'mobile' });
  ids.fernando = (await db.query(
    `INSERT INTO internal_collaborators (name, email, password_hash, role, must_change_password)
     VALUES ('Fernando Teste', 'fernando951@teste.local', 'x', 'comercial_full', false) RETURNING id`)).rows[0].id;
  const assinar = id => jwt.sign({ id, userType: 'partner' }, process.env.JWT_SECRET);
  t.admin = assinar(ids.admin);
  t.fin = assinar(ids.fin);
  t.a = assinar(ids.a);
  t.b = assinar(ids.b);
  t.fernando = jwt.sign({ id: ids.fernando, userType: 'internal', role: 'comercial_full' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

// O interceptor do portal (frontend/src/services/api.js) trata QUALQUER 401
// como sessão expirada e manda para /login. Senha errada na troca do PIX não
// pode responder 401, e a sessão tem de continuar valendo.
test('Meu perfil: senha errada na troca do PIX não derruba a sessão (400, não 401)', async () => {
  const antes = (await db.query('SELECT pix_key FROM partners WHERE id = $1', [ids.a])).rows[0].pix_key;
  const hist = async () => Number((await db.query('SELECT COUNT(*) AS n FROM partner_pix_historico WHERE partner_id = $1', [ids.a])).rows[0].n);
  const histAntes = await hist();
  for (const senha of ['errada', '']) {
    const r = await chamar('PUT', '/api/partner/perfil/pix', t.a, { pix_key_type: 'email', pix_key: 'outra@exemplo.com', senha_atual: senha });
    assert.notEqual(r.status, 401, '401 desloga o Partner no portal');
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'Senha atual incorreta.');
  }
  // o mesmo token continua valendo, e nada mudou
  const r = await chamar('GET', '/api/partner/perfil', t.a);
  assert.equal(r.status, 200);
  assert.equal((await db.query('SELECT pix_key FROM partners WHERE id = $1', [ids.a])).rows[0].pix_key, antes);
  assert.equal(await hist(), histAntes);
});

test('Meu perfil: Partner troca o próprio PIX só com a senha atual; o histórico fica mascarado', async () => {
  let r = await chamar('GET', '/api/partner/perfil', t.a);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.faltas, ['chave PIX', 'CPF/CNPJ']);

  r = await chamar('PUT', '/api/partner/perfil/pix', t.a, { pix_key_type: 'email', pix_key: 'ana@exemplo.com', senha_atual: 'errada' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Senha atual incorreta/);
  r = await chamar('PUT', '/api/partner/perfil/pix', t.a, { pix_key_type: 'telefone', pix_key: '123', senha_atual: 'senha-certa' });
  assert.equal(r.status, 400);
  r = await chamar('PUT', '/api/partner/perfil/pix', t.a, { pix_key_type: 'email', pix_key: 'Ana@Exemplo.com', senha_atual: 'senha-certa' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.pix_key, 'ana@exemplo.com');

  r = await chamar('GET', '/api/partner/perfil', t.a);
  assert.equal(r.body.pix_key, 'ana@exemplo.com', 'a própria chave o Partner vê inteira');
  assert.deepEqual(r.body.faltas, ['CPF/CNPJ']);

  const h = (await db.query('SELECT valor_antes, valor_depois, alterado_por_nome FROM partner_pix_historico WHERE partner_id = $1', [ids.a])).rows;
  assert.equal(h.length, 1);
  assert.equal(h[0].valor_antes, null);
  assert.equal(h[0].valor_depois, 'email: a***@exemplo.com');
  assert.ok(!JSON.stringify(h).includes('ana@exemplo.com'));
});

test('documento: só admin e financeiro; Partner e Fernando não; inválido e duplicado são recusados; admin_acoes mascarado', async () => {
  const doc = { documento: '529.982.247-25', tipo_parceiro: 'autonomo' };
  assert.equal((await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.a}/documento`, t.a, doc)).status, 403);
  assert.equal((await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.a}/documento`, t.fernando, doc)).status, 403);
  let r = await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.a}/documento`, t.fin, { documento: '529.982.247-25', tipo_parceiro: 'mei' });
  assert.equal(r.status, 400, 'MEI precisa de CNPJ');
  r = await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.a}/documento`, t.fin, { documento: '111.111.111-11', tipo_parceiro: 'autonomo' });
  assert.equal(r.status, 400);
  r = await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.a}/documento`, t.fin, doc);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.documento, '529.***.***-25');
  r = await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.b}/documento`, t.admin, doc);
  assert.equal(r.status, 409, 'o mesmo CPF em dois Partners');
  r = await chamar('PUT', `/api/partner-comissoes/admin/partners/${ids.b}/documento`, t.admin,
    { documento: '11.222.333/0001-81', tipo_parceiro: 'pj', razao_social: 'Bruno Serviços Ltda' });
  assert.equal(r.status, 200);

  const acoes = (await db.query(`SELECT detalhes FROM admin_acoes WHERE acao = 'partner_documento_salvo'`)).rows;
  assert.equal(acoes.length, 2);
  const texto = JSON.stringify(acoes);
  assert.ok(!texto.includes('52998224725') && !texto.includes('11222333000181'), 'nada de documento inteiro em admin_acoes');
  assert.ok(texto.includes('529.***.***-25'));
  // o Partner vê o próprio documento mascarado
  assert.equal((await chamar('GET', '/api/partner/perfil', t.a)).body.documento, '529.***.***-25');
});

test('cadastro para pagamento: lista mascarada, filtro de incompletos e completo só para a equipe', async () => {
  let r = await chamar('GET', '/api/partner-comissoes/admin/cadastros', t.fin);
  assert.equal(r.status, 200);
  const a = r.body.find(x => x.id === ids.a);
  assert.equal(a.pix, 'a***@exemplo.com');
  assert.equal(a.documento, '529.***.***-25');
  assert.deepEqual(a.faltas, []);
  assert.ok(a.pix_alterada_em, 'troca de PIX recente aparece para a equipe');
  r = await chamar('GET', '/api/partner-comissoes/admin/cadastros?incompletos=1', t.admin);
  assert.deepEqual(r.body.map(x => x.id), [ids.b], 'B está sem PIX');
  assert.deepEqual(r.body[0].faltas, ['chave PIX']);
  assert.equal((await chamar('GET', '/api/partner-comissoes/admin/cadastros', t.fernando)).status, 403);
  assert.equal((await chamar('GET', '/api/partner-comissoes/admin/cadastros', t.a)).status, 403);
  r = await chamar('GET', `/api/partner-comissoes/admin/partners/${ids.a}/cadastro`, t.admin);
  assert.equal(r.body.pix_key, 'ana@exemplo.com');
  assert.equal(r.body.documento, '52998224725');
});

test('aprovar só avisa; pagar bloqueia sem PIX ou documento e libera depois de completar', async () => {
  const pc = require('../src/services/partnerComissoes');
  const { lancamento } = await pc.criarLancamento(db, {
    partner_id: ids.b, origem: 'azul', produto: 'INSS', competencia: '2026-10',
    base_valor: '100.00', percentual: '30', status: 'confirmado', criado_por: 'teste',
  });
  let r = await chamar('POST', '/api/partner-comissoes/admin/lancamentos/aprovar', t.admin, { ids: [lancamento.id] });
  assert.equal(r.body.alterados.length, 1, 'aprovar não bloqueia');
  assert.match(r.body.avisos[0].motivo, /chave PIX/);

  r = await chamar('POST', `/api/partner-comissoes/admin/lancamentos/${lancamento.id}/pagar`, t.fin, { data_pagamento: '2026-11-06' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Cadastro incompleto para pagamento: falta chave PIX/);
  assert.equal((await db.query('SELECT status FROM partner_comissoes WHERE id = $1', [lancamento.id])).rows[0].status, 'aprovado');

  r = await chamar('PUT', '/api/partner/perfil/pix', t.b, { pix_key_type: 'cnpj', pix_key: '11.222.333/0001-81', senha_atual: 'senha-certa' });
  assert.equal(r.status, 200);
  r = await chamar('POST', `/api/partner-comissoes/admin/lancamentos/${lancamento.id}/pagar`, t.fin, { data_pagamento: '2026-11-06' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.alterados[0].status, 'pago');
});

test('com a trava do portal ligada, o Partner sem certificado ainda abre o próprio cadastro de PIX', async () => {
  await db.query(`INSERT INTO universidade_config (chave, valor) VALUES ('trava_portal', 'true')
                  ON CONFLICT (chave) DO UPDATE SET valor = 'true'`);
  assert.equal((await chamar('GET', '/api/partner/perfil', t.a)).status, 200);
  assert.equal((await chamar('GET', '/api/partner-comissoes/vendas', t.a)).status, 403, 'o resto do portal continua travado');
  await db.query(`UPDATE universidade_config SET valor = 'false' WHERE chave = 'trava_portal'`);
});
