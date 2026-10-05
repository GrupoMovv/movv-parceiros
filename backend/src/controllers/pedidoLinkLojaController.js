const db = require('../config/database');
const pedidoLoja = require('../services/pedidoLoja');
const { PRAZO_RESPOSTA_MIN, LINK_LOJA_HORAS_APOS_FIM, rotuloStatus } = require('../config/pedidos');
const { linkWhatsapp } = require('../services/pedidoMensagens');

// Link do aviso de WhatsApp que abre o pedido SEM LOGIN (/pedido-loja/:token).
// O token é o segredo: 32 caracteres aleatórios, um por pedido, vale até o
// pedido encerrar + 24h. Só a loja recebe esse link (nunca o cliente).
// No máximo 2 toques: Aceitar/Recusar e "Pago, saiu".

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

async function buscarPorToken(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const r = await db.query(
    `SELECT * FROM loja_pedidos
     WHERE token_loja = $1 AND (encerrado_em IS NULL OR encerrado_em > NOW() - make_interval(hours => ${LINK_LOJA_HORAS_APOS_FIM}))`,
    [token]
  );
  return r.rows[0] || null;
}

function acoesDisponiveis(p) {
  if (p.status === 'enviado') return ['aceitar', 'recusar'];
  if (p.status === 'aceito') return ['pago_saiu', 'cancelar'];
  if (p.status === 'pago_saiu') return ['cancelar'];
  return [];
}

async function viewLoja(p) {
  const itens = (await db.query(
    `SELECT nome, foto_url, tipo_preco, preco_unitario, quantidade, subtotal FROM loja_pedido_itens WHERE pedido_id = $1 ORDER BY id`,
    [p.id]
  )).rows;
  const loja = (await db.query('SELECT nome FROM sindicato_parceiros WHERE id = $1', [p.parceiro_id])).rows[0] || {};
  return {
    id: p.id, status: p.status, status_texto: rotuloStatus(p.status, p.modo_recebimento),
    loja_nome: loja.nome, catalogo: p.catalogo, aviso_idade: p.aviso_idade,
    created_at: p.created_at, aceito_em: p.aceito_em, pago_saiu_em: p.pago_saiu_em, encerrado_em: p.encerrado_em,
    responder_ate: p.status === 'enviado' ? new Date(new Date(p.created_at).getTime() + PRAZO_RESPOSTA_MIN * 60000) : null,
    aceite_automatico: p.aceite_automatico,
    cliente: { nome: p.cliente_nome, whatsapp: p.cliente_whatsapp, link_whatsapp: linkWhatsapp(p.cliente_whatsapp) },
    modo_recebimento: p.modo_recebimento,
    endereco: p.modo_recebimento === 'entrega' ? {
      cep: p.cep, endereco: p.endereco, numero: p.numero, complemento: p.complemento,
      bairro: p.bairro, cidade: p.cidade, estado: p.estado, referencia: p.referencia,
    } : null,
    observacao: p.observacao, resposta: p.resposta,
    itens, subtotal: p.subtotal, valor_entrega: p.valor_entrega, total: p.total,
    acoes: acoesDisponiveis(p),
  };
}

// GET /api/public/pedido-loja/:token
async function ver(req, res) {
  try {
    const p = await buscarPorToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Link inválido ou vencido. Veja seus pedidos no painel do IUB MAIS+.', code: 'LINK_INVALIDO' });
    return res.json(await viewLoja(p));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos abrir o pedido agora.' });
  }
}

// POST /api/public/pedido-loja/:token/:acao  { resposta? }
async function agir(req, res) {
  try {
    const acao = req.params.acao;
    if (!['aceitar', 'recusar', 'pago_saiu', 'cancelar'].includes(acao)) return res.status(400).json({ error: 'Ação inválida.' });
    const p = await buscarPorToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Link inválido ou vencido.', code: 'LINK_INVALIDO' });
    const { pedido, aviso } = await pedidoLoja.transicionar(p.id, 'loja', acao, {
      parceiroId: p.parceiro_id, resposta: ['recusar', 'cancelar'].includes(acao) ? req.body?.resposta : undefined,
    });
    return res.json({
      ...(await viewLoja(pedido)),
      cliente_avisado: aviso?.avisado ?? null,
      // Z-API falhou: a loja manda a mesma mensagem pelo WhatsApp dela
      link_manual_cliente: aviso?.avisado === false ? linkWhatsapp(pedido.cliente_whatsapp, aviso.texto) : null,
    });
  } catch (err) {
    if (err instanceof pedidoLoja.ErroPedido) return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos atualizar o pedido agora.' });
  }
}

module.exports = { ver, agir, buscarPorToken, viewLoja };
