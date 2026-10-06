const db = require('../config/database');
const { sendWhatsAppMessage } = require('./zapApiService');
const msg = require('./pedidoMensagens');

// Avisos de WhatsApp do pedido pelo site (Z-API). Nunca travam nem derrubam
// o pedido: o banco é a fonte da verdade. Cada aviso é gravado UMA vez em
// loja_pedido_avisos (UNIQUE pedido/tipo/destino) — rotina e tela ao mesmo
// tempo não mandam duplicado. enviado=false = Z-API falhou: a tela oferece
// o botão manual.

// Espera no máximo 6s (a Z-API tem timeout de 20s), igual aos avisos do Pet.
async function enviar(numero, texto) {
  if (!numero) return false;
  try {
    const r = await Promise.race([
      sendWhatsAppMessage(numero, texto),
      new Promise(resolve => setTimeout(() => resolve({ success: false }), 6000)),
    ]);
    return Boolean(r?.success);
  } catch (err) {
    console.error('[pedidoAvisos]', err.message);
    return false;
  }
}

// true/false = mandou/falhou agora; null = já tinha sido tratado antes.
async function registrarEEnviar(pedidoId, tipo, destino, numero, texto) {
  const novo = await db.query(
    `INSERT INTO loja_pedido_avisos (pedido_id, tipo, destino, enviado) VALUES ($1, $2, $3, false)
     ON CONFLICT (pedido_id, tipo, destino) DO NOTHING RETURNING id`,
    [pedidoId, tipo, destino]
  );
  if (!novo.rows[0]) return null;
  const ok = await enviar(numero, texto);
  if (ok) await db.query('UPDATE loja_pedido_avisos SET enviado = true WHERE id = $1', [novo.rows[0].id]);
  return ok;
}

// Nome, WhatsApp de aviso (Beer: o do estabelecimento) e endereço da loja.
async function dadosLoja(pedido) {
  const r = await db.query(
    `SELECT pa.nome, pa.endereco, pa.bairro, pa.whatsapp, be.whatsapp AS whatsapp_beer
     FROM sindicato_parceiros pa LEFT JOIN beer_estabelecimentos be ON be.parceiro_id = pa.id
     WHERE pa.id = $1`,
    [pedido.parceiro_id]
  );
  const l = r.rows[0] || {};
  return {
    nome: l.nome || 'Loja',
    whatsapp: String((pedido.catalogo === 'beer' ? l.whatsapp_beer : l.whatsapp) || '').replace(/\D/g, '') || null,
    endereco: [l.endereco, l.bairro].filter(Boolean).join(' — ') || null,
  };
}

// Aceito: a mensagem completa e, logo em seguida, a chave Pix sozinha
// (só se a primeira chegou — sem ela a chave solta não faz sentido).
async function avisarAceito(pedido, texto) {
  const ok = await registrarEEnviar(pedido.id, 'aceito', 'cliente', pedido.cliente_whatsapp, texto);
  if (ok && pedido.pix_chave) await registrarEEnviar(pedido.id, 'aceito_pix', 'cliente', pedido.cliente_whatsapp, msg.chavePixSozinha(pedido));
  return ok;
}

async function itensDo(pedidoId) {
  return (await db.query('SELECT nome, quantidade, subtotal FROM loja_pedido_itens WHERE pedido_id = $1 ORDER BY id', [pedidoId])).rows;
}

// Pedido criado → loja ("novo", com o link). Aceite automático: o cliente
// já recebe o aceito com o Pix.
async function avisarNovoPedido(pedido) {
  const loja = await dadosLoja(pedido);
  const lojaAvisada = await registrarEEnviar(pedido.id, 'novo', 'loja', loja.whatsapp, msg.novoPedidoLoja(pedido, await itensDo(pedido.id)));
  let clienteAvisado = null;
  if (pedido.status === 'aceito') {
    clienteAvisado = await avisarAceito(pedido, msg.aceitoCliente(pedido, loja.nome));
  }
  return { loja: lojaAvisada, cliente: clienteAvisado };
}

// Texto pro cliente depois de uma mudança de status (null = não avisa).
async function textoMudanca(pedido, loja) {
  if (pedido.status === 'aceito') return msg.aceitoCliente(pedido, loja.nome);
  if (pedido.status === 'recusado') return msg.recusadoCliente(pedido, loja.nome);
  if (pedido.status === 'expirado') return msg.expiradoCliente(pedido, loja.nome, loja.whatsapp);
  if (pedido.status === 'cancelado' && pedido.encerrado_por !== 'cliente') return msg.canceladoCliente(pedido, loja.nome, loja.whatsapp);
  if (pedido.status === 'pago_saiu') return msg.pagoSaiuCliente(pedido, loja.nome, loja.endereco);
  return null; // entregue, ou o próprio cliente cancelou
}

// Mudou de status → cliente. Devolve { avisado: true|false|null, texto }
// (texto pra o botão manual da loja quando o Z-API falha).
async function avisarMudanca(pedido) {
  const loja = await dadosLoja(pedido);
  const texto = await textoMudanca(pedido, loja);
  if (!texto) return { avisado: null, texto: null };
  const avisado = pedido.status === 'aceito'
    ? await avisarAceito(pedido, texto)
    : await registrarEEnviar(pedido.id, pedido.status, 'cliente', pedido.cliente_whatsapp, texto);
  return { avisado, texto };
}

// O aviso "novo" da loja falhou? (cliente ganha o botão manual, sem link)
async function avisoLojaFalhou(pedidoId) {
  const r = await db.query(`SELECT enviado FROM loja_pedido_avisos WHERE pedido_id = $1 AND tipo = 'novo' AND destino = 'loja'`, [pedidoId]);
  return r.rows[0] ? !r.rows[0].enviado : false;
}

// Aceito há 30 min sem "pago" → UM lembrete pra loja (registro 'lembrete_pix'
// impede repetir, mesmo com a rotina rodando a cada minuto).
async function lembrarPixLoja(pedido) {
  const loja = await dadosLoja(pedido);
  return registrarEEnviar(pedido.id, 'lembrete_pix', 'loja', loja.whatsapp, msg.lembretePixLoja(pedido));
}

module.exports = { enviar, registrarEEnviar, dadosLoja, avisarNovoPedido, avisarMudanca, avisoLojaFalhou, lembrarPixLoja };
