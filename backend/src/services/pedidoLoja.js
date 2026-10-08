const crypto = require('crypto');
const db = require('../config/database');
const {
  PRAZO_RESPOSTA_MIN, MAX_PEDIDOS_ABERTOS, MAX_ITENS_DIFERENTES, MAX_QUANTIDADE_ITEM, MAX_QUANTIDADE_PROMOCAO,
  STATUS_NAO_PAGOS, TRANSICOES,
} = require('../config/pedidos');
const { horarioConfigurado, turnoAtual, abertoEfetivo, diaDeHoje, idadeEmAnos, IDADE_MINIMA } = require('../config/beer');
const { ehHojeODiaDoEvento } = require('../config/fechaMes');
const { fechaMesHabilitadoGlobalmente, obterProximoEvento } = require('./fechaMesService');
const { situacaoDoAssociado } = require('./beneficioAssociado');
const { whatsappConfirmado, normalizarWhatsapp } = require('./whatsappVerificacao');
const { onlyDigits } = require('../utils/validators');
const pedidoAvisos = require('./pedidoAvisos');

// Pedido pelo site (botão Comprar) — núcleo. O DINHEIRO NÃO PASSA PELO IUB:
// o cliente paga no Pix da loja; aqui só se registra e acompanha.
// Uma regra só pra "essa loja/esse item pode ser comprado?" e "quanto
// custa?", usada pelo botão, pela cotação e pela criação do pedido — o
// preço SEMPRE sai daqui, nunca do front.

class ErroPedido extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const dinheiro = (v) => Math.round(Number(v) * 100) / 100;
const temPreco = (v) => v !== null && v !== undefined && Number(v) > 0;

// ── Loja ───────────────────────────────────────────────────────────────

const SELECT_LOJA = `
  pa.id, pa.nome, pa.slug, pa.status, pa.empresa_teste, pa.tipo_pessoa, pa.tipo_negocio, pa.whatsapp,
  pa.horario_funcionamento, pa.delivery_disponivel, pa.retirada_disponivel, pa.taxa_entrega,
  pa.entrega_gratis_acima, pa.raio_entrega_km, pa.tempo_preparo_min,
  pa.pedidos_site_ativo, pa.pedidos_pausados, pa.pedidos_aceite_automatico, pa.pedidos_confirmado_em,
  pa.pix_chave, pa.pix_tipo, pa.pix_nome_recebedor`;

async function carregarLoja(parceiroId, client = db) {
  const r = await client.query(`SELECT ${SELECT_LOJA} FROM sindicato_parceiros pa WHERE pa.id = $1`, [parceiroId]);
  const loja = r.rows[0];
  if (!loja) return null;
  const be = await client.query(
    `SELECT id, ativo, whatsapp, horario_funcionamento, status_aberto, ultimo_status_update, bairros_entrega,
            tempo_entrega_min, retirada_disponivel
     FROM beer_estabelecimentos WHERE parceiro_id = $1`,
    [parceiroId]
  );
  loja.beer = be.rows[0] || null;
  return loja;
}

// Motivo pelo qual a loja NÃO vende pelo site agora (null = vende).
// catalogo 'geral' = sindicato_parceiro_produtos/promoções/Fecha Mês;
// 'beer' = Disk Bebidas (aberto, retirada e bairros vêm do estabelecimento).
function motivoLojaNaoVende(loja, catalogo, { qa = false, agora = new Date() } = {}) {
  if (!loja) return { code: 'LOJA_INDISPONIVEL', msg: 'Loja não encontrada.' };
  // Empresa de teste só em modo QA (admin logado), e aí vale mesmo pausada.
  const visivel = loja.empresa_teste ? qa : loja.status === 'ativo';
  if (!visivel) return { code: 'LOJA_INDISPONIVEL', msg: 'Essa loja não está disponível agora.' };
  if (loja.tipo_pessoa !== 'pj') return { code: 'SO_WHATSAPP', msg: 'Essa loja atende só pelo WhatsApp.' };
  if (catalogo === 'geral' && loja.tipo_negocio !== 'produto') return { code: 'SO_WHATSAPP', msg: 'Essa loja atende só pelo WhatsApp.' };
  if (catalogo === 'beer' && !loja.beer?.ativo) return { code: 'LOJA_INDISPONIVEL', msg: 'Essa loja não está disponível agora.' };
  if (!loja.pedidos_site_ativo || !loja.pedidos_confirmado_em || !loja.pix_chave) {
    return { code: 'SO_WHATSAPP', msg: 'Essa loja ainda não recebe pedidos pelo site.' };
  }
  if (loja.pedidos_pausados) return { code: 'PAUSADO', msg: 'A loja pausou os pedidos pelo site. Chame no WhatsApp.' };
  if (!whatsappDaLoja(loja, catalogo)) return { code: 'SO_WHATSAPP', msg: 'Essa loja ainda não recebe pedidos pelo site.' };

  if (catalogo === 'beer') {
    if (!horarioConfigurado(loja.beer.horario_funcionamento) || !abertoEfetivo(loja.beer, agora)) {
      return { code: 'FECHADO', msg: 'A loja está fechada agora.' };
    }
  } else if (!horarioConfigurado(loja.horario_funcionamento) || !turnoAtual(loja.horario_funcionamento, agora)) {
    return { code: 'FECHADO', msg: 'A loja está fechada agora.' };
  }
  if (modosDisponiveis(loja, catalogo).length === 0) return { code: 'SO_WHATSAPP', msg: 'Essa loja ainda não recebe pedidos pelo site.' };
  return null;
}

// Pra onde vai o aviso do pedido: no Beer, o WhatsApp do estabelecimento.
function whatsappDaLoja(loja, catalogo) {
  return normalizarWhatsapp(catalogo === 'beer' ? loja.beer?.whatsapp : loja.whatsapp) || null;
}

function modosDisponiveis(loja, catalogo) {
  const modos = [];
  if (loja.delivery_disponivel) modos.push('entrega');
  if (catalogo === 'beer' ? loja.beer?.retirada_disponivel : loja.retirada_disponivel) modos.push('retirada');
  return modos;
}

// Taxa sempre da loja (também no Beer). NULL/0 = grátis.
function taxaEntrega(loja, subtotal) {
  const taxa = Number(loja.taxa_entrega) || 0;
  const gratisAcima = Number(loja.entrega_gratis_acima) || 0;
  if (taxa <= 0 || (gratisAcima > 0 && subtotal >= gratisAcima)) return 0;
  return dinheiro(taxa);
}

// O que o cliente vê da loja no Finalizar pedido (área/bairros informados —
// sem bloqueio por área na V1: a loja recusa se for fora).
function resumoLoja(loja, catalogo) {
  return {
    id: loja.id, nome: loja.nome, slug: loja.slug, catalogo,
    modos: modosDisponiveis(loja, catalogo),
    taxa_entrega: Number(loja.taxa_entrega) || 0,
    entrega_gratis_acima: Number(loja.entrega_gratis_acima) || null,
    raio_entrega_km: catalogo === 'beer' ? null : (Number(loja.raio_entrega_km) || null),
    bairros_entrega: catalogo === 'beer' ? (loja.beer?.bairros_entrega || []) : [],
    tempo_min: catalogo === 'beer' ? (loja.beer?.tempo_entrega_min || null) : (loja.tempo_preparo_min || null),
    aceite_automatico: Boolean(loja.pedidos_aceite_automatico),
  };
}

// ── Preço ──────────────────────────────────────────────────────────────
// Regra: o MENOR preço a que o cliente tem direito agora —
//   produto:   preço normal, de associado (benefício ativo) ou Fecha Mês (dia do evento)
//   promoção:  preço "por", ou de associado da promoção (benefício ativo)
//   Fecha Mês: preço do evento (item bônus só existe no evento)
//   Beer:      preço vigente (oferta dentro do prazo); Beer não tem preço de associado

async function edicaoFechaMesDeHoje() {
  if (!(await fechaMesHabilitadoGlobalmente())) return null;
  const evento = await obterProximoEvento();
  return evento.ativo && ehHojeODiaDoEvento(evento.data_evento) ? evento.id : null;
}

function menorPreco(candidatos) {
  return candidatos.filter(c => temPreco(c.preco)).reduce((m, c) => (!m || Number(c.preco) < Number(m.preco) ? c : m), null);
}

function fotoDe(fotos, fallback = null) {
  return (Array.isArray(fotos) && fotos[0]?.url) || fallback || null;
}

// Resolve UM item de entrada { tipo, id } no item do pedido (sem quantidade).
// Lança ErroPedido se não pode ser comprado.
async function resolverItem(entrada, ctx) {
  const id = Number(entrada?.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroPedido(400, 'ITEM_INVALIDO', 'Item inválido.');
  const indisponivel = (nome) => new ErroPedido(409, 'ITEM_INDISPONIVEL', `${nome || 'Um item'} não está mais disponível.`, { item: entrada });

  if (entrada.tipo === 'beer') {
    const r = await db.query(
      `SELECT bp.id, bp.nome, bp.imagem, bp.fotos, bp.dias_disponiveis, be.parceiro_id,
              (bp.em_oferta AND bp.preco_original IS NOT NULL AND bp.oferta_ate > NOW()) AS oferta_ativa,
              (CASE WHEN (bp.em_oferta AND bp.preco_original IS NOT NULL AND bp.oferta_ate > NOW())
                    THEN bp.preco ELSE COALESCE(bp.preco_original, bp.preco) END) AS preco_vigente,
              bp.preco_original
       FROM beer_produtos bp
       JOIN beer_estabelecimentos be ON be.id = bp.estabelecimento_id
       JOIN beer_categorias bc ON bc.codigo = bp.categoria_codigo
       WHERE bp.id = $1 AND bp.status = 'aprovado' AND bp.disponivel = true AND bc.ativo = true AND be.ativo = true`,
      [id]
    );
    const p = r.rows[0];
    if (!p) throw indisponivel();
    const dias = p.dias_disponiveis || { todos: true };
    if (!dias.todos && !dias[diaDeHoje()]) throw indisponivel(p.nome);
    if (!temPreco(p.preco_vigente)) throw indisponivel(p.nome);
    return {
      catalogo: 'beer', parceiro_id: p.parceiro_id, origem: 'beer', beer_produto_id: p.id,
      nome: p.nome, foto_url: fotoDe(p.fotos, p.imagem),
      tipo_preco: p.oferta_ativa ? 'oferta' : 'normal', preco_unitario: dinheiro(p.preco_vigente),
      preco_cheio: p.oferta_ativa ? dinheiro(p.preco_original) : null,
    };
  }

  if (entrada.tipo === 'promocao') {
    const r = await db.query(
      `SELECT pm.id, pm.parceiro_id, pm.titulo, pm.foto_url, pm.preco_de, pm.preco_por, pm.preco_associado,
              pm.produto_id, pm.exclusivo_associado, pr.fotos
       FROM sindicato_parceiro_promocoes pm
       LEFT JOIN sindicato_parceiro_produtos pr ON pr.id = pm.produto_id
       WHERE pm.id = $1 AND pm.ativo = true AND pm.rascunho = false
         AND (pm.data_inicio IS NULL OR pm.data_inicio <= NOW()) AND (pm.data_fim IS NULL OR pm.data_fim >= NOW())
         AND (pm.limite_usos IS NULL OR pm.usos_atuais < pm.limite_usos)`,
      [id]
    );
    const p = r.rows[0];
    if (!p || !temPreco(p.preco_por)) throw indisponivel();
    // Promoção exclusiva: só quem tem o benefício ativo compra (antes o
    // servidor ignorava a marca e qualquer pessoa comprava — correção 07/10).
    if (p.exclusivo_associado && !ctx.associadoAtivo) {
      throw new ErroPedido(403, 'SO_ASSOCIADO', 'Esta promoção é só para quem é do Clube MAIS+.');
    }
    const escolhido = menorPreco([
      { preco: p.preco_por, tipo: 'promocao' },
      ctx.associadoAtivo ? { preco: p.preco_associado, tipo: 'associado' } : null,
    ].filter(Boolean));
    return {
      catalogo: 'geral', parceiro_id: p.parceiro_id, origem: 'promocao', promocao_id: p.id, produto_id: p.produto_id,
      nome: p.titulo, foto_url: p.foto_url || fotoDe(p.fotos),
      tipo_preco: escolhido.tipo, preco_unitario: dinheiro(escolhido.preco), preco_cheio: temPreco(p.preco_de) ? dinheiro(p.preco_de) : null,
    };
  }

  // 'fecha_mes' (id = item da edição) ou 'produto' (id = produto do catálogo)
  let fmp = null;
  let produtoId = id;
  if (entrada.tipo === 'fecha_mes') {
    if (!ctx.edicaoFechaMes) throw new ErroPedido(409, 'ITEM_INDISPONIVEL', 'O Fecha Mês não está acontecendo agora.', { item: entrada });
    fmp = (await db.query(
      `SELECT id, parceiro_id, produto_id, e_produto_bonus, bonus_nome, bonus_foto_url, preco_original, preco_fecha_mes, estoque_disponivel
       FROM sindicato_fecha_mes_produtos WHERE id = $1 AND fecha_mes_id = $2 AND status = 'confirmado'`,
      [id, ctx.edicaoFechaMes]
    )).rows[0];
    if (!fmp || fmp.estoque_disponivel === 0) throw indisponivel();
    if (fmp.e_produto_bonus) {
      return {
        catalogo: 'geral', parceiro_id: fmp.parceiro_id, origem: 'produto', fecha_mes_produto_id: fmp.id,
        nome: fmp.bonus_nome, foto_url: fmp.bonus_foto_url,
        tipo_preco: 'fecha_mes', preco_unitario: dinheiro(fmp.preco_fecha_mes), preco_cheio: dinheiro(fmp.preco_original),
        estoque_max: fmp.estoque_disponivel,
      };
    }
    produtoId = fmp.produto_id;
  } else if (entrada.tipo !== 'produto') {
    throw new ErroPedido(400, 'ITEM_INVALIDO', 'Item inválido.');
  }

  const p = (await db.query(
    `SELECT id, parceiro_id, nome, fotos, foto_url, preco, preco_associado, estoque_disponivel
     FROM sindicato_parceiro_produtos
     WHERE id = $1 AND ativo = true AND rascunho = false AND moderacao_status = 'aprovado'`,
    [produtoId]
  )).rows[0];
  if (!p || !p.estoque_disponivel || !temPreco(p.preco)) throw indisponivel(p?.nome);
  // Produto do catálogo que está no Fecha Mês de hoje também ganha o preço do evento.
  if (!fmp && ctx.edicaoFechaMes) {
    fmp = (await db.query(
      `SELECT id, preco_fecha_mes, estoque_disponivel FROM sindicato_fecha_mes_produtos
       WHERE fecha_mes_id = $1 AND produto_id = $2 AND status = 'confirmado' AND NOT e_produto_bonus
         AND (estoque_disponivel IS NULL OR estoque_disponivel > 0)`,
      [ctx.edicaoFechaMes, p.id]
    )).rows[0] || null;
  }
  const escolhido = menorPreco([
    { preco: p.preco, tipo: 'normal' },
    ctx.associadoAtivo ? { preco: p.preco_associado, tipo: 'associado' } : null,
    fmp ? { preco: fmp.preco_fecha_mes, tipo: 'fecha_mes' } : null,
  ].filter(Boolean));
  return {
    catalogo: 'geral', parceiro_id: p.parceiro_id, origem: 'produto', produto_id: p.id,
    fecha_mes_produto_id: escolhido.tipo === 'fecha_mes' ? fmp.id : null,
    nome: p.nome, foto_url: fotoDe(p.fotos, p.foto_url),
    tipo_preco: escolhido.tipo, preco_unitario: dinheiro(escolhido.preco),
    preco_cheio: escolhido.tipo === 'normal' ? null : dinheiro(p.preco),
    estoque_max: escolhido.tipo === 'fecha_mes' ? fmp.estoque_disponivel : null,
  };
}

async function contextoPreco(associado) {
  const beneficio = associado ? await situacaoDoAssociado(associado.id) : null;
  return { associadoAtivo: beneficio?.situacao === 'ativo', edicaoFechaMes: await edicaoFechaMesDeHoje() };
}

// ── Botão Comprar ──────────────────────────────────────────────────────
// { pode, motivo?, code?, item? } — pro botão aparecer (ou não) na página.
async function disponibilidade(entrada, { associado = null, qa = false } = {}) {
  try {
    const ctx = await contextoPreco(associado);
    const item = await resolverItem(entrada, ctx);
    const loja = await carregarLoja(item.parceiro_id);
    const motivo = motivoLojaNaoVende(loja, item.catalogo, { qa });
    if (motivo) return { pode: false, code: motivo.code, motivo: motivo.msg };
    return { pode: true, loja: resumoLoja(loja, item.catalogo), item: semInterno(item) };
  } catch (err) {
    if (err instanceof ErroPedido) return { pode: false, code: err.code, motivo: err.message };
    throw err;
  }
}

// Várias lojas de uma vez (cards de listagem): { [id]: { pode, loja? } }.
// catalogo 'beer' = ids de beer_estabelecimentos; 'geral' = ids de parceiros.
async function lojasVendendo(catalogo, ids, { qa = false } = {}) {
  const unicos = [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 60);
  if (!unicos.length) return {};
  const parceiros = catalogo === 'beer'
    ? (await db.query('SELECT id, parceiro_id FROM beer_estabelecimentos WHERE id = ANY($1)', [unicos])).rows
    : unicos.map(id => ({ id, parceiro_id: id }));
  const saida = {};
  for (const { id, parceiro_id: parceiroId } of parceiros) {
    const loja = await carregarLoja(parceiroId);
    const motivo = motivoLojaNaoVende(loja, catalogo, { qa });
    saida[id] = motivo ? { pode: false } : { pode: true, loja: { id: loja.id, nome: loja.nome, slug: loja.slug, catalogo } };
  }
  return saida;
}

function semInterno({ estoque_max, catalogo, ...item }) { // eslint-disable-line no-unused-vars
  return item;
}

// ── Cotação (Finalizar pedido) e criação ───────────────────────────────

function validarEndereco(e) {
  const t = (v, max) => String(v ?? '').trim().slice(0, max);
  const end = {
    cep: onlyDigits(e?.cep).slice(0, 8), endereco: t(e?.endereco, 200), numero: t(e?.numero, 20),
    complemento: t(e?.complemento, 100) || null, bairro: t(e?.bairro, 100),
    cidade: t(e?.cidade, 100) || null, estado: t(e?.estado, 2).toUpperCase() || null, referencia: t(e?.referencia, 200) || null,
  };
  if (end.cep.length !== 8) throw new ErroPedido(400, 'ENDERECO', 'CEP precisa ter 8 números.', { campo: 'cep' });
  if (!end.endereco) throw new ErroPedido(400, 'ENDERECO', 'Informe a rua.', { campo: 'endereco' });
  if (!end.numero) throw new ErroPedido(400, 'ENDERECO', 'Informe o número (ou "s/n").', { campo: 'numero' });
  if (!end.bairro) throw new ErroPedido(400, 'ENDERECO', 'Informe o bairro.', { campo: 'bairro' });
  return end;
}

// Monta tudo a partir da entrada do cliente e confere as regras. Não grava.
// entrada: { itens: [{ tipo, id, quantidade }], modo_recebimento?, confirmo_maior_18? }
async function cotar(associado, entrada, { qa = false } = {}) {
  const lista = Array.isArray(entrada?.itens) ? entrada.itens : [];
  if (lista.length === 0) throw new ErroPedido(400, 'SEM_ITENS', 'Escolha pelo menos um produto.');
  if (lista.length > MAX_ITENS_DIFERENTES) throw new ErroPedido(400, 'ITENS_DEMAIS', `No máximo ${MAX_ITENS_DIFERENTES} produtos diferentes por pedido.`);

  const ctx = await contextoPreco(associado);
  const itens = [];
  const vistos = new Set();
  for (const e of lista) {
    const quantidade = Number(e?.quantidade ?? 1);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTIDADE_ITEM) {
      throw new ErroPedido(400, 'QUANTIDADE', `Quantidade precisa ser de 1 a ${MAX_QUANTIDADE_ITEM}.`, { item: e });
    }
    const chave = `${e?.tipo}:${e?.id}`;
    if (vistos.has(chave)) throw new ErroPedido(400, 'ITEM_REPETIDO', 'O mesmo produto apareceu duas vezes. Ajuste a quantidade.');
    vistos.add(chave);
    const item = await resolverItem(e, ctx);
    if (item.origem === 'promocao' && quantidade > MAX_QUANTIDADE_PROMOCAO) {
      throw new ErroPedido(400, 'QUANTIDADE', `Promoção: ${MAX_QUANTIDADE_PROMOCAO} unidade por pedido.`, { item: e });
    }
    if (item.estoque_max != null && quantidade > item.estoque_max) {
      throw new ErroPedido(409, 'QUANTIDADE', `Só tem ${item.estoque_max} unidade(s) de ${item.nome} no Fecha Mês.`, { item: e });
    }
    itens.push({ ...item, quantidade, subtotal: dinheiro(item.preco_unitario * quantidade) });
  }

  // Um pedido = uma loja (e um catálogo: Disk Bebidas não mistura com o resto).
  const { parceiro_id: parceiroId, catalogo } = itens[0];
  if (itens.some(i => i.parceiro_id !== parceiroId)) {
    throw new ErroPedido(400, 'LOJAS_MISTURADAS', 'Um pedido é de uma loja só. Faça um pedido para cada loja.');
  }
  if (itens.some(i => i.catalogo !== catalogo)) {
    throw new ErroPedido(400, 'LOJAS_MISTURADAS', 'Bebidas do Disk Bebidas vão num pedido separado.');
  }
  const loja = await carregarLoja(parceiroId);
  const motivo = motivoLojaNaoVende(loja, catalogo, { qa });
  if (motivo) throw new ErroPedido(409, motivo.code, motivo.msg);

  const subtotal = dinheiro(itens.reduce((s, i) => s + i.subtotal, 0));
  const modos = modosDisponiveis(loja, catalogo);
  const modo = entrada?.modo_recebimento ?? null;
  if (modo !== null && !modos.includes(modo)) {
    throw new ErroPedido(409, 'MODO_INDISPONIVEL', modo === 'entrega' ? 'Essa loja não faz entrega.' : 'Essa loja não tem retirada.');
  }
  const valorEntrega = modo === 'entrega' ? taxaEntrega(loja, subtotal) : 0;
  return {
    loja, catalogo,
    resumo: {
      loja: resumoLoja(loja, catalogo),
      itens: itens.map(semInterno),
      subtotal, modo_recebimento: modo, valor_entrega: valorEntrega, total: dinheiro(subtotal + valorEntrega),
      // valor de entrega se escolher entrega (pra tela mostrar antes de escolher)
      taxa_se_entrega: modos.includes('entrega') ? taxaEntrega(loja, subtotal) : null,
      aviso_idade: catalogo === 'beer',
      forma_pagamento: 'pix',
    },
  };
}

// Disk Bebidas: +18 conferido no servidor. Cadastro com nascimento manda;
// sem nascimento, o cliente confirma no pedido (autodeclaração, com registro).
async function conferirIdadeBeer(associado, entrada, ip, userAgent) {
  const idade = idadeEmAnos(associado.data_nascimento);
  let metodo; let maior;
  if (idade !== null) {
    metodo = 'cadastro'; maior = idade >= IDADE_MINIMA;
  } else {
    if (entrada?.confirmo_maior_18 !== true) {
      throw new ErroPedido(400, 'CONFIRME_IDADE', 'Confirme que você tem 18 anos ou mais.', { campo: 'confirmo_maior_18' });
    }
    metodo = 'autodeclaracao'; maior = true;
  }
  await db.query(
    `INSERT INTO beer_verificacoes_idade (associado_id, metodo, is_adult, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [associado.id, metodo, maior, ip || null, String(userAgent || '').slice(0, 500) || null]
  );
  if (!maior) throw new ErroPedido(403, 'MENOR_DE_IDADE', 'Venda de bebida alcoólica só para maiores de 18 anos.');
}

function gerarTokenLoja() {
  return crypto.randomBytes(24).toString('base64url'); // 32 caracteres
}

// entrada: { itens, modo_recebimento, endereco?, observacao?, confirmo_maior_18? }
async function criarPedido(associado, entrada, { qa = false, ip = null, userAgent = null } = {}) {
  if (!associado.ativo) throw new ErroPedido(403, 'CONTA_INATIVA', 'Sua conta está desativada.');
  if (!whatsappConfirmado(associado)) {
    throw new ErroPedido(403, 'WHATSAPP_NAO_CONFIRMADO', 'Confirme seu WhatsApp para enviar o pedido.');
  }
  if (!['entrega', 'retirada'].includes(entrada?.modo_recebimento)) {
    throw new ErroPedido(400, 'MODO', 'Escolha entrega ou retirada.', { campo: 'modo_recebimento' });
  }
  const { loja, catalogo, resumo } = await cotar(associado, entrada, { qa });
  const endereco = entrada.modo_recebimento === 'entrega' ? validarEndereco(entrada.endereco) : null;
  const observacao = String(entrada?.observacao ?? '').trim().slice(0, 500) || null;

  const abertos = (await db.query(
    'SELECT COUNT(*)::int AS n FROM loja_pedidos WHERE associado_id = $1 AND status = ANY($2)',
    [associado.id, STATUS_NAO_PAGOS]
  )).rows[0].n;
  if (abertos >= MAX_PEDIDOS_ABERTOS) {
    throw new ErroPedido(409, 'LIMITE_PEDIDOS', `Você já tem ${MAX_PEDIDOS_ABERTOS} pedidos esperando a loja ou o Pix. Espere algum andar.`);
  }
  if (catalogo === 'beer') await conferirIdadeBeer(associado, entrada, ip, userAgent);

  const automatico = Boolean(loja.pedidos_aceite_automatico);
  let criado;
  try {
    criado = await db.transacao(async (client) => {
      const p = (await client.query(
        `INSERT INTO loja_pedidos (
           parceiro_id, associado_id, catalogo, beer_estabelecimento_id, status,
           cliente_nome, cliente_whatsapp, modo_recebimento,
           cep, endereco, numero, complemento, bairro, cidade, estado, referencia,
           subtotal, valor_entrega, total, forma_pagamento,
           pix_chave, pix_tipo, pix_nome_recebedor, aceito_em,
           aviso_idade, aceite_automatico, observacao, token_loja)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pix',$20,$21,$22,$23,$24,$25,$26,$27)
         RETURNING *`,
        [
          loja.id, associado.id, catalogo, catalogo === 'beer' ? loja.beer.id : null, automatico ? 'aceito' : 'enviado',
          associado.nome_completo, normalizarWhatsapp(associado.whatsapp), entrada.modo_recebimento,
          endereco?.cep ?? null, endereco?.endereco ?? null, endereco?.numero ?? null, endereco?.complemento ?? null,
          endereco?.bairro ?? null, endereco?.cidade ?? null, endereco?.estado ?? null, endereco?.referencia ?? null,
          resumo.subtotal, resumo.valor_entrega, resumo.total,
          // aceite automático: já nasce aceito, com o Pix da loja copiado
          automatico ? loja.pix_chave : null, automatico ? loja.pix_tipo : null, automatico ? loja.pix_nome_recebedor : null,
          automatico ? new Date() : null,
          catalogo === 'beer', automatico, observacao, gerarTokenLoja(),
        ]
      )).rows[0];
      // Promoção com limite: reserva 1 vaga por pedido já na criação (mesma
      // "vaga" do clique no WhatsApp da promoção). Atômico: com a última vaga,
      // só um pedido passa. Devolvida em recusado/expirado/cancelado.
      for (const i of resumo.itens.filter(x => x.promocao_id)) {
        const vaga = await client.query(
          `UPDATE sindicato_parceiro_promocoes SET usos_atuais = usos_atuais + 1
           WHERE id = $1 AND (limite_usos IS NULL OR usos_atuais < limite_usos) RETURNING id`,
          [i.promocao_id]
        );
        if (!vaga.rows[0]) throw new ErroPedido(409, 'ITEM_INDISPONIVEL', `As vagas da promoção "${i.nome}" acabaram.`);
      }
      const itens = [];
      for (const i of resumo.itens) {
        itens.push((await client.query(
          `INSERT INTO loja_pedido_itens (pedido_id, origem, produto_id, promocao_id, fecha_mes_produto_id, beer_produto_id,
             nome, foto_url, tipo_preco, preco_unitario, preco_cheio, quantidade, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [p.id, i.origem, i.produto_id ?? null, i.promocao_id ?? null, i.fecha_mes_produto_id ?? null, i.beer_produto_id ?? null,
            String(i.nome).slice(0, 200), i.foto_url, i.tipo_preco, i.preco_unitario, i.preco_cheio, i.quantidade, i.subtotal]
        )).rows[0]);
      }
      return { pedido: p, itens };
    });
  } catch (err) {
    if (err.code === '23505' && /uq_loja_pedidos_nao_pago_por_loja/.test(err.constraint || err.message)) {
      throw new ErroPedido(409, 'JA_TEM_PEDIDO_NA_LOJA', 'Você já tem um pedido esperando a loja ou o Pix nessa loja. Acompanhe em Meus pedidos.');
    }
    throw err;
  }
  // Depois do COMMIT: aviso pra loja (e pro cliente, no aceite automático).
  const avisos = await pedidoAvisos.avisarNovoPedido(criado.pedido);
  return { ...criado, avisos };
}

// ── Mudança de status ──────────────────────────────────────────────────
// Atômica: o UPDATE só pega se o pedido ainda está num status de origem
// permitido (dois cliques, loja e rotina ao mesmo tempo: só um vence).
// dono: { associadoId } pro cliente, { parceiroId } pra loja, nada pro sistema.
// Devolve { pedido, de } ou lança ErroPedido.
async function transicionar(pedidoId, ator, acao, { associadoId = null, parceiroId = null, resposta = null, confirmoCancelarPago = false } = {}) {
  const regra = TRANSICOES[ator]?.[acao];
  if (!regra) throw new ErroPedido(400, 'ACAO_INVALIDA', 'Ação inválida.');
  // Loja cancelando DEPOIS de "pago, saiu": o cliente já recebeu "a loja
  // confirmou seu Pix". Só com confirmação explícita e motivo (Junior, 05/10).
  let de = regra.de;
  if (ator === 'loja' && acao === 'cancelar' && !confirmoCancelarPago) de = de.filter(st => st !== 'pago_saiu');
  if (ator === 'loja' && acao === 'cancelar' && confirmoCancelarPago && !String(resposta || '').trim()) {
    throw new ErroPedido(400, 'MOTIVO', 'Diga o motivo do cancelamento (o cliente vê).', { campo: 'resposta' });
  }
  const params = [pedidoId, de, regra.para];
  const sets = ['status = $3', 'updated_at = NOW()'];
  const filtros = ['id = $1', 'status = ANY($2)'];
  if (ator === 'cliente') { params.push(associadoId); filtros.push(`associado_id = $${params.length}`); }
  if (ator === 'loja') { params.push(parceiroId); filtros.push(`parceiro_id = $${params.length}`); }

  if (acao === 'aceitar') {
    // Depois do prazo a loja não aceita mais, mesmo que a rotina ainda não
    // tenha passado — o cliente pode já estar procurando outra loja.
    filtros.push(`created_at > NOW() - make_interval(mins => ${PRAZO_RESPOSTA_MIN})`);
    sets.push('aceito_em = NOW()');
    // Pix da loja copiado no aceite (mudar a chave depois não muda o pedido)
    sets.push(`pix_chave = (SELECT pix_chave FROM sindicato_parceiros WHERE id = loja_pedidos.parceiro_id)`,
      `pix_tipo = (SELECT pix_tipo FROM sindicato_parceiros WHERE id = loja_pedidos.parceiro_id)`,
      `pix_nome_recebedor = (SELECT pix_nome_recebedor FROM sindicato_parceiros WHERE id = loja_pedidos.parceiro_id)`);
  }
  if (regra.para === 'pago_saiu') sets.push('pago_saiu_em = NOW()');
  if (regra.para === 'entregue') sets.push('entregue_em = NOW()');
  if (['entregue', 'recusado', 'cancelado', 'expirado'].includes(regra.para)) {
    sets.push('encerrado_em = NOW()');
    params.push(ator); sets.push(`encerrado_por = $${params.length}`);
  }
  if (resposta !== null && resposta !== undefined) {
    params.push(String(resposta).trim().slice(0, 500) || null); sets.push(`resposta = $${params.length}`);
  }

  const devolveVaga = ['recusado', 'expirado', 'cancelado'].includes(regra.para);
  const pedido = await db.transacao(async (client) => {
    const r = await client.query(`UPDATE loja_pedidos SET ${sets.join(', ')} WHERE ${filtros.join(' AND ')} RETURNING *`, params);
    if (r.rows[0] && devolveVaga) {
      // Devolve a vaga reservada das promoções do pedido (1 por pedido).
      await client.query(
        `UPDATE sindicato_parceiro_promocoes SET usos_atuais = GREATEST(usos_atuais - 1, 0)
         WHERE id IN (SELECT DISTINCT promocao_id FROM loja_pedido_itens WHERE pedido_id = $1 AND promocao_id IS NOT NULL)`,
        [pedidoId]
      );
    }
    return r.rows[0] || null;
  });
  // Depois do COMMIT: aviso pro cliente (só nas mudanças que avisam).
  if (pedido) return { pedido, aviso: await pedidoAvisos.avisarMudanca(pedido) };

  const atual = (await db.query('SELECT status, associado_id, parceiro_id, created_at FROM loja_pedidos WHERE id = $1', [pedidoId])).rows[0];
  const dono = atual && (ator === 'sistema' || (ator === 'cliente' && atual.associado_id === associadoId) || (ator === 'loja' && atual.parceiro_id === parceiroId));
  if (!dono) throw new ErroPedido(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');
  if (acao === 'aceitar' && atual.status === 'enviado') {
    throw new ErroPedido(409, 'PRAZO_ESGOTADO', `Passaram os ${PRAZO_RESPOSTA_MIN} minutos para aceitar este pedido.`);
  }
  if (ator === 'loja' && acao === 'cancelar' && atual.status === 'pago_saiu') {
    throw new ErroPedido(409, 'CONFIRME_CANCELAR_PAGO', 'Você já confirmou o Pix deste pedido. Confirme o cancelamento e combine a devolução com o cliente.', { status: atual.status });
  }
  if (ator === 'cliente' && acao === 'cancelar') {
    throw new ErroPedido(409, 'NAO_PODE_CANCELAR', 'A loja já aceitou o pedido. Para cancelar, chame a loja no WhatsApp.', { status: atual.status });
  }
  throw new ErroPedido(409, 'STATUS_MUDOU', 'Esse pedido já mudou de situação. Atualize a tela.', { status: atual.status });
}

module.exports = {
  ErroPedido, edicaoFechaMesDeHoje, carregarLoja, motivoLojaNaoVende, modosDisponiveis, taxaEntrega, resumoLoja, whatsappDaLoja,
  resolverItem, disponibilidade, lojasVendendo, cotar, criarPedido, transicionar, gerarTokenLoja,
};
