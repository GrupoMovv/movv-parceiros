const axios = require('axios');

const ZAPI_BASE_URL = 'https://api.z-api.io/instances';

async function sendWhatsAppMessage(toPhone, message) {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    console.warn('[Z-API] Credenciais não configuradas — mensagem não enviada');
    return { success: false, reason: 'not_configured' };
  }

  const phone = toPhone.replace(/\D/g, '');
  const url = `${ZAPI_BASE_URL}/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  try {
    const response = await axios.post(
      url,
      { phone, message },
      { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN || '' } }
    );
    return { success: true, data: response.data };
  } catch (err) {
    console.error('[Z-API] Erro ao enviar mensagem:', err.response?.data || err.message);
    return { success: false, reason: err.message };
  }
}

function buildProtocolMessage(clientName, protocol, productName, partnerName, expiresAt) {
  const expiry = new Date(expiresAt).toLocaleDateString('pt-BR');
  return (
    `Olá, *${clientName}*! 👋\n\n` +
    `Você foi indicado(a) ao *Grupo Movv* pelo(a) parceiro(a) *${partnerName}*.\n\n` +
    `📋 *Protocolo de Indicação*\n` +
    `Código: *${protocol}*\n` +
    `Produto: *${productName}*\n` +
    `Válido até: *${expiry}*\n\n` +
    `Em breve nossa equipe entrará em contato.\n` +
    `📞 Grupo Movv — Itumbiara/GO`
  );
}

module.exports = { sendWhatsAppMessage, buildProtocolMessage };
