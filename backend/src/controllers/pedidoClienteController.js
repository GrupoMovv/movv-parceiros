const db = require('../config/database');
const pedidoLoja = require('../services/pedidoLoja');
const { rotuloStatus } = require('../config/pedidos');
const { ipCliente } = require('../utils/ipCliente');
const pedidoAvisos = require('../services/pedidoAvisos');
const { linkWhatsapp, manualClienteParaLoja } = require('../services/pedidoMensagens');
const { copiaEColaDoPedido } = require('../utils/pixBrCode');

// Pedido pelo site — lado do CLIENTE (/api/public/pedidos, sessão do /meu).
// Regras e preço em services/pedidoLoja.js.

function responderErro(res, err, padrao) {
  if (err instanceof pedidoLoja.ErroPedido) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
  }
  console.error(err);
  return res.status(500).json({ error: padrao });
}

// O que o cliente vê do pedido. Nunca o token_loja. Chave Pix só depois
// do aceite (antes disso a loja ainda pode recusar).
async function viewCliente(pedido) {
  const itens = (await db.query(
    `SELECT id, origem, produto_id, promocao_id, fecha_mes_produto_id, beer_produto_id, nome, foto_url,
            tipo_preco, preco_unitario, preco_cheio, quantidade, subtotal
     FROM loja_pedido_itens WHERE pedido_id = $1 ORDER BY id`,
    [pedido.id]
  )).rows;
  const loja = (await db.query(
    `SELECT pa.nome, pa.slug, pa.cidade, CASE WHEN $2 = 'beer' THEN be.whatsapp ELSE pa.whatsapp END AS whatsapp
     FROM sindicato_parceiros pa LEFT JOIN beer_estabelecimentos be ON be.parceiro_id = pa.id
     WHERE pa.id = $1`,
    [pedido.parceiro_id, pedido.catalogo]
  )).rows[0] || {};
  const mostraPix = ['aceito', 'pago_saiu'].includes(pedido.status);
  // Z-API não avisou a loja: botão manual pro cliente, só com o número do
  // pedido (o link com token da loja NUNCA aparece pro cliente).
  const avisoFalhou = pedido.status === 'enviado' && await pedidoAvisos.avisoLojaFalhou(pedido.id);
  const { token_loja: _t, associado_id: _a, ...p } = pedido; // eslint-disable-line no-unused-vars
  return {
    ...p,
    pix_chave: mostraPix ? p.pix_chave : null,
    pix_tipo: mostraPix ? p.pix_tipo : null,
    pix_nome_recebedor: mostraPix ? p.pix_nome_recebedor : null,
    // QR e copia e cola com o valor: só enquanto falta pagar
    pix_copia_e_cola: p.status === 'aceito' && p.pix_chave
      ? copiaEColaDoPedido(p, loja)
      : null,
    status_texto: rotuloStatus(p.status, p.modo_recebimento),
    loja: { nome: loja.nome, slug: loja.slug, whatsapp: loja.whatsapp || null },
    aviso_loja_falhou: avisoFalhou,
    link_manual_loja: avisoFalhou && loja.whatsapp ? linkWhatsapp(loja.whatsapp, manualClienteParaLoja(pedido)) : null,
    itens,
  };
}

// GET /disponibilidade?tipo=produto|promocao|fecha_mes|beer&id=N — botão Comprar
async function disponibilidade(req, res) {
  try {
    const r = await pedidoLoja.disponibilidade(
      { tipo: req.query.tipo, id: req.query.id },
      { associado: req.painelAssociado || null, qa: req.modoQa }
    );
    return res.json(r);
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos verificar agora.');
  }
}

// GET /lojas?beer=1,2&geral=3 — cards: quais lojas vendem pelo site agora
async function lojas(req, res) {
  try {
    const lista = v => String(v || '').split(',').filter(Boolean);
    const [beer, geral] = await Promise.all([
      pedidoLoja.lojasVendendo('beer', lista(req.query.beer), { qa: req.modoQa }),
      pedidoLoja.lojasVendendo('geral', lista(req.query.geral), { qa: req.modoQa }),
    ]);
    return res.json({ beer, geral });
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos verificar agora.');
  }
}

// POST /cotacao — resumo com preço do servidor (Finalizar pedido)
async function cotacao(req, res) {
  try {
    const { resumo } = await pedidoLoja.cotar(req.painelAssociado, req.body, { qa: req.modoQa });
    return res.json(resumo);
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos calcular o pedido agora.');
  }
}

// POST / — envia o pedido
async function criar(req, res) {
  try {
    const { pedido } = await pedidoLoja.criarPedido(req.painelAssociado, req.body, {
      qa: req.modoQa, ip: ipCliente(req), userAgent: req.headers['user-agent'],
    });
    return res.status(201).json(await viewCliente(pedido));
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos enviar o pedido agora. Tente de novo.');
  }
}

// GET / — meus pedidos (mais recentes primeiro)
async function listar(req, res) {
  try {
    const r = await db.query(
      `SELECT p.*, pa.nome AS loja_nome,
              (SELECT COUNT(*)::int FROM loja_pedido_itens i WHERE i.pedido_id = p.id) AS qtd_itens
       FROM loja_pedidos p JOIN sindicato_parceiros pa ON pa.id = p.parceiro_id
       WHERE p.associado_id = $1 ORDER BY p.created_at DESC LIMIT 50`,
      [req.painelAssociado.id]
    );
    return res.json({
      pedidos: r.rows.map(({ token_loja: _t, pix_chave: _c, pix_tipo: _pt, pix_nome_recebedor: _n, ...p }) => ({ // eslint-disable-line no-unused-vars
        ...p, status_texto: rotuloStatus(p.status, p.modo_recebimento),
      })),
    });
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos carregar seus pedidos.');
  }
}

async function buscarDoCliente(id, associadoId) {
  if (!/^\d+$/.test(String(id))) return null;
  return (await db.query('SELECT * FROM loja_pedidos WHERE id = $1 AND associado_id = $2', [id, associadoId])).rows[0] || null;
}

// GET /:id
async function detalhe(req, res) {
  try {
    const p = await buscarDoCliente(req.params.id, req.painelAssociado.id);
    if (!p) return res.status(404).json({ error: 'Pedido não encontrado.' });
    return res.json(await viewCliente(p));
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos carregar o pedido.');
  }
}

// POST /:id/cancelar (só enquanto 'enviado') e /:id/recebi (depois de 'pago_saiu')
function acao(nome) {
  return async (req, res) => {
    try {
      if (!/^\d+$/.test(String(req.params.id))) return res.status(404).json({ error: 'Pedido não encontrado.' });
      const { pedido } = await pedidoLoja.transicionar(Number(req.params.id), 'cliente', nome, { associadoId: req.painelAssociado.id });
      return res.json(await viewCliente(pedido));
    } catch (err) {
      return responderErro(res, err, 'Não conseguimos atualizar o pedido agora.');
    }
  };
}

// GET /enderecos-recentes — sugestão no Finalizar pedido: os últimos
// endereços diferentes usados em pedidos (sem tabela de endereços).
async function enderecosRecentes(req, res) {
  try {
    const r = await db.query(
      `SELECT cep, endereco, numero, complemento, bairro, cidade, estado, referencia, MAX(created_at) AS usado_em
       FROM loja_pedidos WHERE associado_id = $1 AND modo_recebimento = 'entrega'
       GROUP BY cep, endereco, numero, complemento, bairro, cidade, estado, referencia
       ORDER BY usado_em DESC LIMIT 3`,
      [req.painelAssociado.id]
    );
    return res.json({ enderecos: r.rows.map(({ usado_em: _u, ...e }) => e) }); // eslint-disable-line no-unused-vars
  } catch (err) {
    return responderErro(res, err, 'Não conseguimos carregar seus endereços.');
  }
}

module.exports = {
  disponibilidade, lojas, cotacao, criar, listar, detalhe, enderecosRecentes,
  cancelar: acao('cancelar'), recebi: acao('recebi'), viewCliente,
};
