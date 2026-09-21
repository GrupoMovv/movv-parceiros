const { WebhookSignatureValidator, InvalidWebhookSignatureError } = require('mercadopago');
const db = require('../config/database');
const mp = require('../config/mercadopago');
const svc = require('../services/assinaturaService');

// POST /api/webhook/mercadopago — notificações do MP (configurar a URL no
// painel do MP -> Webhooks, eventos "Pagamentos", "Planos e assinaturas"
// (subscription_preapproval) e "Pagamentos recorrentes"
// (subscription_authorized_payment); o painel gera o MP_WEBHOOK_SECRET).
//
// Segurança:
// - toda notificação é registrada em sindicato_mp_eventos (válida ou não)
// - assinatura HMAC (x-signature) validada pelo validador oficial do SDK
//   (comparação em tempo constante); sem segredo configurado = recusa tudo
// - o corpo NUNCA é usado como verdade: o pagamento é reconsultado na API
//   do MP e só então processado (processarPagamentoMp é idempotente) —
//   por isso não há janela de tempo contra replay: repetir uma notificação
//   só faz o servidor reconsultar o MP de novo
//
// Resposta: 200 quando registrou/processou (ou é algo que ignoramos de
// propósito); 401 assinatura inválida; 5xx em erro nosso -> o MP reenvia
// depois, o que é o comportamento desejado.

function header(req, nome) {
  const v = req.headers[nome];
  return Array.isArray(v) ? v[0] : v;
}

async function registrarEvento(dados) {
  try {
    const r = await db.query(
      `INSERT INTO sindicato_mp_eventos (ambiente, tipo, acao, recurso_id, notificacao_id, x_request_id, assinatura_valida, payload, resultado, erro, processado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [mp.AMBIENTE, dados.tipo, dados.acao, dados.recursoId, dados.notificacaoId, dados.xRequestId, dados.assinaturaValida,
        JSON.stringify(dados.payload || null), dados.resultado, dados.erro || null, dados.processado ? new Date() : null]
    );
    return r.rows[0].id;
  } catch (err) {
    console.error('[webhook MP] não conseguiu registrar evento:', err.message);
    return null;
  }
}

async function atualizarEvento(id, resultado, erro) {
  if (!id) return;
  await db.query('UPDATE sindicato_mp_eventos SET resultado = $1, erro = $2, processado_em = NOW() WHERE id = $3', [resultado, erro || null, id])
    .catch(err => console.error('[webhook MP] não atualizou evento:', err.message));
}

// Cada tipo de notificação reconsulta o recurso no MP e processa.
// (Nomes antigos "preapproval"/"authorized_payment" também aceitos.)
const HANDLERS = {
  payment: async id => svc.processarPagamentoMp(await svc.buscarPagamentoMp(id)),
  subscription_preapproval: id => svc.sincronizarPreapproval(id),
  preapproval: id => svc.sincronizarPreapproval(id),
  subscription_authorized_payment: id => svc.processarCobrancaAutorizada(id),
  authorized_payment: id => svc.processarCobrancaAutorizada(id),
};

async function receber(req, res) {
  const body = req.body || {};
  const tipo = String(req.query.type || req.query.topic || body.type || body.topic || '') || null;
  const dataId = String(req.query['data.id'] || body.data?.id || req.query.id || '') || null;
  const xRequestId = header(req, 'x-request-id') || null;
  const base = {
    tipo, acao: body.action || null, recursoId: dataId, notificacaoId: body.id ? String(body.id) : null,
    xRequestId, payload: { query: req.query, body },
  };

  if (!mp.WEBHOOK_SECRET) {
    await registrarEvento({ ...base, assinaturaValida: false, resultado: 'sem_segredo' });
    console.error('[webhook MP] MP_WEBHOOK_SECRET não configurado — notificação recusada (o MP vai reenviar).');
    return res.status(503).json({ error: 'webhook não configurado' });
  }

  try {
    // O MP assina usando o data.id da QUERY STRING — é o que o validador espera.
    WebhookSignatureValidator.validate({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId: req.query['data.id'] ?? dataId,
      secret: mp.WEBHOOK_SECRET,
    });
  } catch (err) {
    const motivo = err instanceof InvalidWebhookSignatureError ? err.reason : err.message;
    await registrarEvento({ ...base, assinaturaValida: false, resultado: 'assinatura_invalida', erro: motivo });
    console.warn('[webhook MP] assinatura inválida:', motivo, { xRequestId, tipo, dataId });
    return res.status(401).json({ error: 'assinatura inválida' });
  }

  const eventoId = await registrarEvento({ ...base, assinaturaValida: true, resultado: 'recebido' });

  try {
    const tratar = HANDLERS[tipo];
    if (!tratar || !dataId) {
      await atualizarEvento(eventoId, 'ignorado', `tipo ${tipo} não tratado`);
      return res.status(200).json({ ok: true, ignorado: true });
    }
    if (!mp.client) {
      await atualizarEvento(eventoId, 'erro', 'credenciais do MP ausentes');
      return res.status(503).json({ error: 'credenciais ausentes' });
    }

    const r = await tratar(dataId);
    await atualizarEvento(eventoId, r.resultado, r.motivo);
    console.log('[webhook MP]', tipo, dataId, '->', r.resultado, r.status || '', r.motivo || '');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook MP] erro processando', tipo, dataId, err?.message);
    await atualizarEvento(eventoId, 'erro', String(err?.message || err).slice(0, 500));
    return res.status(500).json({ error: 'erro ao processar' });
  }
}

module.exports = { receber };
