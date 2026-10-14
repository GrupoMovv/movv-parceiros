// Livro de comissões do Partner pela API (Express de verdade), com o banco
// PGlite no lugar do Postgres: permissões, isolamento entre Partners, venda
// do Movv Certificado gerando lançamento e produtos por tipo de usuário.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { novoBanco, usarNoApp } = require('./helpers/bancoTeste');

process.env.JWT_SECRET = 'segredo-de-teste';
// o app cria o cliente de e-mail ao carregar; nenhuma rota testada aqui envia e-mail
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_teste_sem_envio';

let db;
let servidor;
let base;
const t = {};       // tokens
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

async function partner(code, type, extra = {}) {
  const r = await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, is_admin)
     VALUES ($1, $2, $3, 'x', $4, $5, $6) RETURNING id`,
    [code, `Nome ${code}`, `${code.toLowerCase()}@teste.local`, type, extra.nivel || null, Boolean(extra.admin)]
  );
  return r.rows[0].id;
}

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;

  ids.admin = await partner('ADMIN-901', 'accounting', { admin: true });
  ids.contab = await partner('CONT-901', 'accounting');
  ids.a = await partner('PARTNER-911', 'movv_partner', { nivel: 'point' });
  ids.b = await partner('PARTNER-912', 'movv_partner', { nivel: 'regional' });
  ids.fernando = (await db.query(
    `INSERT INTO internal_collaborators (name, email, password_hash, role, must_change_password)
     VALUES ('Fernando Teste', 'fernando@teste.local', 'x', 'comercial_full', false) RETURNING id`
  )).rows[0].id;
  await db.query(`INSERT INTO products (name, type, faixa, percentual_repasse, commission_rate) VALUES ('Consignado', 'credit', 'alta', 0.01, 0.01)`);

  const assinar = (id, extra = {}) => jwt.sign({ id, userType: 'partner', ...extra }, process.env.JWT_SECRET);
  t.admin = assinar(ids.admin);
  t.contab = assinar(ids.contab);
  t.a = assinar(ids.a);
  t.b = assinar(ids.b);
  t.fernando = jwt.sign({ id: ids.fernando, userType: 'internal', role: 'comercial_full' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

test('Partner não abre as rotas do admin; admin lança manual', async () => {
  assert.equal((await chamar('GET', '/api/partner-comissoes/admin/lancamentos', t.a)).status, 403);
  assert.equal((await chamar('POST', '/api/partner-comissoes/admin/regras', t.a, {})).status, 403);
  assert.equal((await chamar('GET', '/api/partner-comissoes/minhas', t.admin)).status, 403);

  for (const [p, baseValor] of [[ids.a, '100.00'], [ids.a, '33.33'], [ids.b, '500.00']]) {
    const r = await chamar('POST', '/api/partner-comissoes/admin/lancamentos', t.admin, {
      partner_id: p, origem: 'azul', produto: 'Consignado INSS', competencia: '2026-10',
      base_valor: baseValor, observacao: 'teste API', cliente_nome: 'Cliente X',
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }
});

test('cada Partner vê só os próprios lançamentos, com base, percentual e valor', async () => {
  const a = await chamar('GET', '/api/partner-comissoes/minhas', t.a);
  const b = await chamar('GET', '/api/partner-comissoes/minhas', t.b);
  assert.equal(a.status, 200);
  assert.equal(a.body.lancamentos.length, 2);
  assert.equal(b.body.lancamentos.length, 1);
  assert.deepEqual(a.body.lancamentos.map(x => x.valor_partner).sort(), ['10.00', '30.00']);
  assert.equal(b.body.lancamentos[0].valor_partner, '150.00');
  assert.equal(a.body.totais.a_receber, '40.00');
  for (const x of a.body.lancamentos) {
    assert.equal(x.percentual, '30.0000');
    assert.ok(!('partner_id' in x) && !('regra_id' in x) && !('aprovado_por' in x));
  }
  const tabela = await chamar('GET', '/api/partner-comissoes/tabela', t.a);
  assert.equal(tabela.body.nivel, 'point');
  assert.ok(tabela.body.regras.length >= 1);
});

test('admin: pagar sem aprovar é recusado; o fluxo completo grava quem fez', async () => {
  const lista = await chamar('GET', `/api/partner-comissoes/admin/lancamentos?partner_id=${ids.b}`, t.admin);
  const id = lista.body[0].id;
  let r = await chamar('POST', `/api/partner-comissoes/admin/lancamentos/${id}/pagar`, t.admin, { data_pagamento: '2026-10-13' });
  assert.equal(r.status, 409);
  r = await chamar('POST', '/api/partner-comissoes/admin/lancamentos/aprovar', t.admin, { ids: [id] });
  assert.equal(r.body.alterados[0].status, 'aprovado');
  r = await chamar('POST', `/api/partner-comissoes/admin/lancamentos/${id}/pagar`, t.admin, { data_pagamento: '2026-10-13', observacao: 'PIX' });
  assert.equal(r.status, 200);
  assert.equal(r.body.alterados[0].pago_por, 'Nome ADMIN-901 (ADMIN-901)');
  const acoes = await db.query(`SELECT acao FROM admin_acoes WHERE alvo_tipo = 'partner_comissoes' AND alvo_id = $1 ORDER BY id`, [id]);
  assert.deepEqual(acoes.rows.map(x => x.acao), ['comissao_partner_manual', 'comissao_partner_aprovar', 'comissao_partner_pagar']);
});

test('venda do Movv Certificado com Partner: 20% do lucro; sem regra vira aviso; cancelar estorna', async () => {
  const lista = await chamar('GET', '/api/partner-comissoes/admin/partners', t.fernando);
  assert.equal(lista.status, 200, JSON.stringify(lista.body));
  assert.ok(lista.body.some(p => p.id === ids.a));

  const venda = {
    tipo_venda: 'direta', cliente_nome: 'Cliente Cert', valor_venda_certificado: '150.00', partner_id: ids.a,
  };
  // antes da regra inicial do Certificado (13/10/2026): sem regra, vira aviso
  let r = await chamar('POST', '/api/direta/sales', t.fernando, { ...venda, data_venda: '2026-10-01' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.aviso_comissao_partner, /Sem regra/);
  const avisos = await chamar('GET', '/api/partner-comissoes/admin/avisos', t.admin);
  const aviso = avisos.body.find(x => x.direta_sale_id === r.body.id);
  assert.ok(aviso);

  r = await chamar('POST', '/api/partner-comissoes/admin/regras', t.admin, {
    origem: 'certificado', nivel_partner: 'point', base: 'valor_venda', percentual: '10',
    vigente_desde: '2026-01-01', vigente_ate: '2026-10-12',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await chamar('POST', `/api/partner-comissoes/admin/avisos/${aviso.id}/tentar`, t.admin);
  assert.equal(r.body.lancamento.valor_partner, '15.00');
  assert.equal(r.body.lancamento.status, 'previsto');

  // depois de 13/10: regra inicial, 20% de (150,00 − 19,90) = 26,02
  r = await chamar('POST', '/api/direta/sales', t.fernando, { ...venda, cliente_nome: 'Cliente Cert 2', data_venda: '2026-10-20' });
  assert.equal(r.body.aviso_comissao_partner, undefined);
  const vendaId = r.body.id;
  const lanc = (await db.query('SELECT * FROM partner_comissoes WHERE direta_sale_id = $1', [vendaId])).rows[0];
  assert.equal(lanc.base_valor, '130.10');
  assert.equal(lanc.valor_partner, '26.02');

  r = await chamar('PATCH', `/api/direta/sales/${vendaId}/cancel`, t.fernando);
  assert.equal(r.status, 200);
  const depois = (await db.query('SELECT status, motivo_estorno FROM partner_comissoes WHERE id = $1', [lanc.id])).rows[0];
  assert.equal(depois.status, 'estornado');
  assert.match(depois.motivo_estorno, /cancelada/);

  // Partner que não é MOVV Partner é recusado na venda
  r = await chamar('POST', '/api/direta/sales', t.fernando, { ...venda, partner_id: ids.contab });
  assert.equal(r.status, 400);
});

test('GET /api/products: cada tipo de usuário vê só o que se aplica a ele', async () => {
  const doPartner = await chamar('GET', '/api/products', t.a);
  assert.deepEqual(Object.keys(doPartner.body[0]).sort(), ['faixa', 'id', 'is_active', 'name', 'type']);
  const daContab = await chamar('GET', '/api/products', t.contab);
  assert.deepEqual(Object.keys(daContab.body[0]).sort(), ['faixa', 'id', 'is_active', 'name', 'percentual_repasse', 'type']);
  const doAdmin = await chamar('GET', '/api/products', t.admin);
  assert.ok('commission_rate' in doAdmin.body[0]);
});

// ─── Etapa 2: CPF e contrato na indicação; upload da importação ─────────────

test('indicação: Partner informa CPF e vê mascarado; contrato só a equipe; equipe registra pelo Partner', async () => {
  const produto = (await db.query(`SELECT id FROM products WHERE type = 'credit' LIMIT 1`)).rows[0].id;
  const base = { client_name: 'Cliente CPF', client_whatsapp: '64999990000', product_id: produto };

  let r = await chamar('POST', '/api/referrals', t.a, { ...base, client_cpf: '111.111.111-11' });
  assert.equal(r.status, 400, 'CPF inválido é recusado');
  r = await chamar('POST', '/api/referrals', t.a, { ...base, client_cpf: '529.982.247-25' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.client_cpf, '529.***.***-25');
  const id = r.body.id;
  assert.equal((await db.query('SELECT client_cpf FROM referrals WHERE id = $1', [id])).rows[0].client_cpf, '52998224725');

  const lista = await chamar('GET', '/api/referrals', t.a);
  assert.equal(lista.body.find(x => x.id === id).client_cpf, '529.***.***-25');
  const doAdmin = await chamar('GET', '/api/referrals', t.admin);
  assert.equal(doAdmin.body.find(x => x.id === id).client_cpf, '52998224725');

  assert.equal((await chamar('PATCH', `/api/referrals/${id}/dados`, t.a, { numero_contrato: '123456789' })).status, 403);
  assert.equal((await chamar('PATCH', `/api/referrals/${id}/dados`, t.a, { client_cpf: '52998224725' })).status, 403, 'CPF já informado');
  assert.equal((await chamar('PATCH', `/api/referrals/${id}/dados`, t.b, { client_cpf: '52998224725' })).status, 403, 'indicação de outro');
  r = await chamar('PATCH', `/api/referrals/${id}/dados`, t.admin, { numero_contrato: '123456789' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.numero_contrato, '123456789');

  // equipe registra em nome do Partner B; o contrato repetido é recusado
  r = await chamar('POST', '/api/referrals', t.admin, { ...base, client_name: 'Pela equipe', partner_id: ids.b });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.partner_id, ids.b);
  assert.equal((await chamar('PATCH', `/api/referrals/${r.body.id}/dados`, t.admin, { numero_contrato: '123456789' })).status, 409);
  // Partner sem CPF pode completar depois
  assert.equal((await chamar('PATCH', `/api/referrals/${r.body.id}/dados`, t.b, { client_cpf: '52998224725' })).status, 200);
});

test('importação da Azul pela API: prévia por upload; Partner não abre', async () => {
  const fs = require('fs');
  const arquivo = fs.readFileSync(require('path').join(__dirname, 'fixtures/azul/exemplo_comissoes_pagas_domus_ficticio.csv'));
  const enviar = async (token, rota) => {
    const form = new FormData();
    form.append('arquivo', new Blob([arquivo]), 'exemplo.csv');
    const resp = await fetch(base + rota, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: resp.status, body: await resp.json() };
  };
  assert.equal((await enviar(t.a, '/api/partner-comissoes/admin/importacao/previa')).status, 403);
  const p = await enviar(t.admin, '/api/partner-comissoes/admin/importacao/previa');
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.linhas_pagas, 11);
  assert.equal(p.body.total_incentivo_bruto, '1092.11');
  assert.equal(p.body.total_incentivo_liquido, '1072.11');
  const c = await enviar(t.admin, '/api/partner-comissoes/admin/importacao/confirmar');
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.importacao.linhas_novas, 12);
  const de_novo = await enviar(t.admin, '/api/partner-comissoes/admin/importacao/previa');
  assert.equal(de_novo.body.novas, 0);
});

// ─── Portal do Partner (Prompt 3): Certificado na indicação, Início e vendas ─

test('Partner indica Movv Certificado; BPO e conta continuam recusados; aparece em Admin > Indicações', async () => {
  const novo = async (name, type) => (await db.query(`INSERT INTO products (name, type) VALUES ($1, $2) RETURNING id`, [name, type])).rows[0].id;
  const cert = await novo('Movv Certificado', 'digital_certificate');
  const bpo = await novo('BPO Financeiro', 'bpo');
  const conta = await novo('Conta PJ', 'account');

  const lista = await chamar('GET', '/api/products', t.a);
  const tipos = new Set(lista.body.map(p => p.type));
  assert.ok(tipos.has('digital_certificate'));
  assert.ok(!tipos.has('bpo') && !tipos.has('account'));

  const base = { client_name: 'Cliente Cert Indicado', client_whatsapp: '64999990001' };
  const r = await chamar('POST', '/api/referrals', t.a, { ...base, product_id: cert });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal((await chamar('POST', '/api/referrals', t.a, { ...base, product_id: bpo })).status, 400);
  assert.equal((await chamar('POST', '/api/referrals', t.a, { ...base, product_id: conta })).status, 400);

  const doAdmin = await chamar('GET', '/api/referrals', t.admin);
  const vista = doAdmin.body.find(x => x.id === r.body.id);
  assert.ok(vista);
  assert.equal(vista.product_name, 'Movv Certificado');
  assert.equal(vista.partner_code, 'PARTNER-911');

  // nenhuma comissão nasce da indicação
  assert.equal((await db.query('SELECT count(*)::int AS n FROM partner_comissoes WHERE referral_id = $1', [r.body.id])).rows[0].n, 0);

  // sugestão para o Fernando na Nova Venda
  const s = await chamar('GET', `/api/partner-comissoes/admin/sugestao-certificado?nome=${encodeURIComponent('cliente cert indicado')}`, t.fernando);
  assert.equal(s.status, 200);
  assert.equal(s.body[0].partner_id, ids.a);
  assert.equal((await chamar('GET', '/api/partner-comissoes/admin/sugestao-certificado?nome=abcde', t.a)).status, 403);
});

test('Início e Minhas vendas: só do Partner logado; prévia do admin sem dado de ninguém', async () => {
  const ini = await chamar('GET', '/api/partner-comissoes/inicio', t.a);
  assert.equal(ini.status, 200, JSON.stringify(ini.body));
  assert.ok(Array.isArray(ini.body.comissao) && ini.body.comissao.length >= 1);
  assert.ok('a_receber' in ini.body.resumo && 'pago_mes' in ini.body.resumo);
  assert.ok(ini.body.ultimas.length <= 3);

  const va = await chamar('GET', '/api/partner-comissoes/vendas', t.a);
  const vb = await chamar('GET', '/api/partner-comissoes/vendas', t.b);
  const chavesA = new Set(va.body.vendas.map(x => x.chave));
  assert.ok(vb.body.vendas.every(x => !chavesA.has(x.chave)));
  assert.ok(va.body.vendas.some(x => x.cliente_nome === 'Cliente Cert Indicado' && x.situacao === 'Indicado'));

  assert.equal((await chamar('GET', '/api/partner-comissoes/vendas', t.admin)).status, 403);
  const p = await chamar('GET', '/api/partner-comissoes/previa', t.admin);
  assert.equal(p.status, 200);
  assert.equal(p.body.previa, true);
  assert.deepEqual(p.body.vendas, []);
  assert.equal((await chamar('GET', '/api/partner-comissoes/previa', t.a)).status, 403);
});

test('contabilidade não vê nem indica Certificado; o Partner vê o "Movv Certificado" da migration 094', async () => {
  const daContab = await chamar('GET', '/api/products', t.contab);
  assert.ok(daContab.body.every(p => p.type !== 'digital_certificate'));
  const doPartner = await chamar('GET', '/api/products', t.a);
  assert.ok(doPartner.body.some(p => p.name === 'Movv Certificado' && p.type === 'digital_certificate'));
  const cert = (await db.query(`SELECT id FROM products WHERE type = 'digital_certificate' ORDER BY id LIMIT 1`)).rows[0].id;
  const r = await chamar('POST', '/api/referrals', t.contab, { client_name: 'X', client_whatsapp: '64999990002', product_id: cert });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Direta Certificação/);
});
