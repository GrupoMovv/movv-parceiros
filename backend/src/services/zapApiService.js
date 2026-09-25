const axios = require('axios');

const ZAPI_BASE_URL = 'https://api.z-api.io/instances';

function credenciais() {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) return null;
  // Client-Token = "token de segurança da conta" do painel da Z-API. Só vai
  // no header quando existe — header vazio é recusado do mesmo jeito.
  const headers = ZAPI_CLIENT_TOKEN ? { 'Client-Token': ZAPI_CLIENT_TOKEN } : {};
  return { base: `${ZAPI_BASE_URL}/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`, headers };
}

// A Z-API quer 55 + DDD + número; o banco guarda sem o 55.
function telefoneZapi(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function motivoErro(err) {
  return err.response?.data?.error || err.response?.data?.message || err.message;
}

async function sendWhatsAppMessage(toPhone, message) {
  const c = credenciais();
  if (!c) {
    console.warn('[Z-API] Credenciais não configuradas — mensagem não enviada');
    return { success: false, reason: 'not_configured' };
  }

  try {
    const response = await axios.post(
      `${c.base}/send-text`,
      { phone: telefoneZapi(toPhone), message },
      { headers: c.headers, timeout: 20000 }
    );
    return { success: true, data: response.data };
  } catch (err) {
    console.error('[Z-API] Erro ao enviar mensagem:', err.response?.data || err.message);
    return { success: false, reason: motivoErro(err) };
  }
}

// Só leitura — não manda nada. Usado pela rota de admin que confere se o
// chip está conectado.
async function statusInstancia() {
  const c = credenciais();
  if (!c) return { configurado: false, conectado: false, erro: 'ZAPI_INSTANCE_ID / ZAPI_TOKEN não configurados' };
  try {
    const r = await axios.get(`${c.base}/status`, { headers: c.headers, timeout: 15000 });
    return { configurado: true, conectado: Boolean(r.data?.connected), detalhe: r.data };
  } catch (err) {
    return { configurado: true, conectado: false, erro: motivoErro(err) };
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

module.exports = { sendWhatsAppMessage, statusInstancia, telefoneZapi, buildProtocolMessage };
