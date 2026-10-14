// Portal do Partner (Início e Minhas vendas): tradução dos status, resumo
// "a receber / pago no mês", texto da comissão vigente e a lista única de
// vendas. Banco em memória (PGlite); nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { novoBanco } = require('./helpers/bancoTeste');
const portal = require('../src/services/partnerPortal');
const pc = require('../src/services/partnerComissoes');

test('situação em palavras simples, sem jargão', () => {
  const s = v => portal.situacaoDaVenda(v);
  assert.deepEqual(s({ tipo: 'indicacao', status: 'pending', numero_contrato: null }), { situacao: 'Indicado', grupo: 'outras' });
  assert.deepEqual(s({ tipo: 'indicacao', status: 'expired', numero_contrato: null }), { situacao: 'Indicado', grupo: 'outras' });
  assert.deepEqual(s({ tipo: 'indicacao', status: 'pending', numero_contrato: '123456' }), { situacao: 'Em análise', grupo: 'outras' });
  assert.deepEqual(s({ tipo: 'indicacao', status: 'cancelled', numero_contrato: null }), { situacao: 'Cancelada', grupo: 'outras' });
  assert.deepEqual(s({ tipo: 'lancamento', status: 'previsto' }), { situacao: 'Comissão prevista', grupo: 'a_receber' });
  assert.deepEqual(s({ tipo: 'lancamento', status: 'confirmado' }), { situacao: 'Comissão confirmada', grupo: 'a_receber' });
  assert.deepEqual(s({ tipo: 'lancamento', status: 'aprovado' }), { situacao: 'Aprovada, a pagar', grupo: 'a_receber' });
  assert.deepEqual(s({ tipo: 'lancamento', status: 'pago', pago_em: '2026-10-07' }), { situacao: 'Paga em 07/10', grupo: 'paga' });
  assert.deepEqual(s({ tipo: 'lancamento', status: 'estornado' }), { situacao: 'Cancelada', grupo: 'outras' });
});

test('resumo: a receber = previsto + confirmado + aprovado; pago só do mês', () => {
  const r = portal.resumoDosLancamentos([
    { status: 'previsto', valor_partner: '10.01' },
    { status: 'confirmado', valor_partner: '20.02' },
    { status: 'aprovado', valor_partner: '30.03' },
    { status: 'estornado', valor_partner: '99.99' },
    { status: 'pago', valor_partner: '40.04', pago_em: '2026-10-01' },
    { status: 'pago', valor_partner: '50.05', pago_em: '2026-10-31' },
    { status: 'pago', valor_partner: '77.77', pago_em: '2026-09-30' },
  ], '2026-10');
  assert.deepEqual(r, { a_receber: '60.06', pago_mes: '90.09', mes: '2026-10' });
});

test('comissão vigente vem da regra: um percentual ou a faixa', () => {
  assert.deepEqual(portal.comissaoVigente([
    { origem: 'azul', percentual: '30.0000' }, { origem: 'certificado', percentual: '20.0000' },
  ]), [{ origem: 'azul', rotulo: 'Azul', texto: '30%' }, { origem: 'certificado', rotulo: 'Certificado', texto: '20%' }]);
  assert.deepEqual(portal.comissaoVigente([
    { origem: 'azul', percentual: '30.0000' }, { origem: 'azul', percentual: '32.5000' },
  ]), [{ origem: 'azul', rotulo: 'Azul', texto: '30% a 32,5%' }]);
  assert.deepEqual(portal.comissaoVigente([]), []);
});

// ─── Lista única de vendas ──────────────────────────────────────────────────

let db;
let partner;
let outro;
before(async () => {
  db = await novoBanco();
  const mk = async (code, nivel) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner) VALUES ($1, $1, $2, 'x', 'movv_partner', $3) RETURNING id`,
    [code, `${code.toLowerCase()}@t.local`, nivel])).rows[0].id;
  partner = await mk('PARTNER-701', 'point');
  outro = await mk('PARTNER-702', 'hub');
});
after(async () => { await db.fechar(); });

test('vendas: indicação some quando já há comissão do mesmo contrato; Certificado fica "Indicado"', async () => {
  const credito = (await db.query(`INSERT INTO products (name, type) VALUES ('Consignado', 'credit') RETURNING id`)).rows[0].id;
  const cert = (await db.query(`INSERT INTO products (name, type) VALUES ('Movv Certificado', 'digital_certificate') RETURNING id`)).rows[0].id;
  const ind = (p, prod, nome, contrato = null, cpf = null) => db.query(
    `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at, numero_contrato, client_cpf)
     VALUES ($1, $2, $3, '64999990000', $4, NOW() + INTERVAL '30 days', $5, $6)`,
    [`P-${Math.random().toString(36).slice(2, 9)}`, p, nome, prod, contrato, cpf]);
  await ind(partner, credito, 'Com comissão', '700000001');
  await ind(partner, credito, 'Em análise', '700000002');
  await ind(partner, credito, 'Só indicado', null, '52998224725');
  await ind(partner, cert, 'Cliente do certificado');
  await ind(outro, credito, 'De outro Partner', '700000009');
  await pc.criarLancamento(db, {
    partner_id: partner, origem: 'azul', produto: 'INSS', numero_contrato: '700000001', cliente_nome: 'Com comissão',
    competencia: '2026-10', base_valor: '100.00', percentual: '30', status: 'confirmado', criado_por: 't',
  });
  await pc.criarLancamento(db, {
    partner_id: outro, origem: 'azul', produto: 'INSS', numero_contrato: '700000009', cliente_nome: 'De outro Partner',
    competencia: '2026-10', base_valor: '100.00', percentual: '30', status: 'confirmado', criado_por: 't',
  });

  const v = await portal.vendasDoPartner(db, partner);
  const porNome = Object.fromEntries(v.map(x => [x.cliente_nome, x]));
  assert.equal(v.length, 4, 'a indicação "Com comissão" virou a linha da comissão');
  assert.equal(porNome['Com comissão'].tipo, 'lancamento');
  assert.equal(porNome['Com comissão'].situacao, 'Comissão confirmada');
  assert.equal(porNome['Com comissão'].valor, '30.00');
  assert.equal(porNome['Com comissão'].detalhes.percentual, '30.0000');
  assert.equal(porNome['Em análise'].situacao, 'Em análise');
  assert.equal(porNome['Só indicado'].situacao, 'Indicado');
  assert.equal(porNome['Só indicado'].detalhes.cpf, '529.***.***-25');
  assert.equal(porNome['Cliente do certificado'].situacao, 'Indicado');
  assert.equal(porNome['Cliente do certificado'].produto, 'Movv Certificado');
  assert.ok(!porNome['De outro Partner'], 'nunca a venda de outro Partner');
  for (const x of v) {
    for (const interno of ['regra_id', 'aprovado_por', 'pago_por', 'observacao', 'partner_id']) {
      assert.ok(!(interno in x) && !(interno in x.detalhes));
    }
  }

  const ini = await portal.inicioDoPartner(db, partner, '2026-10');
  assert.equal(ini.resumo.a_receber, '30.00');
  assert.equal(ini.ultimas.length, 3);
  assert.deepEqual(ini.comissao.map(c => c.texto), ['30%', '20%']);
});

test('sugestão de Partner na venda do Certificado: por CPF ou nome, só indicação de Certificado em aberto', async () => {
  const cert = (await db.query(`SELECT id FROM products WHERE type = 'digital_certificate' LIMIT 1`)).rows[0].id;
  await db.query(
    `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at, client_cpf)
     VALUES ('P-CERT-CPF', $1, 'Maria Certificado', '64999990000', $2, NOW() + INTERVAL '30 days', '11144477735')`, [partner, cert]);
  let s = await portal.sugestoesCertificado(db, { cpf: '111.444.777-35' });
  assert.equal(s.length, 1);
  assert.equal(s[0].partner_id, partner);
  assert.equal(s[0].client_cpf, '111.***.***-35');
  s = await portal.sugestoesCertificado(db, { nome: '  cliente do CERTIFICADO ' });
  assert.equal(s.length, 1);
  assert.equal(s[0].client_name, 'Cliente do certificado');
  assert.deepEqual(await portal.sugestoesCertificado(db, { nome: 'Só indicado' }), [], 'indicação de crédito não sugere');
  assert.deepEqual(await portal.sugestoesCertificado(db, { nome: 'abc' }), [], 'nome curto não busca');
});
