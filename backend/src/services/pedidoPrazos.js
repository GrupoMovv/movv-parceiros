const db = require('../config/database');
const pedidoLoja = require('./pedidoLoja');
const {
  PRAZO_RESPOSTA_MIN, PRAZO_PAGO_MIN, PRAZO_ENTREGUE_ENTREGA_MIN, PRAZO_ENTREGUE_RETIRADA_MIN,
} = require('../config/pedidos');

// Prazos do pedido pelo site (parte 9). Roda pelo timer do próprio servidor
// (a cada minuto, server.js) e pela rota /api/interno/pedidos/prazos (reserva
// para um Cron do Render). Pode rodar em dobro sem problema: cada mudança é
// um UPDATE condicionado ao status (transicionar) e cada aviso é registrado
// uma vez só (loja_pedido_avisos, UNIQUE).
//   enviado sem resposta em 10 min          -> expirado  (avisa o cliente)
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

async function rodarPrazos() {
  const resultado = {};
  for (const { acao, sql } of REGRAS) {
    const ids = (await db.query(`SELECT id FROM loja_pedidos WHERE ${sql} ORDER BY id LIMIT ${LOTE}`)).rows.map(r => r.id);
    let feitos = 0;
    for (const id of ids) {
      try {
        await pedidoLoja.transicionar(id, 'sistema', acao);
        feitos++;
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

module.exports = { rodarPrazos, iniciarTimer };
