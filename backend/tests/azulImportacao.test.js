// Importação mensal da Azul (Etapa 2) com os arquivos FICTÍCIOS de
// tests/fixtures/azul. Banco em memória (PGlite); nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { novoBanco } = require('./helpers/bancoTeste');
const { lerRelatorioAzul, normalizarNumero } = require('../src/services/azulRelatorio');
const imp = require('../src/services/azulImportacao');

const FIX = path.join(__dirname, 'fixtures/azul');
const CSV = fs.readFileSync(path.join(FIX, 'exemplo_comissoes_pagas_domus_ficticio.csv'));
const XLS = fs.readFileSync(path.join(FIX, 'exemplo_incentivos_azul_ficticio.xls'));
const CABECALHO = new TextDecoder('windows-1252').decode(CSV).split(/\r?\n/)[0];

// CSV Domus sintético (fictício), no mesmo layout do exemplo
function linhaCsv({ nome = 'CLIENTE SINTETICO', cpf = '', contrato = '', produto = 'INSS', pagamento, valor, situacao = 'PAGA', obs = '' }) {
  return [nome, cpf, pagamento, pagamento, '96', '1', 'BANCO X', contrato, contrato, '0.000', 'OP', produto, '1000.00', 'NOVO',
    pagamento, 'DIG', valor, '1.00', '0.00', '0', '', 'AZUL EMPRESTIMO', situacao, obs, '124392', '1', 'Comissão', ''].join(';');
}
const csvSintetico = linhas => Buffer.from([CABECALHO, ...linhas.map(linhaCsv)].join('\r\n'), 'latin1');
const linhasDoExemplo = () => new TextDecoder('windows-1252').decode(CSV).split(/\r?\n/).filter(Boolean);

let db;
const P = {};
const R = {};
const quem = 'Admin Teste';

async function partner(code, nivel) {
  return (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner)
     VALUES ($1, $2, $3, 'x', 'movv_partner', $4) RETURNING id`,
    [code, `Partner ${code}`, `${code.toLowerCase()}@teste.local`, nivel]
  )).rows[0].id;
}
let produtoId;
async function indicacao(partnerId, { cpf = null, contrato = null, nome = 'Cliente' } = {}) {
  return (await db.query(
    `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at, client_cpf, numero_contrato)
     VALUES ($1, $2, $3, '64999999999', $4, NOW() + INTERVAL '30 days', $5, $6) RETURNING id`,
    [`T-${Math.random().toString(36).slice(2, 10)}`, partnerId, nome, produtoId, cpf, contrato]
  )).rows[0].id;
}
const contar = async (sql, p = []) => (await db.query(sql, p)).rows[0].n;

before(async () => {
  db = await novoBanco();
  produtoId = (await db.query(`INSERT INTO products (name, type) VALUES ('Consignado INSS', 'credit') RETURNING id`)).rows[0].id;
  P.a = await partner('PARTNER-801', 'mobile');
  P.b = await partner('PARTNER-802', 'hub');
  // cliente 01: contrato já na indicação -> casada
  R.casada = await indicacao(P.a, { contrato: '118159083', nome: 'Cliente 01' });
  // cliente 02: só o CPF, sem contrato -> sugestão
  R.sugestao = await indicacao(P.a, { cpf: '13818854463', nome: 'Cliente 02' });
  // cliente 05: o mesmo CPF em duas indicações sem contrato -> ambígua
  R.amb1 = await indicacao(P.a, { cpf: '72317422075', nome: 'Cliente 05 (A)' });
  R.amb2 = await indicacao(P.b, { cpf: '72317422075', nome: 'Cliente 05 (B)' });
});

after(async () => { await db.fechar(); });

// ─── Leitura ────────────────────────────────────────────────────────────────

test('números: ponto e vírgula decimais, milhar brasileiro, sem confundir', () => {
  assert.equal(normalizarNumero('133.44'), '133.44');
  assert.equal(normalizarNumero('20,00'), '20.00');
  assert.equal(normalizarNumero('1.567,99'), '1567.99');
  assert.equal(normalizarNumero('7623.55'), '7623.55');
  assert.equal(normalizarNumero('1.567'), '1567');
  assert.equal(normalizarNumero(' 205,84 '), '205.84');
  assert.throws(() => normalizarNumero('12a'), /inválido/);
});

for (const [nome, buf, formato] of [['CSV Domus', CSV, 'csv_domus'], ['.xls (HTML)', XLS, 'xls_azul']]) {
  test(`${nome}: 11 pagas = 1.092,11; desconto 20,00; líquido 1.072,11 (somando linhas, nunca o rodapé)`, () => {
    const r = lerRelatorioAzul(buf);
    assert.equal(r.formato, formato);
    assert.deepEqual(r.erros, []);
    const pagas = r.linhas.filter(l => l.tipo === 'comissao');
    const descontos = r.linhas.filter(l => l.tipo === 'desconto');
    assert.equal(pagas.length, 11);
    assert.equal(descontos.length, 1);
    const soma = ls => ls.reduce((s, l) => s + BigInt(l.valor_comissao.replace('.', '')), 0n);
    assert.equal(soma(pagas), 109211n);
    assert.equal(soma(descontos), 2000n);
    assert.equal(descontos[0].numero_contrato, null);
    assert.equal(descontos[0].dt_pagamento, '2026-07-21');
    for (const l of pagas) assert.equal(typeof l.numero_contrato, 'string');
  });
}

test('contrato é texto (zero à esquerda fica) e competência é o mês do pagamento', () => {
  const r = lerRelatorioAzul(csvSintetico([{ contrato: '0012345678', pagamento: '05/08/2026', valor: '10.00' }]));
  assert.equal(r.linhas[0].numero_contrato, '0012345678');
  assert.equal(r.linhas[0].competencia, '2026-08');
});

// ─── Prévia e confirmação ───────────────────────────────────────────────────

test('prévia não grava nada e separa as contagens', async () => {
  const p = await imp.previa(db, CSV);
  assert.equal(p.linhas_total, 12);
  assert.equal(p.ja_importadas, 0);
  assert.equal(p.novas, 12);
  assert.deepEqual(p.contagens, { casada: 1, sugestao: 1, ambigua: 1, sem_partner: 8, sem_regra: 0, desconto: 1, estorno_a_decidir: 0 });
  assert.equal(p.linhas_pagas, 11);
  assert.equal(p.total_incentivo_bruto, '1092.11');
  assert.equal(p.total_descontos, '20.00');
  assert.equal(p.total_incentivo_liquido, '1072.11');
  assert.equal(p.total_partners, '40.03');            // 30% de 133,44 (só a casada por contrato)
  assert.deepEqual(p.pabline, { bruto: '1092.11', liquido: '1072.11', dez_pct_bruto: '109.21', dez_pct_liquido: '107.21' });
  // CPF só mascarado na prévia
  for (const l of p.linhas) if (l.cliente_cpf) assert.match(l.cliente_cpf, /^\d{3}\.\*\*\*\.\*\*\*-\d{2}$/);
  assert.equal(await contar('SELECT count(*)::int AS n FROM comissao_importacao_linhas'), 0);
  assert.equal(await contar('SELECT count(*)::int AS n FROM partner_comissoes'), 0);
});

test('se as 11 fossem de Partners, 30% por linha arredondada soma este valor', () => {
  const { valorPartnerCentavos, paraCentavos, paraPct4, formatarCentavos } = require('../src/services/dinheiro');
  const pagas = lerRelatorioAzul(CSV).linhas.filter(l => l.tipo === 'comissao');
  const total = pagas.reduce((s, l) => s + valorPartnerCentavos(paraCentavos(l.valor_comissao), paraPct4('30')), 0n);
  // linha a linha: 40,03 + 11,36 + 6,68 + 3,56 + 37,01 + 18,82 + 23,10 + 17,09 + 57,78 + 50,45 + 61,75
  assert.equal(formatarCentavos(total), '327.63');
});

test('confirmar: casada por contrato vira lançamento confirmado; desconto e "sem Partner" não', async () => {
  const r = await db.transacao(cx => imp.confirmar(cx, CSV, 'exemplo.csv', quem));
  assert.equal(r.importacao.linhas_novas, 12);
  assert.equal(r.importacao.total_partners, '40.03');
  assert.equal(r.importacao.total_incentivo, '1092.11');

  const lanc = (await db.query(`SELECT * FROM partner_comissoes WHERE origem = 'azul'`)).rows;
  assert.equal(lanc.length, 1);
  assert.equal(lanc[0].status, 'confirmado');
  assert.equal(lanc[0].partner_id, P.a);
  assert.equal(lanc[0].referral_id, R.casada);
  assert.equal(lanc[0].base_valor, '133.44');
  assert.equal(lanc[0].percentual, '30.0000');
  assert.equal(lanc[0].valor_partner, '40.03');
  assert.equal(lanc[0].competencia, '2026-04');
  assert.equal(lanc[0].numero_contrato, '118159083');
  assert.ok(lanc[0].importacao_linha_id);

  const desconto = (await db.query(`SELECT * FROM comissao_importacao_linhas WHERE tipo = 'desconto'`)).rows[0];
  assert.equal(desconto.status, 'desconto');
  assert.equal(desconto.valor_comissao, '20.00');
  assert.equal(await contar('SELECT count(*)::int AS n FROM partner_comissoes WHERE importacao_linha_id = $1', [desconto.id]), 0);
  assert.equal(await contar(`SELECT count(*)::int AS n FROM comissao_importacao_linhas WHERE status = 'sem_partner'`), 8);
});

test('pendências: só sugestões, ambíguas, estornos e sem regra — "sem Partner" fica de fora', async () => {
  const p = await imp.pendencias(db);
  assert.equal(p.sugestoes.length, 1);
  assert.equal(p.sugestoes[0].sugestao_referral_id, R.sugestao);
  assert.match(p.sugestoes[0].cliente_cpf, /^138\.\*\*\*\.\*\*\*-63$/);
  assert.equal(p.ambiguas.length, 1);
  assert.deepEqual(p.ambiguas[0].candidatos.map(c => c.id).sort(), [R.amb1, R.amb2].sort());
  assert.equal(p.estornos.length, 0);
  assert.equal(p.sem_regra.length, 0);
  const todas = [...p.sugestoes, ...p.ambiguas, ...p.estornos, ...p.sem_regra];
  assert.ok(todas.every(l => l.status !== 'sem_partner'));
});

test('reimportar o mesmo arquivo: 0 linhas novas, nada duplicado', async () => {
  const p = await imp.previa(db, CSV);
  assert.equal(p.novas, 0);
  assert.equal(p.ja_importadas, 12);
  const antes = await contar('SELECT count(*)::int AS n FROM comissao_importacao_linhas');
  const r = await db.transacao(cx => imp.confirmar(cx, CSV, 'exemplo-de-novo.csv', quem));
  assert.equal(r.importacao.linhas_novas, 0);
  assert.equal(await contar('SELECT count(*)::int AS n FROM comissao_importacao_linhas'), antes);
  assert.equal(await contar(`SELECT count(*)::int AS n FROM partner_comissoes WHERE origem = 'azul'`), 1);
});

test('arquivo que sobrepõe o período só cria as linhas novas', async () => {
  const exemplo = linhasDoExemplo();
  const sobreposto = Buffer.from([
    exemplo[0], exemplo[1], exemplo[2], exemplo[3],      // 3 linhas já importadas
    linhaCsv({ nome: 'CLIENTE SINTETICO 20', contrato: '900000001', pagamento: '10/09/2026', valor: '50.00' }),
    linhaCsv({ nome: 'CLIENTE SINTETICO 21', contrato: '900000002', pagamento: '11/09/2026', valor: '60.00' }),
  ].join('\r\n'), 'latin1');
  const p = await imp.previa(db, sobreposto);
  assert.equal(p.ja_importadas, 3);
  assert.equal(p.novas, 2);
  const r = await db.transacao(cx => imp.confirmar(cx, sobreposto, 'sobreposto.csv', quem));
  assert.equal(r.importacao.linhas_novas, 2);
});

test('duas linhas idênticas no mesmo arquivo não colapsam', async () => {
  const igual = { nome: 'CLIENTE SINTETICO 30', contrato: '900000030', pagamento: '12/09/2026', valor: '15.00' };
  const p = await imp.previa(db, csvSintetico([igual, igual]));
  assert.equal(p.novas, 2);
  const r = await db.transacao(cx => imp.confirmar(cx, csvSintetico([igual, igual]), 'iguais.csv', quem));
  assert.equal(r.importacao.linhas_novas, 2);
  assert.equal((await imp.previa(db, csvSintetico([igual, igual, igual]))).novas, 1, 'a 3ª ocorrência é nova');
});

// ─── Sugestão, ambígua, vínculo manual ──────────────────────────────────────

test('confirmar sugestão grava o contrato na indicação e gera o lançamento; depois casa pelo contrato', async () => {
  const [s] = (await imp.pendencias(db)).sugestoes;
  const r = await db.transacao(cx => imp.confirmarSugestao(cx, s.id, quem));
  assert.equal(r.lancamento.valor_partner, '11.36');           // 30% de 37,88
  assert.equal(r.lancamento.status, 'confirmado');
  const ind = (await db.query('SELECT numero_contrato FROM referrals WHERE id = $1', [R.sugestao])).rows[0];
  assert.equal(ind.numero_contrato, '231860913');
  const linha = (await db.query('SELECT status, referral_id FROM comissao_importacao_linhas WHERE id = $1', [s.id])).rows[0];
  assert.equal(linha.status, 'vinculada');
  assert.equal(linha.referral_id, R.sugestao);

  // mês seguinte, mesmo contrato: casa direto
  const prox = csvSintetico([{ nome: 'CLIENTE FICTICIO 02 DA SILVA', cpf: '13818854463', contrato: '231860913', pagamento: '28/05/2026', valor: '10.00' }]);
  const p = await imp.previa(db, prox);
  assert.equal(p.contagens.casada, 1);
  assert.equal(p.contagens.sugestao, 0);
});

test('CPF ambíguo: o admin escolhe a indicação; a outra continua sem contrato', async () => {
  const [a] = (await imp.pendencias(db)).ambiguas;
  const r = await db.transacao(cx => imp.vincular(cx, a.id, R.amb2, quem));
  assert.equal(r.lancamento.partner_id, P.b);
  assert.equal(r.lancamento.valor_partner, '18.82');            // 30% de 62,72 = 18,816
  const [i1, i2] = (await db.query('SELECT id, numero_contrato FROM referrals WHERE id = ANY($1::int[]) ORDER BY id', [[R.amb1, R.amb2]])).rows;
  assert.equal(i1.numero_contrato, null);
  assert.equal(i2.numero_contrato, '725276018955');
  assert.equal((await imp.pendencias(db)).ambiguas.length, 0);
});

test('linha "sem Partner" pode ser vinculada à mão pela busca', async () => {
  const achadas = await imp.buscarLinhas(db, 'CLIENTE FICTICIO 08');
  assert.equal(achadas.length, 1);
  assert.equal(achadas[0].status, 'sem_partner');
  const nova = await indicacao(P.a, { nome: 'Cliente 08' });
  const r = await db.transacao(cx => imp.vincular(cx, achadas[0].id, nova, quem));
  assert.equal(r.lancamento.valor_partner, '57.78');            // 30% de 192,60
  assert.equal((await db.query('SELECT numero_contrato FROM referrals WHERE id = $1', [nova])).rows[0].numero_contrato, '336671276');
});

test('vincular a indicação que já tem outro contrato é recusado', async () => {
  const [linha] = await imp.buscarLinhas(db, 'CLIENTE FICTICIO 09');
  await assert.rejects(db.transacao(cx => imp.vincular(cx, linha.id, R.casada, quem)), /já tem o contrato/);
});

// ─── Estorno ────────────────────────────────────────────────────────────────

test('ESTORNADA com contrato de Partner vira "estorno a decidir"; nada muda sozinho', async () => {
  const estorno = csvSintetico([{ nome: 'CLIENTE FICTICIO 01 DA SILVA', contrato: '118159083', pagamento: '20/08/2026', valor: '133.44', situacao: 'ESTORNADA' }]);
  const p = await imp.previa(db, estorno);
  assert.equal(p.contagens.estorno_a_decidir, 1);
  await db.transacao(cx => imp.confirmar(cx, estorno, 'estorno.csv', quem));
  const lanc = (await db.query(`SELECT id, status FROM partner_comissoes WHERE numero_contrato = '118159083'`)).rows[0];
  assert.equal(lanc.status, 'confirmado', 'o lançamento não muda sozinho');

  const [e] = (await imp.pendencias(db)).estornos;
  assert.equal(e.lancamento_estorno_id, lanc.id);
  await assert.rejects(db.transacao(cx => imp.decidirEstorno(cx, e.id, 'estornar', '', quem)), /motivo/);
  await db.transacao(cx => imp.decidirEstorno(cx, e.id, 'estornar', 'cliente cancelou', quem));
  assert.equal((await db.query('SELECT status FROM partner_comissoes WHERE id = $1', [lanc.id])).rows[0].status, 'estornado');
  assert.equal((await imp.pendencias(db)).estornos.length, 0);
});

test('Partner sem nível: a linha casada fica "sem regra" até corrigir', async () => {
  const semNivel = await partner('PARTNER-803', null);
  await indicacao(semNivel, { contrato: '900000077' });
  const arq = csvSintetico([{ contrato: '900000077', pagamento: '15/09/2026', valor: '40.00' }]);
  await db.transacao(cx => imp.confirmar(cx, arq, 'sem-nivel.csv', quem));
  const [l] = (await imp.pendencias(db)).sem_regra;
  assert.match(l.motivo, /sem nível/);
  await db.query(`UPDATE partners SET nivel_partner = 'point' WHERE id = $1`, [semNivel]);
  const r = await db.transacao(cx => imp.tentarSemRegra(cx, l.id, quem));
  assert.equal(r.lancamento.valor_partner, '12.00');
});

test('histórico guarda arquivo, quem importou e as contagens', async () => {
  const h = await imp.historico(db);
  assert.ok(h.length >= 5);
  const primeira = h[h.length - 1];
  assert.equal(primeira.arquivo_nome, 'exemplo.csv');
  assert.equal(primeira.importado_por, quem);
  assert.equal(primeira.contagens.sem_partner, 8);
});

// ─── Seguro (Movv Seguros) nunca entra no casamento da Azul ─────────────────

test('indicação de seguro não casa com a Azul: nem contrato, nem CPF, nem ambiguidade, nem busca', async () => {
  assert.deepEqual(imp.TIPOS_PRODUTO_AZUL, ['credit', 'other']);
  const seguro = (await db.query(`INSERT INTO products (name, type) VALUES ('Movv Seguros', 'insurance') RETURNING id`)).rows[0].id;
  const indicacaoDe = async (prod, { cpf = null, contrato = null, nome }) => (await db.query(
    `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at, client_cpf, numero_contrato)
     VALUES ($1, $2, $3, '64999999999', $4, NOW() + INTERVAL '30 days', $5, $6) RETURNING id`,
    [`S-${Math.random().toString(36).slice(2, 10)}`, P.a, nome, prod, cpf, contrato]
  )).rows[0].id;
  const linha = extra => ({ tipo: 'comissao', produto: 'INSS', dt_pagamento: '2026-09-20', valor_comissao: '10.00', ...extra });

  // só o seguro com o CPF -> não vira sugestão
  await indicacaoDe(seguro, { cpf: '86011112222', nome: 'Só seguro' });
  assert.equal((await imp.classificar(db, linha({ cliente_cpf: '86011112222' }))).status, 'sem_partner');

  // só o seguro com o contrato -> não casa
  await indicacaoDe(seguro, { contrato: '900000500', nome: 'Seguro com contrato' });
  assert.equal((await imp.classificar(db, linha({ numero_contrato: '900000500' }))).status, 'sem_partner');
  assert.equal((await imp.classificar(db, { ...linha({ numero_contrato: '900000500' }), tipo: 'estorno' })).status, 'sem_partner');

  // seguro + crédito com o mesmo CPF -> sugestão do crédito, não ambígua
  const credito = await indicacaoDe(produtoId, { cpf: '86033334444', nome: 'Crédito' });
  await indicacaoDe(seguro, { cpf: '86033334444', nome: 'Seguro do mesmo cliente' });
  const c = await imp.classificar(db, linha({ cliente_cpf: '86033334444' }));
  assert.equal(c.status, 'sugestao');
  assert.equal(c.sugestao_referral_id, credito);

  // a busca para vincular não traz seguro, e vincular a seguro é recusado
  const achadas = await imp.buscarIndicacoes(db, 'Seguro');
  assert.equal(achadas.length, 0);
  const segId = await indicacaoDe(seguro, { nome: 'Seguro para vincular' });
  const [semPartner] = await imp.buscarLinhas(db, 'CLIENTE FICTICIO 10');
  await assert.rejects(db.transacao(cx => imp.vincular(cx, semPartner.id, segId, quem)), /não é uma indicação Azul/);
});
