// Livro de comissões do MOVV Partner (Etapa 1). Roda num Postgres em memória
// (PGlite) com todas as migrations; nunca toca o DATABASE_URL.
//   npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { novoBanco } = require('./helpers/bancoTeste');
const dinheiro = require('../src/services/dinheiro');
const pc = require('../src/services/partnerComissoes');

let db;
let partnerA;
let partnerB;
let partnerSemNivel;
let colaborador;

async function criarPartner(codigo, nivel) {
  const r = await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner)
     VALUES ($1, $2, $3, 'x', 'movv_partner', $4) RETURNING *`,
    [codigo, `Partner ${codigo}`, `${codigo.toLowerCase()}@teste.local`, nivel]
  );
  return r.rows[0];
}

// Venda do Movv Certificado. data padrão ANTES da regra inicial do
// Certificado (13/10/2026), para os testes de "sem regra".
async function criarVenda({
  partnerId, total = '150.00', lucro = '80.10', data = '2026-10-05',
  preco = total, custo = '19.90', token = false, tokenVenda = null, tokenCompra = null,
}) {
  const r = await db.query(
    `INSERT INTO direta_sales
       (collaborator_id, data_venda, tipo_venda, cliente_nome, preco_venda, custo, lucro, comissao_pct, comissao_valor,
        reference_month, total_venda, total_comissao_vendedor, total_lucro_movv, incluiu_token, partner_id,
        valor_venda_token, valor_compra_token)
     VALUES ($1, $2, 'direta', 'Cliente Teste', $3, $4, $5, 20, 30, $6, $7, 30, $5, $8, $9, $10, $11) RETURNING *`,
    [colaborador.id, data, preco, custo, lucro, data.slice(0, 7), total, token, partnerId, tokenVenda, tokenCompra]
  );
  return r.rows[0];
}

before(async () => {
  db = await novoBanco();
  partnerA = await criarPartner('PARTNER-901', 'mobile');
  partnerB = await criarPartner('PARTNER-902', 'hub');
  partnerSemNivel = await criarPartner('PARTNER-903', null);
  colaborador = (await db.query(
    `INSERT INTO internal_collaborators (name, email, password_hash, role)
     VALUES ('Vendedor Teste', 'vendedor@teste.local', 'x', 'comercial_full') RETURNING *`
  )).rows[0];
});

after(async () => { await db.fechar(); });

// ─── Cálculo ────────────────────────────────────────────────────────────────

test('valor do Partner: ROUND_HALF_UP por linha, sem float', () => {
  assert.equal(dinheiro.calcularValorPartner('133.44', '30'), '40.03');   // 40,032
  assert.equal(dinheiro.calcularValorPartner('133.45', '30'), '40.04');   // 40,035 -> sobe
  assert.equal(dinheiro.calcularValorPartner('0.05', '30'), '0.02');      // 0,015 -> sobe
  assert.equal(dinheiro.calcularValorPartner('100.00', '0'), '0.00');
  assert.equal(dinheiro.calcularValorPartner('1092.11', '30'), '327.63');
  assert.equal(dinheiro.calcularValorPartner('10.00', '12.3456'), '1.23');
  // 0,1 + 0,2 em float dá 0,30000000000000004; em centavos não
  const soma = dinheiro.paraCentavos('0.10') + dinheiro.paraCentavos('0.20');
  assert.equal(dinheiro.formatarCentavos(soma), '0.30');
  assert.throws(() => dinheiro.paraCentavos('12,50'), /inválido/);
});

test('migration 093: regra da Azul de 30% para os quatro níveis', async () => {
  const r = await db.query(`SELECT nivel_partner, percentual, base, produto FROM partner_comissao_regras WHERE origem = 'azul' ORDER BY nivel_partner`);
  assert.deepEqual(r.rows.map(x => x.nivel_partner), ['hub', 'mobile', 'point', 'regional']);
  for (const x of r.rows) {
    assert.equal(x.percentual, '30.0000');
    assert.equal(x.base, 'comissao_recebida');
    assert.equal(x.produto, null);
  }
  const cert = await db.query(`SELECT nivel_partner, percentual, base, produto, vigente_desde FROM partner_comissao_regras WHERE origem = 'certificado' ORDER BY nivel_partner`);
  assert.deepEqual(cert.rows.map(x => x.nivel_partner), ['hub', 'mobile', 'point', 'regional']);
  for (const x of cert.rows) {
    assert.equal(x.percentual, '20.0000');
    assert.equal(x.base, 'lucro_grupo');
    assert.equal(x.produto, null);
    assert.equal(x.vigente_desde, '2026-10-13');
  }
});

test('o banco recusa valor_partner que não bate com base × percentual', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO partner_comissoes (partner_id, origem, produto, competencia, base_valor, percentual, valor_partner, criado_por)
       VALUES ($1, 'azul', 'X', '2026-10', 100.00, 30, 30.01, 'teste')`,
      [partnerA.id]
    ),
    /pc_valor_partner_confere/
  );
});

// ─── Percentual copiado ─────────────────────────────────────────────────────

test('percentual é copiado para o lançamento; mudar a regra depois não altera', async () => {
  const lanc = await pc.criarManual(db, {
    partner_id: partnerA.id, origem: 'azul', produto: 'Consignado INSS', competencia: '2026-10',
    base_valor: '133.44', observacao: 'teste de cópia', numero_contrato: '0012345678',
  }, 'Admin Teste');
  assert.equal(lanc.percentual, '30.0000');
  assert.equal(lanc.valor_partner, '40.03');
  assert.equal(lanc.status, 'confirmado');
  assert.equal(lanc.numero_contrato, '0012345678', 'contrato fica texto, com zero à esquerda');

  await db.query(`UPDATE partner_comissao_regras SET percentual = 25 WHERE origem = 'azul' AND nivel_partner = 'mobile'`);
  const depois = (await db.query('SELECT percentual, valor_partner FROM partner_comissoes WHERE id = $1', [lanc.id])).rows[0];
  assert.equal(depois.percentual, '30.0000');
  assert.equal(depois.valor_partner, '40.03');

  const novo = await pc.criarManual(db, {
    partner_id: partnerA.id, origem: 'azul', produto: 'Consignado INSS', competencia: '2026-10',
    base_valor: '133.44', observacao: 'depois da mudança',
  }, 'Admin Teste');
  assert.equal(novo.percentual, '25.0000', 'lançamento novo usa a regra nova');
  assert.equal(novo.valor_partner, '33.36');
  await db.query(`UPDATE partner_comissao_regras SET percentual = 30 WHERE origem = 'azul' AND nivel_partner = 'mobile'`);
});

test('lançamento manual exige regra vigente e Partner com nível', async () => {
  await assert.rejects(
    pc.criarManual(db, { partner_id: partnerSemNivel.id, origem: 'azul', produto: 'X', competencia: '2026-10', base_valor: '10', observacao: 'x' }, 'Admin'),
    /sem nível/
  );
  await assert.rejects(
    pc.criarManual(db, { partner_id: partnerA.id, origem: 'azul', produto: 'X', competencia: '2025-10', base_valor: '10', observacao: 'x' }, 'Admin'),
    /Sem regra vigente/
  );
  await assert.rejects(
    pc.criarManual(db, { partner_id: partnerA.id, origem: 'federal_invest', produto: 'X', competencia: '2026-10', base_valor: '10', observacao: 'x' }, 'Admin'),
    /não disponível/
  );
});

test('regra com vigência sobreposta é recusada', async () => {
  await assert.rejects(
    pc.salvarRegra(db, { origem: 'azul', nivel_partner: 'hub', base: 'comissao_recebida', percentual: '35', vigente_desde: '2026-06-01' }, 'Admin'),
    /Já existe regra/
  );
  await assert.rejects(
    pc.salvarRegra(db, { origem: 'certificado', nivel_partner: 'hub', base: 'comissao_recebida', percentual: '10', vigente_desde: '2026-01-01' }, 'Admin'),
    /Base não vale/
  );
});

// ─── Status ─────────────────────────────────────────────────────────────────

test('status só anda uma casa; pular etapa é recusado', async () => {
  const { lancamento: l } = await pc.criarLancamento(db, {
    partner_id: partnerB.id, origem: 'azul', produto: 'Cartão Benefício', competencia: '2026-09',
    base_valor: '200.00', percentual: '30', status: 'previsto', criado_por: 'teste',
  });
  assert.equal(l.valor_partner, '60.00');

  let r = await pc.mudarStatus(db, [l.id], 'aprovar', 'Admin');
  assert.equal(r.alterados.length, 0);
  assert.match(r.recusados[0].motivo, /previsto/);

  r = await pc.mudarStatus(db, [l.id], 'pagar', 'Admin', { data_pagamento: '2026-10-10' });
  assert.equal(r.alterados.length, 0, 'pago só depois de aprovado');

  r = await pc.mudarStatus(db, [l.id], 'confirmar', 'Admin');
  assert.equal(r.alterados[0].status, 'confirmado');

  await assert.rejects(pc.mudarStatus(db, [l.id], 'pagar', 'Admin', {}), /data do pagamento/);
  r = await pc.mudarStatus(db, [l.id], 'pagar', 'Admin', { data_pagamento: '2026-10-10' });
  assert.equal(r.alterados.length, 0, 'confirmado ainda não pode ser pago');

  r = await pc.mudarStatus(db, [l.id], 'aprovar', 'Admin Aprovador');
  assert.equal(r.alterados[0].status, 'aprovado');
  assert.equal(r.alterados[0].aprovado_por, 'Admin Aprovador');

  r = await pc.mudarStatus(db, [l.id], 'pagar', 'Admin Pagador', { data_pagamento: '2026-10-10', observacao: 'PIX' });
  assert.equal(r.alterados[0].status, 'pago');
  assert.equal(r.alterados[0].pago_em, '2026-10-10');
  assert.equal(r.alterados[0].pago_por, 'Admin Pagador');

  await assert.rejects(pc.mudarStatus(db, [l.id], 'estornar', 'Admin', {}), /motivo/);
  r = await pc.mudarStatus(db, [l.id], 'estornar', 'Admin', { motivo: 'Azul estornou o contrato' });
  assert.equal(r.alterados[0].status, 'estornado');
  assert.equal(r.alterados[0].status_antes_estorno, 'pago');

  r = await pc.mudarStatus(db, [l.id], 'estornar', 'Admin', { motivo: 'de novo' });
  assert.equal(r.alterados.length, 0, 'estornado não estorna de novo');
});

test('aprovar em lote aprova os confirmados e devolve os recusados', async () => {
  const mk = st => pc.criarLancamento(db, {
    partner_id: partnerB.id, origem: 'azul', produto: 'Lote', competencia: '2026-08',
    base_valor: '10.00', percentual: '30', status: st, criado_por: 'teste',
  }).then(x => x.lancamento.id);
  const ids = [await mk('confirmado'), await mk('confirmado'), await mk('previsto')];
  const r = await pc.mudarStatus(db, [...ids, 999999], 'aprovar', 'Admin');
  assert.equal(r.alterados.length, 2);
  assert.equal(r.recusados.length, 2);
  assert.ok(r.recusados.some(x => /não encontrado/.test(x.motivo)));
});

// ─── O Partner só vê o que é dele ───────────────────────────────────────────

test('Partner nunca enxerga lançamento de outro Partner nem colunas internas', async () => {
  const a = await pc.listarDoPartner(db, partnerA.id);
  const b = await pc.listarDoPartner(db, partnerB.id);
  assert.ok(a.lancamentos.length >= 2);
  assert.ok(b.lancamentos.length >= 1);
  const idsA = new Set(a.lancamentos.map(x => x.id));
  for (const x of b.lancamentos) assert.ok(!idsA.has(x.id));
  const doA = (await db.query('SELECT id FROM partner_comissoes WHERE partner_id = $1', [partnerA.id])).rows.map(x => x.id).sort();
  assert.deepEqual(a.lancamentos.map(x => x.id).sort(), doA);

  for (const col of ['partner_id', 'regra_id', 'aprovado_por', 'pago_por', 'observacao', 'chave_idempotencia', 'importacao_linha_id', 'motivo_estorno']) {
    assert.ok(!(col in a.lancamentos[0]), `coluna interna ${col} não pode aparecer`);
  }
  for (const col of ['base_valor', 'percentual', 'valor_partner', 'status', 'eh_estorno', 'produto', 'competencia']) {
    assert.ok(col in a.lancamentos[0], `coluna ${col} faz parte da decisão A`);
  }

  // sem o id do Partner na transação, a view não devolve nada
  const solta = await db.query('SELECT count(*)::int AS n FROM v_partner_comissoes_partner');
  assert.equal(solta.rows[0].n, 0);

  // totais: a receber = previsto + confirmado; estornado fica de fora
  const somaAReceber = a.lancamentos.filter(x => ['previsto', 'confirmado'].includes(x.status))
    .reduce((s, x) => s + dinheiro.paraCentavos(x.valor_partner), 0n);
  assert.equal(dinheiro.paraCentavos(a.totais.a_receber), somaAReceber);
});

test('tabela vigente mostra só o nível do Partner', async () => {
  const t = await pc.tabelaDoPartner(db, partnerB.id);
  assert.equal(t.nivel, 'hub');
  assert.ok(t.regras.length >= 1);
  assert.ok(t.regras.every(x => !('nivel_partner' in x)));
  const semNivel = await pc.tabelaDoPartner(db, partnerSemNivel.id);
  assert.deepEqual(semNivel.regras, []);
});

// ─── Movv Certificado automático ────────────────────────────────────────────

test('Certificado sem regra não gera lançamento e avisa o admin; com regra gera previsto', async () => {
  const venda = await criarVenda({ partnerId: partnerA.id, total: '150.00', lucro: '80.10' });
  const r1 = await pc.lancarCertificado(db, venda, 'Vendedor Teste');
  assert.ok(r1.aviso, 'sem regra: aviso');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM partner_comissoes WHERE direta_sale_id = $1', [venda.id])).rows[0].n, 0);
  const avisos = await pc.listarAvisos(db);
  const aviso = avisos.find(x => x.direta_sale_id === venda.id);
  assert.ok(aviso);

  // aviso repetido não duplica
  await pc.lancarCertificado(db, venda, 'Vendedor Teste');
  assert.equal((await pc.listarAvisos(db)).filter(x => x.direta_sale_id === venda.id).length, 1);

  // regra antiga (antes da inicial de 13/10): termina na véspera, sem sobrepor
  await pc.salvarRegra(db, { origem: 'certificado', nivel_partner: 'mobile', base: 'valor_venda', percentual: '10', vigente_desde: '2026-01-01', vigente_ate: '2026-10-12' }, 'Admin');
  const r2 = await pc.tentarAvisoDeNovo(db, aviso.id, 'Admin');
  assert.equal(r2.lancamento.status, 'previsto');
  assert.equal(r2.lancamento.base_valor, '150.00');
  assert.equal(r2.lancamento.valor_partner, '15.00');
  assert.equal(r2.lancamento.competencia, '2026-10');
  assert.equal(r2.lancamento.produto, 'Certificado digital');
  assert.equal((await pc.listarAvisos(db)).filter(x => x.direta_sale_id === venda.id).length, 0, 'aviso resolvido');

  // idempotente: chamar de novo não cria outro
  const r3 = await pc.lancarCertificado(db, venda, 'Vendedor Teste');
  assert.equal(r3.lancamento.id, r2.lancamento.id);

  // venda editada com lançamento previsto: base acompanha, percentual não muda
  const editada = (await db.query(`UPDATE direta_sales SET total_venda = 200.00 WHERE id = $1 RETURNING *`, [venda.id])).rows[0];
  const r4 = await pc.aoEditarVendaCertificado(db, editada, 'Admin');
  assert.equal(r4.lancamento.base_valor, '200.00');
  assert.equal(r4.lancamento.valor_partner, '20.00');
  assert.equal(r4.lancamento.percentual, '10.0000');

  // venda cancelada: estorna
  const r5 = await pc.aoCancelarVendaCertificado(db, venda.id, 'Venda cancelada', 'Admin');
  assert.equal(r5.alterados[0].status, 'estornado');
});

test('Certificado: venda sem Partner não gera nada; Partner sem nível vira aviso', async () => {
  const semPartner = await criarVenda({ partnerId: null });
  assert.equal(await pc.lancarCertificado(db, semPartner, 'x'), null);
  const vendaSemNivel = await criarVenda({ partnerId: partnerSemNivel.id });
  const r = await pc.lancarCertificado(db, vendaSemNivel, 'x');
  assert.match(r.aviso, /sem nível/);
});

test('Certificado: venda editada com lançamento aprovado vira aviso, sem mexer no valor', async () => {
  const venda = await criarVenda({ partnerId: partnerA.id, total: '100.00' });
  const { lancamento } = await pc.lancarCertificado(db, venda, 'x');
  await pc.mudarStatus(db, [lancamento.id], 'confirmar', 'Admin');
  await pc.mudarStatus(db, [lancamento.id], 'aprovar', 'Admin');
  const editada = (await db.query(`UPDATE direta_sales SET total_venda = 120.00 WHERE id = $1 RETURNING *`, [venda.id])).rows[0];
  const r = await pc.aoEditarVendaCertificado(db, editada, 'Admin');
  assert.match(r.aviso, /já aprovado/);
  const depois = (await db.query('SELECT base_valor, valor_partner FROM partner_comissoes WHERE id = $1', [lancamento.id])).rows[0];
  assert.equal(depois.base_valor, '100.00');
  assert.equal(depois.valor_partner, '10.00');
});

// ─── Certificado: 20% do lucro do Grupo (preço − custos) ────────────────────

test('Certificado com token: base = preço − custos e valor = 20% arredondado por linha', async () => {
  // certificado 87,37 − 19,90 = 67,47; token 60,00 − 35,50 = 24,50; base 91,97
  // 20% = 18,394 -> 18,39. total_lucro_movv (que desconta comissões) é outro número.
  const venda = await criarVenda({
    partnerId: partnerB.id, data: '2026-10-20', preco: '87.37', total: '147.37', lucro: '50.00',
    token: true, tokenVenda: '60.00', tokenCompra: '35.50',
  });
  const r = await pc.lancarCertificado(db, venda, 'Vendedor Teste');
  assert.equal(r.lancamento.base_valor, '91.97');
  assert.equal(r.lancamento.percentual, '20.0000');
  assert.equal(r.lancamento.valor_partner, '18.39');
  assert.equal(r.lancamento.produto, 'Certificado digital + Token');
  assert.notEqual(r.lancamento.base_valor, venda.total_lucro_movv);

  // 91,99 -> 18,398 -> 18,40 (sobe)
  const v2 = await criarVenda({ partnerId: partnerB.id, data: '2026-10-21', preco: '111.89', total: '111.89' });
  assert.equal((await pc.lancarCertificado(db, v2, 'x')).lancamento.valor_partner, '18.40');
  // sem token: só o certificado (49,90 − 19,90 = 30,00 -> 6,00)
  const v3 = await criarVenda({ partnerId: partnerB.id, data: '2026-10-21', preco: '49.90', total: '49.90' });
  const r3 = await pc.lancarCertificado(db, v3, 'x');
  assert.equal(r3.lancamento.base_valor, '30.00');
  assert.equal(r3.lancamento.valor_partner, '6.00');
});

test('Certificado: lucro zero ou negativo não gera lançamento e vira aviso', async () => {
  const zero = await criarVenda({ partnerId: partnerB.id, data: '2026-10-22', preco: '19.90', total: '19.90' });
  const r = await pc.lancarCertificado(db, zero, 'x');
  assert.match(r.aviso, /zero ou negativa/);
  // token vendido abaixo do custo deixa a soma negativa
  const neg = await criarVenda({
    partnerId: partnerB.id, data: '2026-10-22', preco: '20.00', total: '30.00',
    token: true, tokenVenda: '10.00', tokenCompra: '15.00',
  });
  assert.match((await pc.lancarCertificado(db, neg, 'x')).aviso, /zero ou negativa/);
  for (const v of [zero, neg]) {
    assert.equal((await db.query('SELECT count(*)::int AS n FROM partner_comissoes WHERE direta_sale_id = $1', [v.id])).rows[0].n, 0);
  }
});

// ─── Seguros: 20% da comissão recebida (migration 095) ──────────────────────

test('data de referência do lançamento manual: informada, ou último dia da competência sem passar de hoje', () => {
  const f = pc.dataDeReferenciaManual;
  assert.equal(f('2026-10', null, '2026-10-14'), '2026-10-14');
  assert.equal(f('2026-09', null, '2026-10-14'), '2026-09-30');
  assert.equal(f('2026-02', null, '2026-10-14'), '2026-02-28');
  assert.equal(f('2026-12', null, '2026-10-14'), '2026-12-31');
  assert.equal(f('2026-10', '2026-10-20', '2026-10-14'), '2026-10-20');
  assert.throws(() => f('2026-10', '2026-11-02'), /dia da competência/);
});

test('lançamento manual de seguro: 20% da regra, arredondado por linha, percentual gravado', async () => {
  const l1 = await pc.criarManual(db, {
    partner_id: partnerB.id, origem: 'seguro', produto: 'Seguro auto', competencia: '2026-10', data_referencia: '2026-10-20',
    base_valor: '123.47', cliente_nome: 'Cliente Seguro', observacao: 'comissão de seguro recebida da seguradora',
  }, 'Admin Teste');
  assert.equal(l1.origem, 'seguro');
  assert.equal(l1.base_valor, '123.47');
  assert.equal(l1.percentual, '20.0000');
  assert.equal(l1.valor_partner, '24.69');                 // 24,694
  const regra = (await db.query('SELECT origem, base FROM partner_comissao_regras WHERE id = $1', [l1.regra_id])).rows[0];
  assert.deepEqual(regra, { origem: 'seguro', base: 'comissao_recebida' });

  const l2 = await pc.criarManual(db, {
    partner_id: partnerB.id, origem: 'seguro', produto: 'Seguro residencial', competencia: '2026-10', data_referencia: '2026-10-21',
    base_valor: '123.48', observacao: 'seguro residencial',
  }, 'Admin Teste');
  assert.equal(l2.valor_partner, '24.70');                 // 24,696 -> sobe

  // mudar a regra depois não mexe no que já foi lançado
  await db.query(`UPDATE partner_comissao_regras SET percentual = 25 WHERE origem = 'seguro' AND nivel_partner = 'hub'`);
  const depois = (await db.query('SELECT percentual, valor_partner FROM partner_comissoes WHERE id = ANY($1::int[]) ORDER BY id', [[l1.id, l2.id]])).rows;
  assert.deepEqual(depois, [{ percentual: '20.0000', valor_partner: '24.69' }, { percentual: '20.0000', valor_partner: '24.70' }]);
  await db.query(`UPDATE partner_comissao_regras SET percentual = 20 WHERE origem = 'seguro' AND nivel_partner = 'hub'`);

  // antes de 14/10/2026 não há regra de seguro
  await assert.rejects(pc.criarManual(db, {
    partner_id: partnerB.id, origem: 'seguro', produto: 'Seguro vida', competencia: '2026-10', data_referencia: '2026-10-10',
    base_valor: '50.00', observacao: 'x',
  }, 'Admin'), /Sem regra vigente/);
  // seguro só aceita base "comissão recebida"
  await assert.rejects(pc.salvarRegra(db, { origem: 'seguro', nivel_partner: 'hub', base: 'valor_venda', percentual: '20', vigente_desde: '2027-01-01' }, 'Admin'), /Base não vale/);
});

test('tabela vigente do Partner traz Seguros 20% (da regra)', async () => {
  const t = await pc.tabelaDoPartner(db, partnerB.id);
  const seguro = t.regras.find(r => r.origem === 'seguro');
  assert.equal(seguro.percentual, '20.0000');
  assert.equal(seguro.base, 'comissao_recebida');
});
