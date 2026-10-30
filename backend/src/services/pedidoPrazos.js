const db = require('../config/database');
const pedidoLoja = require('./pedidoLoja');
const pedidoAvisos = require('./pedidoAvisos');
const msg = require('./pedidoMensagens');
const {
  PRAZO_RESPOSTA_MIN, PRAZO_PAGO_MIN, LEMBRETE_PIX_MIN, PRAZO_ENTREGUE_ENTREGA_MIN, PRAZO_ENTREGUE_RETIRADA_MIN,
} = require('../config/pedidos');

// Prazos do pedido pelo site (parte 9). Roda pelo timer do próprio servidor
// (a cada minuto, server.js) e pela rota /api/interno/pedidos/prazos (reserva
// para um Cron do Render). Pode rodar em dobro sem problema: cada mudança é
// um UPDATE condicionado ao status (transicionar) e cada aviso é registrado
// uma vez só (loja_pedido_avisos, UNIQUE).
//   enviado sem resposta em 10 min          -> expirado  (avisa o cliente)
//   aceito sem "pago" há 30 min             -> UM lembrete pra loja conferir o Pix
//   aceito sem "pago" em 2h                 -> cancelado (avisa o cliente)
//   pago_saiu há 3h (entrega)/12h (retirada) -> entregue (sem aviso)
const REGRAS = [
  {
    acao: 'expirar',
    sql: `status = 'enviado' AND created_at <= NOW() - make_interval(mins => ${PRAZO_RESPOSTA_MIN})`,
  },
  {
    acao: 'cancelar_sem_pagamento',
    sql: `status = 'aceito' AND aceito_em <= NOW() - make_interval(mins => ${PRAZO_PAGO_MIN})`,
  },
  {
    acao: 'fechar_entregue',
    sql: `status = 'pago_saiu' AND pago_saiu_em <= NOW() - make_interval(mins =>
            CASE WHEN modo_recebimento = 'retirada' THEN ${PRAZO_ENTREGUE_RETIRADA_MIN} ELSE ${PRAZO_ENTREGUE_ENTREGA_MIN} END)`,
  },
];
const LOTE = 50;
const EXPIRADOS_PARA_PAUSAR = 2;

// A3: pedido expirou → olha os últimos pedidos da loja que dependiam da
// resposta dela. Conta: expirado (não respondeu), recusado e os que passaram
// pelo aceite (aceito_em, inclusive o automático). Não conta: o que ainda
// espera e o que o cliente cancelou antes da loja responder. Se os 2 últimos
// expiraram, pausa os pedidos pelo site (a mesma pausa do botão do painel)
// e avisa a loja nos dois WhatsApps. Pausa uma vez: se já estava pausada,
// nada muda. Depois que a loja volta a receber, a conta recomeça (só pedidos
// feitos depois de pedidos_reativados_em).
async function pausarSeExpirouSeguidos(pedido) {
  const ultimos = (await db.query(
    `SELECT p.status FROM loja_pedidos p JOIN sindicato_parceiros pa ON pa.id = p.parceiro_id
     WHERE p.parceiro_id = $1 AND (p.status IN ('expirado', 'recusado') OR p.aceito_em IS NOT NULL)
       AND (pa.pedidos_reativados_em IS NULL OR p.created_at > pa.pedidos_reativados_em)
     ORDER BY p.created_at DESC, p.id DESC LIMIT ${EXPIRADOS_PARA_PAUSAR}`,
    [pedido.parceiro_id]
  )).rows;
  if (ultimos.length < EXPIRADOS_PARA_PAUSAR || ultimos.some(p => p.status !== 'expirado')) return false;
  const pausou = await db.query(
    `UPDATE sindicato_parceiros SET pedidos_pausados = true, pedidos_pausa_motivo = 'expirados', pedidos_pausados_em = NOW(), updated_at = NOW()
     WHERE id = $1 AND pedidos_site_ativo AND NOT pedidos_pausados RETURNING id`,
    [pedido.parceiro_id]
  );
  if (!pausou.rows[0]) return false;
  const loja = await pedidoAvisos.dadosLoja(pedido);
  await pedidoAvisos.avisarLoja(pedido.id, 'pausa', loja, msg.pausaExpiradosLoja());
  return true;
}

async function rodarPrazos() {
  const resultado = { lembrete_pix: 0, pausadas: 0 };
  // Lembrete antes dos prazos: quem já passou das 2h é cancelado, não lembrado.
  const lembrar = (await db.query(
    `SELECT * FROM loja_pedidos p
     WHERE p.status = 'aceito'
       AND p.aceito_em <= NOW() - make_interval(mins => ${LEMBRETE_PIX_MIN})
       AND p.aceito_em > NOW() - make_interval(mins => ${PRAZO_PAGO_MIN})
       AND NOT EXISTS (SELECT 1 FROM loja_pedido_avisos a WHERE a.pedido_id = p.id AND a.tipo = 'lembrete_pix' AND a.destino = 'loja')
     ORDER BY p.id LIMIT ${LOTE}`
  )).rows;
  for (const pedido of lembrar) {
    try {
      if ((await pedidoAvisos.lembrarPixLoja(pedido)) !== null) resultado.lembrete_pix++;
    } catch (err) {
      console.error(`[prazos pedidos] lembrete #${pedido.id} falhou:`, err.message);
    }
  }
  for (const { acao, sql } of REGRAS) {
    const ids = (await db.query(`SELECT id FROM loja_pedidos WHERE ${sql} ORDER BY id LIMIT ${LOTE}`)).rows.map(r => r.id);
    let feitos = 0;
    for (const id of ids) {
      try {
        const { pedido } = await pedidoLoja.transicionar(id, 'sistema', acao);
        feitos++;
        if (acao === 'expirar') {
          try {
            if (await pausarSeExpirouSeguidos(pedido)) resultado.pausadas++;
          } catch (err) {
            console.error(`[prazos pedidos] pausa da loja do #${id} falhou:`, err.message);
          }
        }
      } catch (err) {
        // A loja ou o cliente mexeu no pedido no meio do caminho: fica como está.
        if (!(err instanceof pedidoLoja.ErroPedido)) console.error(`[prazos pedidos] ${acao} #${id} falhou:`, err.message);
      }
    }
    resultado[acao] = feitos;
  }
  return resultado;
}

// Timer dentro do processo (Render Starter fica sempre ligado). Uma rodada
// por vez: se uma demorar mais que o intervalo, a próxima espera.
function iniciarTimer(intervaloMs = 60 * 1000) {
  let rodando = false;
  const passo = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await rodarPrazos();
      if (Object.values(r).some(n => n > 0)) console.log('[prazos pedidos]', JSON.stringify(r));
    } catch (err) {
      console.error('[prazos pedidos] rodada falhou:', err.message);
    } finally {
      rodando = false;
    }
  };
  // Linha fixa nos Logs do Render: confirma que a rotina subiu com o servidor.
  console.log(`[prazos pedidos] timer ligado (a cada ${Math.round(intervaloMs / 1000)}s)`);
  const t = setInterval(passo, intervaloMs);
  t.unref?.();
  setTimeout(passo, 15 * 1000).unref?.();
  return t;
}

module.exports = { rodarPrazos, iniciarTimer, pausarSeExpirouSeguidos };
