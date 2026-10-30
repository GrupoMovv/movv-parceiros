const db = require('../config/database');
const pedidoLoja = require('./pedidoLoja');
const pedidoAvisos = require('./pedidoAvisos');
const lojaPush = require('./lojaPush');
const msg = require('./pedidoMensagens');
const { copiaEColaDoComplemento } = require('../utils/pixBrCode');
const { PRAZO_RESPOSTA_MIN } = require('../config/pedidos');

const { ErroPedido, dinheiro } = pedidoLoja;

// B2: complemento ("esqueci um item") de um pedido já aceito. Caminho 1
// (Junior, 30/10/2026): só enquanto o pedido está "aceito", antes de a loja
// confirmar o Pix, para ir na mesma entrega. Sem nova taxa. A loja aceita
// ou recusa em 10 minutos; aceito, o cliente paga só o valor do complemento
// e a loja confirma esse Pix à parte. O pedido original não muda.
//   enviado → aceito → pago        (loja)
//   enviado → recusado | expirado  (loja | rotina)
//   enviado | aceito → cancelado   (cliente só no enviado; loja; pedido encerrado)

const ROTULO = {
  enviado: 'Esperando a loja', aceito: 'Aguardando o Pix', pago: 'Pago',
  recusado: 'Recusado pela loja', expirado: 'Sem resposta da loja', cancelado: 'Cancelado',
};

const TRANSICOES = {
  loja: {
    aceitar: { de: ['enviado'], para: 'aceito' },
    recusar: { de: ['enviado'], para: 'recusado' },
    pago: { de: ['aceito'], para: 'pago' },
    cancelar: { de: ['enviado', 'aceito'], para: 'cancelado' },
  },
  cliente: { cancelar: { de: ['enviado'], para: 'cancelado' } },
  sistema: { expirar: { de: ['enviado'], para: 'expirado' } },
};

// entrada: { itens, total_visto? }
async function pedirComplemento(associado, pedidoId, entrada, { qa = false } = {}) {
  const p = (await db.query('SELECT * FROM loja_pedidos WHERE id = $1 AND associado_id = $2', [pedidoId, associado.id])).rows[0];
  if (!p) throw new ErroPedido(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');
  const naoPode = (status) => {
    if (status === 'enviado') return new ErroPedido(409, 'AINDA_NAO_ACEITO', 'A loja ainda não aceitou: use "Mudar itens".', { status });
    if (status === 'pago_saiu') return new ErroPedido(409, 'JA_SAIU', 'A loja já confirmou o Pix e o pedido saiu. Para mais itens, faça um novo pedido.', { status });
    return new ErroPedido(409, 'STATUS_MUDOU', 'Esse pedido não aceita mais complemento.', { status });
  };
  if (p.status !== 'aceito') throw naoPode(p.status);
  // sem modo de recebimento: complemento não tem taxa de entrega
  const { catalogo, resumo } = await pedidoLoja.cotar(associado, { itens: entrada?.itens, modo_recebimento: null }, { qa });
  if (resumo.loja.id !== p.parceiro_id || catalogo !== p.catalogo) {
    throw new ErroPedido(400, 'OUTRA_LOJA', 'Só dá para pôr produtos da mesma loja do pedido.');
  }
  if (entrada?.total_visto != null && dinheiro(entrada.total_visto) !== resumo.subtotal) {
    throw new ErroPedido(409, 'PRECO_MUDOU', 'O preço mudou. Confira o novo valor e peça de novo.', { resumo, total_visto: dinheiro(entrada.total_visto) });
  }
  let complemento;
  try {
    complemento = await db.transacao(async (client) => {
      const travado = (await client.query('SELECT status FROM loja_pedidos WHERE id = $1 FOR UPDATE', [pedidoId])).rows[0];
      if (travado.status !== 'aceito') throw naoPode(travado.status);
      const c = (await client.query(
        `INSERT INTO loja_pedido_complementos (pedido_id, status, subtotal, total) VALUES ($1, 'enviado', $2, $2) RETURNING *`,
        [pedidoId, resumo.subtotal]
      )).rows[0];
      await pedidoLoja.reservar(client, resumo.itens);
      for (const i of resumo.itens) {
        await client.query(
          `INSERT INTO loja_pedido_complemento_itens (complemento_id, origem, produto_id, promocao_id, fecha_mes_produto_id, beer_produto_id,
             nome, foto_url, tipo_preco, preco_unitario, preco_cheio, preco_sem_clube, quantidade, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [c.id, i.origem, i.produto_id ?? null, i.promocao_id ?? null, i.fecha_mes_produto_id ?? null, i.beer_produto_id ?? null,
            String(i.nome).slice(0, 200), i.foto_url, i.tipo_preco, i.preco_unitario, i.preco_cheio, i.preco_sem_clube ?? i.preco_unitario, i.quantidade, i.subtotal]
        );
      }
      return c;
    });
  } catch (err) {
    if (err.code === '23505' && /uq_loja_pedido_complemento_aberto/.test(err.constraint || err.message)) {
      throw new ErroPedido(409, 'JA_TEM_COMPLEMENTO', 'Você já tem um complemento aberto neste pedido. Espere a loja responder.');
    }
    throw err;
  }
  await avisarLojaComplemento(p, complemento);
  return { pedido: p, complemento };
}

async function itensDoComplemento(complementoId) {
  return (await db.query(
    `SELECT nome, foto_url, tipo_preco, preco_unitario, quantidade, subtotal FROM loja_pedido_complemento_itens WHERE complemento_id = $1 ORDER BY id`,
    [complementoId]
  )).rows;
}

async function avisarLojaComplemento(p, c) {
  const loja = await pedidoAvisos.dadosLoja(p);
  await pedidoAvisos.avisarLoja(p.id, `comp${c.id}_novo`, loja, msg.complementoNovoLoja(p, c, await itensDoComplemento(c.id)));
  try {
    await lojaPush.enviarParaLoja(p.parceiro_id, {
      title: `Complemento do pedido #${p.id}`,
      body: `${msg.brl(c.total)} a mais · ${p.cliente_nome} · responda em até ${PRAZO_RESPOSTA_MIN} minutos`,
      url: `/pedido-loja/${p.token_loja}`, tag: `pedido-${p.id}`, requireInteraction: true,
    });
  } catch (err) {
    console.error('[complemento] notificação', p.id, err.message);
  }
}

// Ação no complemento aberto do pedido (ou no último aceito, para "pago").
// dono: { parceiroId } (loja), { associadoId } (cliente), nada (sistema).
async function agirComplemento(pedidoId, ator, acao, { parceiroId = null, associadoId = null, resposta = null, complementoId = null } = {}) {
  const regra = TRANSICOES[ator]?.[acao];
  if (!regra) throw new ErroPedido(400, 'ACAO_INVALIDA', 'Ação inválida.');
  const p = (await db.query('SELECT * FROM loja_pedidos WHERE id = $1', [pedidoId])).rows[0];
  const dono = p && (ator === 'sistema' || (ator === 'loja' && p.parceiro_id === parceiroId) || (ator === 'cliente' && p.associado_id === associadoId));
  if (!dono) throw new ErroPedido(404, 'NAO_ENCONTRADO', 'Pedido não encontrado.');

  const devolve = ['recusado', 'expirado', 'cancelado'].includes(regra.para);
  const c = await db.transacao(async (client) => {
    const atual = (await client.query(
      `SELECT *, created_at > NOW() - make_interval(mins => ${PRAZO_RESPOSTA_MIN}) AS no_prazo FROM loja_pedido_complementos
       WHERE pedido_id = $1 AND ($2::int IS NULL OR id = $2) AND status = ANY($3) ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [pedidoId, complementoId, regra.de]
    )).rows[0];
    if (!atual) throw new ErroPedido(409, 'COMPLEMENTO_MUDOU', 'Esse complemento já mudou de situação. Atualize a tela.');
    if (acao === 'aceitar' && !atual.no_prazo) {
      throw new ErroPedido(409, 'PRAZO_ESGOTADO', `Passaram os ${PRAZO_RESPOSTA_MIN} minutos para aceitar este complemento.`);
    }
    if (acao === 'aceitar' && p.status !== 'aceito') {
      throw new ErroPedido(409, 'STATUS_MUDOU', 'O pedido já mudou de situação. Atualize a tela.');
    }
    const sets = ['status = $2'];
    const params = [atual.id, regra.para];
    if (regra.para === 'aceito') sets.push('aceito_em = NOW()');
    if (regra.para === 'pago') sets.push('pago_em = NOW()');
    if (devolve) { sets.push('encerrado_em = NOW()'); params.push(ator); sets.push(`encerrado_por = $${params.length}`); }
    if (resposta !== null && resposta !== undefined) { params.push(String(resposta).trim().slice(0, 500) || null); sets.push(`resposta = $${params.length}`); }
    const novo = (await client.query(`UPDATE loja_pedido_complementos SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params)).rows[0];
    if (devolve) await pedidoLoja.devolverReservasComplemento(client, novo.id);
    return novo;
  });
  const aviso = await avisarClienteComplemento(p, c, ator);
  return { pedido: p, complemento: c, aviso };
}

// Cliente: aceito (com o Pix só do complemento), recusado, expirado e
// cancelado pela loja. Ele mesmo cancelando e "pago" não avisam.
async function avisarClienteComplemento(p, c, ator) {
  const loja = await pedidoAvisos.dadosLoja(p);
  let texto = null;
  if (c.status === 'aceito') texto = msg.complementoAceitoCliente(p, c, loja.nome);
  else if (['recusado', 'expirado'].includes(c.status) || (c.status === 'cancelado' && ator === 'loja')) texto = msg.complementoEncerradoCliente(p, c, loja.nome);
  if (!texto) return { avisado: null, texto: null };
  const avisado = await pedidoAvisos.registrarEEnviar(p.id, `comp${c.id}_${c.status}`, 'cliente', p.cliente_whatsapp, texto);
  if (avisado && c.status === 'aceito') {
    const codigo = copiaEColaDoComplemento(p, c, loja);
    if (codigo) await pedidoAvisos.registrarEEnviar(p.id, `comp${c.id}_pix`, 'cliente', p.cliente_whatsapp, codigo);
  }
  return { avisado, texto };
}

// Os complementos do pedido, para as telas. paraLoja: com as ações; para o
// cliente: o Pix copia e cola do complemento aceito.
async function complementosDoPedido(p, { paraLoja = false, loja = {} } = {}) {
  const lista = (await db.query(
    `SELECT *, created_at > NOW() - make_interval(mins => ${PRAZO_RESPOSTA_MIN}) AS no_prazo FROM loja_pedido_complementos WHERE pedido_id = $1 ORDER BY id`,
    [p.id]
  )).rows;
  const saida = [];
  for (const c of lista) {
    const itens = await itensDoComplemento(c.id);
    const base = {
      id: c.id, status: c.status, status_texto: ROTULO[c.status], total: c.total, itens,
      created_at: c.created_at, aceito_em: c.aceito_em, pago_em: c.pago_em, resposta: c.resposta,
      responder_ate: c.status === 'enviado' ? new Date(new Date(c.created_at).getTime() + PRAZO_RESPOSTA_MIN * 60000) : null,
    };
    if (paraLoja) {
      base.acoes = c.status === 'enviado' ? (c.no_prazo ? ['aceitar', 'recusar'] : []) : c.status === 'aceito' ? ['pago', 'cancelar'] : [];
    } else {
      base.pix_copia_e_cola = c.status === 'aceito' ? copiaEColaDoComplemento(p, c, loja) : null;
    }
    saida.push(base);
  }
  return saida;
}

// Total geral: pedido + complementos aceitos ou pagos
function totalGeral(p, complementos) {
  return dinheiro(Number(p.total) + complementos.filter(c => ['aceito', 'pago'].includes(c.status)).reduce((s, c) => s + Number(c.total), 0));
}

module.exports = { pedirComplemento, agirComplemento, complementosDoPedido, totalGeral, ROTULO };
