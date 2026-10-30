const db = require('../config/database');
const { sendWhatsAppMessage } = require('./zapApiService');
const msg = require('./pedidoMensagens');
const { copiaEColaDoPedido } = require('../utils/pixBrCode');
const lojaPush = require('./lojaPush');
const { PRAZO_RESPOSTA_MIN } = require('../config/pedidos');

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

// Nome, WhatsApp de aviso (Beer: o do estabelecimento), o segundo WhatsApp de
// avisos (A2, opcional, vale nos dois catálogos) e endereço da loja.
async function dadosLoja(pedido) {
  const r = await db.query(
    `SELECT pa.nome, pa.endereco, pa.bairro, pa.cidade, pa.whatsapp, pa.pedidos_whatsapp_extra, be.whatsapp AS whatsapp_beer
     FROM sindicato_parceiros pa LEFT JOIN beer_estabelecimentos be ON be.parceiro_id = pa.id
     WHERE pa.id = $1`,
    [pedido.parceiro_id]
  );
  const l = r.rows[0] || {};
  const whatsapp = String((pedido.catalogo === 'beer' ? l.whatsapp_beer : l.whatsapp) || '').replace(/\D/g, '') || null;
  const extra = String(l.pedidos_whatsapp_extra || '').replace(/\D/g, '') || null;
  return {
    nome: l.nome || 'Loja',
    cidade: l.cidade || null,
    whatsapp,
    whatsapp2: extra && extra !== whatsapp ? extra : null,
    endereco: [l.endereco, l.bairro].filter(Boolean).join(' — ') || null,
  };
}

// Aceito: a mensagem completa e, logo em seguida, o Pix copia e cola sozinho
// (ou a chave, se não der para gerar o código). Só se a primeira chegou —
// sem ela o código solto não faz sentido.
async function textoAceito(pedido, loja) {
  return msg.aceitoCliente({ ...pedido, economia_clube: await economiaClube(pedido) }, loja.nome, copiaEColaDoPedido(pedido, loja));
}
// Quanto o Clube tirou do pedido (itens + entrega grátis), só pra mensagem
// do cliente. Pedido de antes da b3 não tem preco_sem_clube: fica de fora.
async function economiaClube(pedido) {
  const r = await db.query(
    `SELECT COALESCE(SUM((preco_sem_clube - preco_unitario) * quantidade) FILTER (WHERE preco_sem_clube > preco_unitario), 0) AS itens
     FROM loja_pedido_itens WHERE pedido_id = $1`,
    [pedido.id]
  );
  return Math.round((Number(r.rows[0].itens) + Number(pedido.entrega_dispensada_clube || 0)) * 100) / 100;
}
async function avisarAceito(pedido, loja, texto) {
  if (texto == null) texto = await textoAceito(pedido, loja);
  const ok = await registrarEEnviar(pedido.id, 'aceito', 'cliente', pedido.cliente_whatsapp, texto);
  if (ok && pedido.pix_chave) {
    await registrarEEnviar(pedido.id, 'aceito_pix', 'cliente', pedido.cliente_whatsapp, msg.pixParaColar(pedido, copiaEColaDoPedido(pedido, loja)));
  }
  return ok;
}

// Aviso à loja: o número principal e, se houver, o segundo (destino 'loja2'),
// cada um uma vez. true se chegou em pelo menos um; null = já tratado antes.
async function avisarLoja(pedidoId, tipo, loja, texto) {
  const principal = await registrarEEnviar(pedidoId, tipo, 'loja', loja.whatsapp, texto);
  const segundo = loja.whatsapp2 ? await registrarEEnviar(pedidoId, tipo, 'loja2', loja.whatsapp2, texto) : null;
  if (principal === true || segundo === true) return true;
  return principal;
}

async function itensDo(pedidoId) {
  return (await db.query('SELECT nome, quantidade, subtotal FROM loja_pedido_itens WHERE pedido_id = $1 ORDER BY id', [pedidoId])).rows;
}

// A5: "Pedido novo #1023" no celular da loja, abrindo o link do pedido (sem
// login, com a campainha). Reforço do WhatsApp: se falhar, segue a vida.
async function notificarAparelhos(pedido) {
  try {
    await lojaPush.enviarParaLoja(pedido.parceiro_id, {
      title: `Pedido novo #${pedido.id}`,
      body: pedido.status === 'aceito'
        ? `${msg.brl(pedido.total)} · ${pedido.cliente_nome} · já aceito automaticamente`
        : `${msg.brl(pedido.total)} · ${pedido.cliente_nome} · responda em até ${PRAZO_RESPOSTA_MIN} minutos`,
      url: `/pedido-loja/${pedido.token_loja}`,
      tag: `pedido-${pedido.id}`,
      requireInteraction: true,
    });
  } catch (err) {
    console.error('[pedidoAvisos] notificação do pedido', pedido.id, err.message);
  }
}

// Pedido criado → loja ("novo", com o link). Aceite automático: o cliente
// já recebe o aceito com o Pix.
async function avisarNovoPedido(pedido) {
  const loja = await dadosLoja(pedido);
  // Equipe de vendas (e3): o vendedor que trouxe o cliente (nome na mensagem da
  // loja; aviso a ele só se a loja ligou o "avisar no WhatsApp")
  const vendedor = pedido.vendedor_id
    ? (await db.query('SELECT nome, whatsapp, avisar_whatsapp FROM loja_vendedores WHERE id = $1', [pedido.vendedor_id])).rows[0] || null
    : null;
  const lojaAvisada = await avisarLoja(pedido.id, 'novo', loja, msg.novoPedidoLoja(pedido, await itensDo(pedido.id), vendedor?.nome));
  // A5: notificação nos aparelhos da loja (só na 1ª vez: null = já avisado)
  if (lojaAvisada !== null) await notificarAparelhos(pedido);
  if (vendedor?.avisar_whatsapp) {
    await registrarEEnviar(pedido.id, 'novo', 'vendedor', vendedor.whatsapp, msg.novoPedidoVendedor(pedido, loja.nome));
  }
  let clienteAvisado = null;
  if (pedido.status === 'aceito') {
    clienteAvisado = await avisarAceito(pedido, loja);
  }
  return { loja: lojaAvisada, cliente: clienteAvisado };
}

// Texto pro cliente depois de uma mudança de status (null = não avisa).
async function textoMudanca(pedido, loja) {
  if (pedido.status === 'aceito') return textoAceito(pedido, loja);
  if (pedido.status === 'recusado') return msg.recusadoCliente(pedido, loja.nome);
  if (pedido.status === 'expirado') return msg.expiradoCliente(pedido, loja.nome, loja.whatsapp);
  if (pedido.status === 'cancelado' && pedido.encerrado_por !== 'cliente') return msg.canceladoCliente(pedido, loja.nome, loja.whatsapp);
  if (pedido.status === 'pago_saiu') return msg.pagoSaiuCliente(pedido, loja.nome, loja.endereco);
  return null; // entregue, ou o próprio cliente cancelou
}

// B1: o cliente mudou os itens → loja (WhatsApp nos dois números e o
// celular). Um aviso por mudança (tipo mudou_1, mudou_2...).
async function avisarMudancaItens(pedido) {
  const loja = await dadosLoja(pedido);
  const avisada = await avisarLoja(pedido.id, `mudou_${pedido.alteracoes}`, loja, msg.mudouPedidoLoja(pedido, await itensDo(pedido.id)));
  try {
    await lojaPush.enviarParaLoja(pedido.parceiro_id, {
      title: `Pedido #${pedido.id} mudou`,
      body: `O cliente trocou os itens. Novo total: ${msg.brl(pedido.total)}`,
      url: `/pedido-loja/${pedido.token_loja}`,
      tag: `pedido-${pedido.id}`,
      requireInteraction: true,
    });
  } catch (err) {
    console.error('[pedidoAvisos] notificação da mudança', pedido.id, err.message);
  }
  return avisada;
}

// Mudou de status → cliente. Devolve { avisado: true|false|null, texto }
// (texto pra o botão manual da loja quando o Z-API falha).
async function avisarMudanca(pedido) {
  const loja = await dadosLoja(pedido);
  const texto = await textoMudanca(pedido, loja);
  if (!texto) return { avisado: null, texto: null };
  const avisado = pedido.status === 'aceito'
    ? await avisarAceito(pedido, loja, texto)
    : await registrarEEnviar(pedido.id, pedido.status, 'cliente', pedido.cliente_whatsapp, texto);
  // O texto volta só pro botão manual da loja (Z-API falhou), que manda UMA
  // mensagem: no aceito, o formato com a chave + link do pedido (a tela tem o
  // QR e o copia e cola) — "use o código da próxima mensagem" não faria sentido.
  // Sai do celular da loja: sem a linha da economia do Clube.
  const textoManual = pedido.status === 'aceito' ? msg.aceitoCliente(pedido, loja.nome, null) : texto;
  return { avisado, texto: textoManual };
}

// O aviso "novo" da loja falhou nos dois números? (cliente ganha o botão
// manual, sem link)
async function avisoLojaFalhou(pedidoId) {
  const r = await db.query(`SELECT enviado FROM loja_pedido_avisos WHERE pedido_id = $1 AND tipo = 'novo' AND destino IN ('loja', 'loja2')`, [pedidoId]);
  return r.rows.length > 0 && !r.rows.some(a => a.enviado);
}

// Aceito há 30 min sem "pago" → UM lembrete pra loja (registro 'lembrete_pix'
// impede repetir, mesmo com a rotina rodando a cada minuto).
async function lembrarPixLoja(pedido) {
  const loja = await dadosLoja(pedido);
  return avisarLoja(pedido.id, 'lembrete_pix', loja, msg.lembretePixLoja(pedido));
}

module.exports = { enviar, registrarEEnviar, dadosLoja, avisarLoja, avisarNovoPedido, avisarMudancaItens, avisarMudanca, avisoLojaFalhou, lembrarPixLoja };
