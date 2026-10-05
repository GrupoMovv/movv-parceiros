// Pedido pelo site (botão Comprar) — regras fixas num lugar só. Decisões do
// Junior em 05/10/2026. O DINHEIRO NÃO PASSA PELO IUB: o cliente paga no Pix
// da loja; o IUB só registra e acompanha (migration 080).

// Prazos (minutos)
const PRAZO_RESPOSTA_MIN = 10;          // enviado sem resposta -> expirado
const PRAZO_PAGO_MIN = 120;             // aceito sem "pago" -> cancelado pelo sistema
const PRAZO_ENTREGUE_ENTREGA_MIN = 180; // pago_saiu (entrega)  -> entregue sozinho
const PRAZO_ENTREGUE_RETIRADA_MIN = 720;// pago_saiu (retirada) -> entregue sozinho
const LINK_LOJA_HORAS_APOS_FIM = 24;    // link sem login vale até encerrar + 24h

// Limites por cliente: contam só pedidos AINDA NÃO PAGOS (enviado/aceito) —
// depois de "pago, saiu" o cliente já pode pedir de novo (Junior, 05/10).
// O "1 por loja" também é garantido no banco (índice único, migration 081).
const MAX_PEDIDOS_ABERTOS = 3;
const STATUS_NAO_PAGOS = ['enviado', 'aceito'];
// Item de promoção: 1 unidade por pedido (a promoção não tem limite próprio por pedido)
const MAX_QUANTIDADE_PROMOCAO = 1;
const MAX_ITENS_DIFERENTES = 30;
const MAX_QUANTIDADE_ITEM = 99;

const STATUS_ABERTOS = ['enviado', 'aceito', 'pago_saiu'];
const STATUS_ENCERRADOS = ['entregue', 'recusado', 'cancelado', 'expirado'];

// Quem pode fazer o quê, de qual status. Tudo que não está aqui = 409.
//   cliente: cancela só enquanto 'enviado'; confirma que recebeu depois de 'pago_saiu'
//   loja:    aceita/recusa 'enviado'; marca pago 'aceito'; cancela qualquer aberto
//   sistema: prazos (rotina)
const TRANSICOES = {
  cliente: {
    cancelar: { de: ['enviado'], para: 'cancelado' },
    recebi: { de: ['pago_saiu'], para: 'entregue' },
  },
  loja: {
    aceitar: { de: ['enviado'], para: 'aceito' },
    recusar: { de: ['enviado'], para: 'recusado' },
    pago_saiu: { de: ['aceito'], para: 'pago_saiu' },
    cancelar: { de: ['enviado', 'aceito', 'pago_saiu'], para: 'cancelado' },
    entregue: { de: ['pago_saiu'], para: 'entregue' },
  },
  sistema: {
    expirar: { de: ['enviado'], para: 'expirado' },
    cancelar_sem_pagamento: { de: ['aceito'], para: 'cancelado' },
    fechar_entregue: { de: ['pago_saiu'], para: 'entregue' },
  },
};

// Texto do status pro cliente/loja (retirada troca o "saiu").
function rotuloStatus(status, modo) {
  const r = {
    enviado: 'Aguardando a loja',
    aceito: 'Aceito · aguardando Pix',
    pago_saiu: modo === 'retirada' ? 'Pago, pode retirar' : 'Pago, saiu para entrega',
    entregue: modo === 'retirada' ? 'Retirado' : 'Entregue',
    recusado: 'Recusado pela loja',
    cancelado: 'Cancelado',
    expirado: 'Expirado (loja não respondeu)',
  };
  return r[status] || status;
}

// Lançamento: até o Junior ligar PEDIDOS_SITE_LIBERADO=true no Render, só a
// empresa de teste (modo QA) consegue ligar o recurso — evita loja real
// receber pedido antes dos avisos e do botão Comprar estarem no ar.
function pedidosSiteLiberado(parceiro) {
  return Boolean(parceiro?.empresa_teste) || process.env.PEDIDOS_SITE_LIBERADO === 'true';
}

module.exports = {
  pedidosSiteLiberado,
  PRAZO_RESPOSTA_MIN, PRAZO_PAGO_MIN, PRAZO_ENTREGUE_ENTREGA_MIN, PRAZO_ENTREGUE_RETIRADA_MIN, LINK_LOJA_HORAS_APOS_FIM,
  MAX_PEDIDOS_ABERTOS, STATUS_NAO_PAGOS, MAX_QUANTIDADE_PROMOCAO, MAX_ITENS_DIFERENTES, MAX_QUANTIDADE_ITEM,
  STATUS_ABERTOS, STATUS_ENCERRADOS, TRANSICOES, rotuloStatus,
};
