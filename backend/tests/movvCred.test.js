// MOVV CRED (migration 105, Junior 28/10/2026): crédito do Grupo fora da
// Azul, com origem própria 'movv_cred' no livro. Só lançamento manual, com o
// percentual da regra cadastrada pelo admin. Banco em memória (PGlite);
// nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { novoBanco, usarNoApp } = require('./helpers/bancoTeste');
const pc = require('../src/services/partnerComissoes');
const portal = require('../src/services/partnerPortal');

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

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const hash = await bcrypt.hash('senha-certa', 4);
  const conta = async (code, type, extra = {}) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, is_admin, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id`,
    [code, `Nome ${code}`, `${code.toLowerCase()}@teste.local`, hash, type, extra.nivel || null, Boolean(extra.admin)]
  )).rows[0].id;
  ids.admin = await conta('ADMIN-981', 'accounting', { admin: true });
  ids.partner = await conta('PARTNER-981', 'movv_partner', { nivel: 'mobile' });
  for (const k of Object.keys(ids)) t[k] = jwt.sign({ id: ids[k], userType: 'partner' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

test('admin cadastra o produto MOVV CRED (Crédito) e o Partner indica com CPF', async () => {
  const p = await chamar('POST', '/api/products', t.admin, { name: 'MOVV CRED', type: 'credit', faixa: 'media' });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  ids.produto = p.body.id;
  const r = await chamar('POST', '/api/referrals', t.partner, {
    client_name: 'Cliente CRED', client_whatsapp: '64999990000', product_id: ids.produto, client_documento: '529.982.247-25',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  ids.indicacao = r.body.id;
  const c = await chamar('PATCH', `/api/referrals/${ids.indicacao}/dados`, t.admin, { numero_contrato: '880000001' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
});

test('lançamento manual de MOVV CRED sem regra vigente é recusado com mensagem clara', async () => {
  await assert.rejects(pc.criarManual(db, {
    partner_id: ids.partner, origem: 'movv_cred', produto: 'MOVV CRED', competencia: '2026-10',
    base_valor: '133.44', observacao: 'comissão do MOVV CRED',
  }, 'Admin'), /Sem regra vigente para movv_cred \/ nível mobile em 2026-10-\d\d\. Cadastre a regra antes\./);
  // pela rota do admin, a mesma mensagem
  const r = await chamar('POST', '/api/partner-comissoes/admin/lancamentos', t.admin, {
    partner_id: ids.partner, origem: 'movv_cred', produto: 'MOVV CRED', competencia: '2026-10', base_valor: '133.44', observacao: 'x',
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Sem regra vigente para movv_cred/);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM partner_comissoes WHERE origem = 'movv_cred'`)).rows[0].n, 0);
});

test('com a regra de 30% (cadastrada pela rota do admin) o lançamento calcula e grava o percentual', async () => {
  // MOVV CRED só sobre a comissão recebida
  const ruim = await chamar('POST', '/api/partner-comissoes/admin/regras', t.admin,
    { origem: 'movv_cred', nivel_partner: 'mobile', base: 'valor_venda', percentual: '30', vigente_desde: '2026-10-01' });
  assert.equal(ruim.status, 400);
  for (const nivel of pc.NIVEIS) {
    const r = await chamar('POST', '/api/partner-comissoes/admin/regras', t.admin,
      { origem: 'movv_cred', nivel_partner: nivel, base: 'comissao_recebida', percentual: '30', vigente_desde: '2026-10-01' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }

  const l = await chamar('POST', '/api/partner-comissoes/admin/lancamentos', t.admin, {
    partner_id: ids.partner, origem: 'movv_cred', produto: 'MOVV CRED', competencia: '2026-10', data_referencia: '2026-10-20',
    base_valor: '133.44', numero_contrato: '880000001', cliente_nome: 'Cliente CRED', observacao: 'comissão do MOVV CRED recebida',
  });
  assert.equal(l.status, 201, JSON.stringify(l.body));
  assert.equal(l.body.origem, 'movv_cred');
  assert.equal(l.body.percentual, '30.0000');
  assert.equal(l.body.valor_partner, '40.03');                   // 40,032
  assert.equal(l.body.status, 'confirmado');
  assert.equal(l.body.lancado_manualmente, true);
  const regra = (await db.query('SELECT origem, base FROM partner_comissao_regras WHERE id = $1', [l.body.regra_id])).rows[0];
  assert.deepEqual(regra, { origem: 'movv_cred', base: 'comissao_recebida' });

  // mudar a regra depois não mexe no lançamento
  await db.query(`UPDATE partner_comissao_regras SET percentual = 35 WHERE origem = 'movv_cred' AND nivel_partner = 'mobile'`);
  const depois = (await db.query('SELECT percentual, valor_partner FROM partner_comissoes WHERE id = $1', [l.body.id])).rows[0];
  assert.deepEqual(depois, { percentual: '30.0000', valor_partner: '40.03' });
  await db.query(`UPDATE partner_comissao_regras SET percentual = 30 WHERE origem = 'movv_cred' AND nivel_partner = 'mobile'`);
});

test('Partner vê "MOVV CRED" em Minhas vendas, nunca "Azul"', async () => {
  const r = await chamar('GET', '/api/partner-comissoes/vendas', t.partner);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const { comissao, vendas } = r.body;
  const linha = vendas.find(v => v.tipo === 'lancamento');
  assert.equal(linha.produto, 'MOVV CRED');
  assert.equal(linha.detalhes.origem, 'MOVV CRED');
  assert.equal(linha.valor, '40.03');
  assert.equal(linha.situacao, 'Comissão confirmada');
  assert.ok(!vendas.some(v => v.detalhes.origem === 'Azul'));
  // mesmo contrato: a indicação vira a linha da comissão
  assert.ok(!vendas.some(v => v.tipo === 'indicacao'), 'uma linha só');
  assert.ok(comissao.some(c => c.rotulo === 'MOVV CRED' && c.texto === '30%'), JSON.stringify(comissao));
  assert.doesNotMatch(JSON.stringify(r.body), /52998224725/, 'CPF nunca inteiro');
  // e o mesmo pelo serviço (lista única de vendas)
  const v = await portal.vendasDoPartner(db, ids.partner);
  assert.equal(v[0].detalhes.origem, 'MOVV CRED');
});

test('Azul, Certificado e Seguros continuam aceitos no lançamento manual como antes', async () => {
  for (const origem of ['azul', 'certificado', 'seguro']) assert.ok(pc.ORIGENS_ATIVAS.includes(origem));
  assert.deepEqual(pc.BASES_POR_ORIGEM.azul, ['comissao_recebida']);
  assert.deepEqual(pc.BASES_POR_ORIGEM.certificado, ['valor_venda', 'lucro_grupo']);
  assert.deepEqual(pc.BASES_POR_ORIGEM.seguro, ['comissao_recebida']);
  const l = await pc.criarManual(db, {
    partner_id: ids.partner, origem: 'azul', produto: 'Consignado INSS', competencia: '2026-10', data_referencia: '2026-10-20',
    base_valor: '133.44', observacao: 'teste azul',
  }, 'Admin');
  assert.equal(l.origem, 'azul');
  assert.equal(l.percentual, '30.0000', 'regra da Azul da migration 093');
  assert.equal(l.valor_partner, '40.03');
});
