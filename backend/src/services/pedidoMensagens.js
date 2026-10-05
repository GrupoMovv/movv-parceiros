const { PRAZO_RESPOSTA_MIN, PRAZO_PAGO_MIN } = require('../config/pedidos');

// Textos de WhatsApp do pedido pelo site. Poucas mensagens de propósito
// (Junior, 05/10: não arriscar o chip do Z-API):
//   loja:    só "novo pedido", com o link sem login
//   cliente: aceito (total + Pix), recusado, expirado, cancelado,
//            saiu para entrega / pronto para retirar. "Entregue" não avisa.
// O link com token da loja NUNCA vai em mensagem pro cliente.

const FRONT = () => (process.env.FRONTEND_URL || 'https://portal.grupomovv.com.br').replace(/\/$/, '');
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const linkLoja = token => `${FRONT()}/pedido-loja/${token}`;
const linkMeuPedido = id => `${FRONT()}/meu/pedidos/${id}`;
const linkWhatsapp = (numero, texto) => `https://api.whatsapp.com/send?phone=55${String(numero || '').replace(/\D/g, '')}${texto ? `&text=${encodeURIComponent(texto)}` : ''}`;

const ROTULO_PIX = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Celular', aleatoria: 'Chave aleatória' };
const MAX_LINHAS_ITENS = 8;

function linhasItens(itens) {
  const linhas = itens.slice(0, MAX_LINHAS_ITENS).map(i => `${i.quantidade}x ${i.nome} — ${brl(i.subtotal)}`);
  if (itens.length > MAX_LINHAS_ITENS) linhas.push(`+ ${itens.length - MAX_LINHAS_ITENS} item(ns)`);
  return linhas.join('\n');
}

function recebimento(p) {
  if (p.modo_recebimento !== 'entrega') return '🏪 Retirada na loja';
  const partes = [`${p.endereco}, ${p.numero}`, p.complemento, p.bairro].filter(Boolean).join(' — ');
  return `🛵 Entrega: ${partes}` + (p.referencia ? `\n📍 Referência: ${p.referencia}` : '');
}

// ── Loja ──────────────────────────────────────────────────────────────

function novoPedidoLoja(p, itens) {
  const cab = p.status === 'aceito'
    ? `🛒 *Novo pedido #${p.id}* — IUB MAIS+\n✅ Já aceito automaticamente. O cliente recebeu sua chave Pix.`
    : `🛒 *Novo pedido #${p.id}* — IUB MAIS+`;
  const valores = [
    linhasItens(itens),
    Number(p.valor_entrega) > 0 ? `Entrega — ${brl(p.valor_entrega)}` : null,
    `*Total: ${brl(p.total)}* (Pix direto para você)`,
  ].filter(Boolean).join('\n');
  const acao = p.status === 'aceito'
    ? `👉 Quando o Pix cair, toque em "${p.modo_recebimento === 'retirada' ? 'Pago, pode retirar' : 'Pago, saiu para entrega'}":`
    : `👉 Aceite ou recuse em até ${PRAZO_RESPOSTA_MIN} minutos:`;
  return [
    cab, '',
    `Cliente: ${p.cliente_nome}`,
    valores,
    recebimento(p),
    p.aviso_idade ? `⚠️ Bebida alcoólica: confira a idade (18+) do cliente na ${p.modo_recebimento === 'retirada' ? 'retirada' : 'entrega'}.` : null,
    '', acao, linkLoja(p.token_loja),
  ].filter(l => l !== null).join('\n');
}

function testeLoja(nomeLoja) {
  return [
    `🔔 *Teste de aviso — IUB MAIS+*`, '',
    `Olá, ${nomeLoja}! Se esta mensagem chegou, os avisos de pedido pelo site vão chegar neste WhatsApp.`, '',
    'Toque no link para conferir se ele abre:',
    `${FRONT()}/pedido-loja/teste`, '',
    'Dica: salve este número nos seus contatos como "IUB MAIS+ Pedidos". Assim os links dos próximos avisos chegam clicáveis.',
  ].join('\n');
}

// ── Cliente ───────────────────────────────────────────────────────────

function aceitoCliente(p, nomeLoja) {
  return [
    `✅ *Pedido #${p.id} aceito!* — ${nomeLoja}`, '',
    `Total: *${brl(p.total)}*`,
    'Pague no Pix da loja:',
    `${ROTULO_PIX[p.pix_tipo] || 'Chave'}: ${p.pix_chave}`,
    p.pix_nome_recebedor ? `Nome: ${p.pix_nome_recebedor}` : null, '',
    `Confira o nome antes de pagar. A loja só prepara o pedido depois de confirmar o Pix. O pagamento é direto para a loja (o IUB MAIS+ não recebe esse valor). Prazo: ${PRAZO_PAGO_MIN / 60} horas.`, '',
    `Acompanhe: ${linkMeuPedido(p.id)}`,
  ].filter(l => l !== null).join('\n');
}

// Segunda mensagem, logo depois do aceito: só a chave, pra copiar com um toque.
function chavePixSozinha(p) {
  return String(p.pix_chave || '');
}

function recusadoCliente(p, nomeLoja) {
  return [
    `❌ *Pedido #${p.id} recusado* — ${nomeLoja}`,
    p.resposta ? `Motivo: ${p.resposta}` : null, '',
    'Nenhum pagamento foi feito. Você pode tentar outra loja no IUB MAIS+.',
  ].filter(l => l !== null).join('\n');
}

function expiradoCliente(p, nomeLoja, whatsappLoja) {
  return [
    `⏱️ *Pedido #${p.id} expirou* — ${nomeLoja}`, '',
    `A loja não respondeu em ${PRAZO_RESPOSTA_MIN} minutos. Nenhum pagamento foi feito.`,
    whatsappLoja ? `Se quiser, chame a loja no WhatsApp:\n${linkWhatsapp(whatsappLoja)}` : null,
  ].filter(l => l !== null).join('\n');
}

// Cancelado pela loja ou pelo sistema (aceito sem Pix confirmado em 2h).
// Quem cancelou foi o próprio cliente: sem aviso.
function canceladoCliente(p, nomeLoja, whatsappLoja) {
  // Cancelado depois de "pago, saiu": a loja já tinha confirmado o Pix
  if (p.pago_saiu_em) {
    return [
      `🚫 *Pedido #${p.id} cancelado* — ${nomeLoja}`,
      p.resposta ? `Motivo: ${p.resposta}` : null, '',
      'A loja cancelou depois de confirmar seu Pix. Fale com ela para combinar a devolução do valor:',
      whatsappLoja ? linkWhatsapp(whatsappLoja) : null,
    ].filter(l => l !== null).join('\n');
  }
  const motivo = p.encerrado_por === 'sistema'
    ? `A loja não confirmou o pagamento em ${PRAZO_PAGO_MIN / 60} horas.`
    : (p.resposta ? `Motivo: ${p.resposta}` : 'A loja cancelou o pedido.');
  return [
    `🚫 *Pedido #${p.id} cancelado* — ${nomeLoja}`,
    motivo, '',
    whatsappLoja ? `Se você já pagou o Pix, fale com a loja:\n${linkWhatsapp(whatsappLoja)}` : 'Se você já pagou o Pix, fale com a loja.',
  ].join('\n');
}

function pagoSaiuCliente(p, nomeLoja, enderecoLoja) {
  if (p.modo_recebimento === 'retirada') {
    return [
      `🏪 *Pedido #${p.id} pronto para retirar!* — ${nomeLoja}`, '',
      'A loja confirmou seu Pix.',
      enderecoLoja ? `Endereço: ${enderecoLoja}` : null,
      p.aviso_idade ? 'Leve um documento com foto: a idade (18+) é conferida na retirada.' : null,
    ].filter(l => l !== null).join('\n');
  }
  return [
    `🛵 *Pedido #${p.id} saiu para entrega!* — ${nomeLoja}`, '',
    'A loja confirmou seu Pix.',
    p.aviso_idade ? 'Tenha um documento com foto em mãos: a idade (18+) é conferida na entrega.' : null,
  ].filter(l => l !== null).join('\n');
}

// Botão manual do cliente quando o Z-API não avisou a loja: só o número do
// pedido, NUNCA o link com token.
function manualClienteParaLoja(p) {
  return `Olá! Fiz o pedido #${p.id} pelo IUB MAIS+ (total ${brl(p.total)}). Pode conferir?`;
}

module.exports = {
  linkLoja, linkMeuPedido, linkWhatsapp, brl,
  novoPedidoLoja, testeLoja, aceitoCliente, chavePixSozinha, recusadoCliente, expiradoCliente, canceladoCliente, pagoSaiuCliente,
  manualClienteParaLoja,
};
