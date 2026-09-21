const svc = require('../services/assinaturaService');

// Endpoints do parceiro logado pra assinatura do plano (Mercado Pago).
// Regra de negócio fica toda em services/assinaturaService.js.

function responderErro(res, err, contexto) {
  if (err instanceof svc.ErroAssinatura) {
    return res.status(err.status).json({ error: err.message, codigo: err.codigo, ...err.extra });
  }
  console.error(`[parceiroAssinatura.${contexto}]`, err);
  return res.status(500).json({ error: 'Erro ao processar assinatura' });
}

// GET /parceiro/assinatura/opcoes — preços que ESTE parceiro paga
// (sindicalização conta), public key do MP pro front, se está ligado.
async function opcoes(req, res) {
  try {
    return res.json(await svc.opcoesDoParceiro(req.parceiro.id));
  } catch (err) {
    return responderErro(res, err, 'opcoes');
  }
}

// GET /parceiro/assinatura/minha
async function minha(req, res) {
  try {
    return res.json(await svc.minhaAssinatura(req.parceiro.id));
  } catch (err) {
    return responderErro(res, err, 'minha');
  }
}

// POST /parceiro/assinatura/criar-pix  { plano }
async function criarPix(req, res) {
  try {
    const r = await svc.iniciarAssinaturaPix({
      parceiroId: req.parceiro.id,
      email: req.parceiroUsuario.email,
      plano: String(req.body?.plano || ''),
    });
    console.log('[assinatura] PIX', r.reaproveitado ? 'reaproveitado' : 'criado', { parceiro: req.parceiro.id, assinatura: r.assinatura_id, pagamento: r.pagamento_id, plano: r.plano, valor: r.valor });
    return res.status(r.reaproveitado ? 200 : 201).json(r);
  } catch (err) {
    return responderErro(res, err, 'criarPix');
  }
}

// POST /parceiro/assinatura/pix/renovar
async function renovarPix(req, res) {
  try {
    const r = await svc.renovarPix({ parceiroId: req.parceiro.id, email: req.parceiroUsuario.email });
    console.log('[assinatura] PIX renovação', r.reaproveitado ? 'reaproveitado' : 'criado', { parceiro: req.parceiro.id, assinatura: r.assinatura_id, pagamento: r.pagamento_id });
    return res.status(r.reaproveitado ? 200 : 201).json(r);
  } catch (err) {
    return responderErro(res, err, 'renovarPix');
  }
}

// POST /parceiro/assinatura/criar-cartao-recorrente
//   { plano, card_token, payer_email, payment_method_id?, ultimos4? }
// card_token vem dos Bricks do MP (cartão tokenizado no navegador — número
// e CVV nunca chegam aqui).
async function criarCartaoRecorrente(req, res) {
  try {
    const b = req.body || {};
    const r = await svc.iniciarAssinaturaCartao({
      parceiroId: req.parceiro.id,
      plano: String(b.plano || ''),
      cardToken: b.card_token,
      payerEmail: b.payer_email || req.parceiroUsuario.email,
      bandeira: b.payment_method_id,
      final4: b.ultimos4,
    });
    console.log('[assinatura] cartão recorrente criado', { parceiro: req.parceiro.id, assinatura: r.assinatura_id, plano: r.plano, trial: r.trial, valor: r.valor });
    return res.status(201).json(r);
  } catch (err) {
    return responderErro(res, err, 'criarCartaoRecorrente');
  }
}

// POST /parceiro/assinatura/cancelar
async function cancelar(req, res) {
  try {
    const r = await svc.cancelarAssinatura({ parceiroId: req.parceiro.id });
    console.log('[assinatura] cancelada', { parceiro: req.parceiro.id, assinatura: r.assinatura_id, acesso_ate: r.acesso_ate });
    return res.json(r);
  } catch (err) {
    return responderErro(res, err, 'cancelar');
  }
}

// GET /parceiro/assinatura/pagamentos/:id/status — polling do modal do QR.
async function statusPagamento(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Pagamento inválido' });
    return res.json(await svc.sincronizarPagamento({ parceiroId: req.parceiro.id, pagamentoId: id }));
  } catch (err) {
    return responderErro(res, err, 'statusPagamento');
  }
}

module.exports = { opcoes, minha, criarPix, renovarPix, statusPagamento, criarCartaoRecorrente, cancelar };
