// Equipe de vendas da loja (migration 102). NÃO é o Vendedor Pessoa Física:
// aqui são funcionários de uma loja CNPJ, sem login no painel. Cada um tem um
// código curto (links da loja e dos produtos); o pedido guarda quem trouxe o
// cliente. O WhatsApp do vendedor é dado pessoal: só a loja vê.
const crypto = require('crypto');
const db = require('../config/database');
const { PLANOS, planoEfetivo } = require('../config/planos');
const { normalizarWhatsapp } = require('./whatsappVerificacao');
const { lojaVisivel } = require('../utils/lojaVisivel');
const { ehRestaurante } = require('../utils/categorias');

class ErroEquipe extends Error {
  constructor(status, codigo, mensagem) { super(mensagem); this.status = status; this.codigo = codigo; }
}

// Sem os que se confundem ao ditar ou ler: 0/O, 1/I/L.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TAMANHO_CODIGO = 5;
const RE_CODIGO = new RegExp(`^[${ALFABETO}]{${TAMANHO_CODIGO}}$`);

function gerarCodigo() {
  let c = '';
  for (let i = 0; i < TAMANHO_CODIGO; i++) c += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return c;
}
function codigoValido(c) { return RE_CODIGO.test(String(c || '').toUpperCase()); }

// Vendedores ATIVOS que o plano que vale agora permite (PF: 0).
function limiteDoPlano(parceiro) {
  return PLANOS[planoEfetivo(parceiro)]?.max_vendedores ?? 0;
}

function exigirCnpj(parceiro) {
  if (parceiro.tipo_pessoa === 'pf') throw new ErroEquipe(403, 'SO_CNPJ', 'A equipe de vendas é para lojas com CNPJ.');
}

function validarDados({ nome, whatsapp }) {
  const n = String(nome ?? '').trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 80) throw new ErroEquipe(400, 'NOME', 'Informe o nome do vendedor (até 80 letras).');
  const w = normalizarWhatsapp(whatsapp);
  if (w.length < 10 || w.length > 11) throw new ErroEquipe(400, 'WHATSAPP', 'WhatsApp com DDD, só números. Ex.: 64 99999-0000.');
  return { nome: n, whatsapp: w };
}

async function ativosDaLoja(cx, parceiroId) {
  return Number((await cx.query('SELECT count(*) FROM loja_vendedores WHERE parceiro_id = $1 AND ativo', [parceiroId])).rows[0].count);
}

async function conferirLimite(cx, parceiro) {
  const limite = limiteDoPlano(parceiro);
  if ((await ativosDaLoja(cx, parceiro.id)) >= limite) {
    throw new ErroEquipe(409, 'LIMITE', `Seu plano permite ${limite} ${limite === 1 ? 'vendedor ativo' : 'vendedores ativos'}. Desative um ou mude de plano para ter mais.`);
  }
}

async function listar(parceiro) {
  const vendedores = (await db.query(
    `SELECT id, nome, whatsapp, codigo, ativo, avisar_whatsapp, autorizou_em, autorizou_por, criado_em, desativado_em
       FROM loja_vendedores WHERE parceiro_id = $1 ORDER BY ativo DESC, nome ASC`, [parceiro.id])).rows;
  return {
    vendedores,
    limite: limiteDoPlano(parceiro),
    plano: planoEfetivo(parceiro),
    ativos: vendedores.filter(v => v.ativo).length,
  };
}

async function doParceiro(cx, parceiroId, id, travar = false) {
  if (!/^\d+$/.test(String(id))) throw new ErroEquipe(404, 'NAO_ENCONTRADO', 'Vendedor não encontrado.');
  const v = (await cx.query(`SELECT * FROM loja_vendedores WHERE id = $1 AND parceiro_id = $2${travar ? ' FOR UPDATE' : ''}`, [id, parceiroId])).rows[0];
  if (!v) throw new ErroEquipe(404, 'NAO_ENCONTRADO', 'Vendedor não encontrado.');
  return v;
}

// Grava com código único: se, por azar, o código sorteado já existir, volta
// ao savepoint (o erro de duplicidade aborta a transação) e sorteia outro.
async function inserirComCodigo(cx, sql, params) {
  for (let i = 0; i < 8; i++) {
    await cx.query('SAVEPOINT codigo_vendedor');
    try {
      const r = (await cx.query(sql, [...params, gerarCodigo()])).rows[0];
      await cx.query('RELEASE SAVEPOINT codigo_vendedor');
      return r;
    } catch (err) {
      await cx.query('ROLLBACK TO SAVEPOINT codigo_vendedor');
      if (err.code !== '23505' || !/codigo/.test(`${err.constraint || ''} ${err.detail || ''}`)) throw err;
    }
  }
  throw new ErroEquipe(500, 'CODIGO', 'Não conseguimos gerar o código agora. Tente de novo.');
}

async function criar(parceiro, usuario, dados) {
  exigirCnpj(parceiro);
  const { nome, whatsapp } = validarDados(dados || {});
  if (dados?.autorizou !== true) throw new ErroEquipe(400, 'AUTORIZACAO', 'Marque que o vendedor autorizou o cadastro do WhatsApp dele.');
  return db.transacao(async cx => {
    await cx.query('SELECT id FROM sindicato_parceiros WHERE id = $1 FOR UPDATE', [parceiro.id]); // dois cadastros ao mesmo tempo não furam o limite
    await conferirLimite(cx, parceiro);
    return inserirComCodigo(cx,
      `INSERT INTO loja_vendedores (parceiro_id, nome, whatsapp, avisar_whatsapp, autorizou_em, autorizou_por, codigo)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6) RETURNING *`,
      [parceiro.id, nome, whatsapp, Boolean(dados.avisar_whatsapp), usuario?.email || null]);
  });
}

// Editar nome, WhatsApp e o aviso. WhatsApp novo pede a autorização de novo.
async function editar(parceiro, usuario, id, dados) {
  exigirCnpj(parceiro);
  const { nome, whatsapp } = validarDados(dados || {});
  return db.transacao(async cx => {
    const v = await doParceiro(cx, parceiro.id, id, true);
    const trocouWhatsapp = whatsapp !== v.whatsapp;
    if (trocouWhatsapp && dados?.autorizou !== true) {
      throw new ErroEquipe(400, 'AUTORIZACAO', 'WhatsApp novo: marque que o vendedor autorizou o cadastro dele.');
    }
    return (await cx.query(
      `UPDATE loja_vendedores SET nome = $3, whatsapp = $4, avisar_whatsapp = $5, atualizado_em = NOW()
              ${trocouWhatsapp ? ', autorizou_em = NOW(), autorizou_por = $6' : ''}
        WHERE id = $1 AND parceiro_id = $2 RETURNING *`,
      trocouWhatsapp
        ? [v.id, parceiro.id, nome, whatsapp, Boolean(dados.avisar_whatsapp), usuario?.email || null]
        : [v.id, parceiro.id, nome, whatsapp, Boolean(dados.avisar_whatsapp)])).rows[0];
  });
}

// Desativar não apaga: o histórico e os pedidos continuam com o vendedor, e
// o link dele para de marcar clientes novos.
async function desativar(parceiro, id) {
  return db.transacao(async cx => {
    const v = await doParceiro(cx, parceiro.id, id, true);
    if (!v.ativo) return v;
    return (await cx.query(`UPDATE loja_vendedores SET ativo = false, desativado_em = NOW(), atualizado_em = NOW() WHERE id = $1 RETURNING *`, [v.id])).rows[0];
  });
}

async function ativar(parceiro, id) {
  exigirCnpj(parceiro);
  return db.transacao(async cx => {
    await cx.query('SELECT id FROM sindicato_parceiros WHERE id = $1 FOR UPDATE', [parceiro.id]);
    const v = await doParceiro(cx, parceiro.id, id, true);
    if (v.ativo) return v;
    await conferirLimite(cx, parceiro);
    return (await cx.query(`UPDATE loja_vendedores SET ativo = true, desativado_em = NULL, atualizado_em = NOW() WHERE id = $1 RETURNING *`, [v.id])).rows[0];
  });
}

// Link vazou ou o vendedor saiu: código novo. O antigo para de valer; as
// vendas já feitas continuam com o vendedor (o pedido guarda o id, não o código).
async function novoCodigo(parceiro, id) {
  return db.transacao(async cx => {
    const v = await doParceiro(cx, parceiro.id, id, true);
    return inserirComCodigo(cx, `UPDATE loja_vendedores SET codigo = $2, atualizado_em = NOW() WHERE id = $1 RETURNING *`, [v.id]);
  });
}

// Link /v/CÓDIGO (e2): para qual página da loja ele leva. Não diz nada do
// vendedor (nem nome): só o destino e se o código ainda marca o cliente
// (vendedor desativado: o link abre a loja, mas não marca).
async function destinoDoCodigo(codigo, qa = false) {
  if (!codigoValido(codigo)) return null;
  const r = (await db.query(
    `SELECT v.ativo, pa.slug, pa.categorias, pa.tipo_negocio, pa.tipo_pessoa,
            EXISTS (SELECT 1 FROM sindicato_parceiro_produtos pr WHERE pr.parceiro_id = pa.id AND pr.ativo AND NOT pr.rascunho AND pr.moderacao_status = 'aprovado') AS tem_produtos,
            EXISTS (SELECT 1 FROM beer_estabelecimentos be WHERE be.parceiro_id = pa.id AND be.ativo) AS tem_beer
       FROM loja_vendedores v JOIN sindicato_parceiros pa ON pa.id = v.parceiro_id
      WHERE v.codigo = $1 AND ${lojaVisivel(qa, 'pa')}`, [String(codigo).toUpperCase()])).rows[0];
  if (!r) return null;
  let destino = `/marketplace/parceiro/${r.slug}`;
  if (ehRestaurante(r.categorias)) destino = `/food/${r.slug}`;
  else if (r.tipo_negocio === 'servico') destino = `/servicos/${r.slug}`;
  else if (r.tem_beer && !r.tem_produtos) destino = `/beer/estabelecimento/${r.slug}`;
  return { destino, marcar: Boolean(r.ativo) && r.tipo_pessoa !== 'pf' };
}

// ── Relatório (e4) ─────────────────────────────────────────────────────
// Vendas por vendedor no período: só pedidos ENTREGUES, pela data da
// entrega (horário de Itumbiara). "valor dos produtos" = sem a entrega;
// "valor total" = o que o cliente pagou. A loja escolhe a base da comissão.
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS_RELATORIO = 400;

function periodo(de, ate) {
  if (!RE_DATA.test(String(de)) || !RE_DATA.test(String(ate)) || Number.isNaN(Date.parse(de)) || Number.isNaN(Date.parse(ate))) {
    throw new ErroEquipe(400, 'PERIODO', 'Escolha o período (de e até).');
  }
  const dias = (Date.parse(ate) - Date.parse(de)) / 86400000;
  if (dias < 0) throw new ErroEquipe(400, 'PERIODO', 'A data final vem antes da inicial.');
  if (dias > MAX_DIAS_RELATORIO) throw new ErroEquipe(400, 'PERIODO', 'Escolha um período de até um ano.');
  return { de, ate };
}

const dinheiro = v => Math.round(Number(v || 0) * 100) / 100;

async function relatorio(parceiro, de, ate) {
  const per = periodo(de, ate);
  const pedidos = (await db.query(
    `SELECT p.id, p.entregue_em, p.vendedor_id, v.nome AS vendedor, p.subtotal, p.valor_entrega, p.total
       FROM loja_pedidos p LEFT JOIN loja_vendedores v ON v.id = p.vendedor_id
      WHERE p.parceiro_id = $1 AND p.status = 'entregue'
        AND p.entregue_em >= ($2::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
        AND p.entregue_em <  ($3::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      ORDER BY p.entregue_em, p.id`, [parceiro.id, per.de, per.ate])).rows
    .map(r => ({ ...r, subtotal: dinheiro(r.subtotal), valor_entrega: dinheiro(r.valor_entrega), total: dinheiro(r.total) }));
  const vendedores = (await db.query('SELECT id, nome, ativo FROM loja_vendedores WHERE parceiro_id = $1 ORDER BY nome', [parceiro.id])).rows;
  const linha = (id, nome, ativo) => {
    const dele = pedidos.filter(p => (p.vendedor_id ?? null) === id);
    return { vendedor_id: id, vendedor: nome, ativo, pedidos: dele.length,
      valor_produtos: dinheiro(dele.reduce((s, p) => s + p.subtotal, 0)), valor_total: dinheiro(dele.reduce((s, p) => s + p.total, 0)) };
  };
  // vendedores ativos sempre aparecem (mesmo zerados); desativados só com venda no período
  const porVendedor = vendedores.map(v => linha(v.id, v.nome, v.ativo)).filter(l => l.ativo || l.pedidos > 0)
    .sort((a, b) => b.valor_total - a.valor_total || a.vendedor.localeCompare(b.vendedor));
  const loja = linha(null, 'Loja (sem link)', true);
  return {
    de: per.de, ate: per.ate,
    linhas: [...porVendedor, loja],
    total: { pedidos: pedidos.length, valor_produtos: dinheiro(pedidos.reduce((s, p) => s + p.subtotal, 0)), valor_total: dinheiro(pedidos.reduce((s, p) => s + p.total, 0)) },
    pedidos: pedidos.map(({ vendedor_id: _id, ...p }) => ({ ...p, vendedor: p.vendedor || 'Loja (sem link)' })), // eslint-disable-line no-unused-vars
  };
}

// Planilha (.xlsx) com duas abas: Resumo e Pedidos. Sem dado do cliente.
function planilha(rel, nomeLoja) {
  const XLSX = require('xlsx');
  const br = d => d.split('-').reverse().join('/');
  const dataHora = d => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const resumo = XLSX.utils.aoa_to_sheet([
    [`Vendas por vendedor — ${nomeLoja}`],
    [`Período: ${br(rel.de)} a ${br(rel.ate)}. Só pedidos entregues pelo IUB MAIS+.`],
    ['A atribuição é uma estimativa: conta o último link de vendedor usado pelo cliente nos 7 dias antes do pedido.'],
    [],
    ['Vendedor', 'Pedidos entregues', 'Valor dos produtos (R$)', 'Valor total (R$)'],
    ...rel.linhas.map(l => [l.vendedor + (l.ativo === false ? ' (desativado)' : ''), l.pedidos, l.valor_produtos, l.valor_total]),
    ['Total', rel.total.pedidos, rel.total.valor_produtos, rel.total.valor_total],
  ]);
  resumo['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 24 }, { wch: 18 }];
  const lista = XLSX.utils.aoa_to_sheet([
    ['Pedido', 'Entregue em', 'Vendedor', 'Valor dos produtos (R$)', 'Entrega (R$)', 'Valor total (R$)'],
    ...rel.pedidos.map(p => [p.id, dataHora(p.entregue_em), p.vendedor, p.subtotal, p.valor_entrega, p.total]),
  ]);
  lista['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, resumo, 'Resumo');
  XLSX.utils.book_append_sheet(wb, lista, 'Pedidos');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  relatorio, planilha,
  destinoDoCodigo,
  ErroEquipe, ALFABETO, gerarCodigo, codigoValido, limiteDoPlano,
  listar, criar, editar, desativar, ativar, novoCodigo,
};
