const { MercadoPagoConfig } = require('mercadopago');

// Configuração do Mercado Pago (assinaturas dos planos do parceiro — PIX
// mensal e cartão recorrente). Mesmo padrão de "config presente?" do
// openaiService/cloudinaryService: loga no boot SEM expor segredo e deixa
// quem chama recusar cedo com mensagem clara, em vez de o SDK estourar um
// erro genérico de autenticação lá na frente.
//
// MP_AMBIENTE escolhe o par de credenciais:
//   test (padrão) -> MP_ACCESS_TOKEN_TEST / MP_PUBLIC_KEY_TEST
//   prod          -> MP_ACCESS_TOKEN_PROD / MP_PUBLIC_KEY_PROD
// Qualquer valor diferente de 'prod' (vazio, typo) cai em TEST — cobrar
// cartão de verdade tem que ser uma escolha explícita, nunca um acidente.

const AMBIENTE = String(process.env.MP_AMBIENTE || '').trim().toLowerCase() === 'prod' ? 'prod' : 'test';
const SUFIXO = AMBIENTE === 'prod' ? 'PROD' : 'TEST';
const ACCESS_TOKEN = (process.env[`MP_ACCESS_TOKEN_${SUFIXO}`] || '').trim();
const PUBLIC_KEY = (process.env[`MP_PUBLIC_KEY_${SUFIXO}`] || '').trim();
const WEBHOOK_SECRET = (process.env.MP_WEBHOOK_SECRET || '').trim();
const TIMEOUT_MS = 15 * 1000;

// Credencial de teste do MP começa com "TEST-"; a de produção com "APP_USR-".
// Credencial trocada de ambiente é o erro mais fácil de cometer ao colar no
// Render — trava a integração em vez de, p.ex., rodar "prod" com token de
// teste (pagamentos que nunca caem) ou "test" com token real (cobra de verdade).
function credencialBateComAmbiente(valor) {
  if (!valor) return false;
  return AMBIENTE === 'prod' ? !valor.startsWith('TEST-') : valor.startsWith('TEST-');
}

const PROBLEMAS = [];
if (!ACCESS_TOKEN) PROBLEMAS.push(`MP_ACCESS_TOKEN_${SUFIXO} ausente`);
else if (!credencialBateComAmbiente(ACCESS_TOKEN)) PROBLEMAS.push(`MP_ACCESS_TOKEN_${SUFIXO} não parece ser credencial de ${AMBIENTE}`);
if (!PUBLIC_KEY) PROBLEMAS.push(`MP_PUBLIC_KEY_${SUFIXO} ausente`);
else if (!credencialBateComAmbiente(PUBLIC_KEY)) PROBLEMAS.push(`MP_PUBLIC_KEY_${SUFIXO} não parece ser credencial de ${AMBIENTE}`);
if (!WEBHOOK_SECRET) PROBLEMAS.push('MP_WEBHOOK_SECRET ausente (webhook vai recusar toda notificação)');

// Pagamento/assinatura só com access token + public key válidos. O segredo
// do webhook é checado à parte (sem ele dá pra criar cobrança, mas nenhuma
// confirmação seria aceita — melhor nem deixar criar, ver `pronto`).
const CONFIGURADO = Boolean(ACCESS_TOKEN && PUBLIC_KEY && credencialBateComAmbiente(ACCESS_TOKEN) && credencialBateComAmbiente(PUBLIC_KEY));
const PRONTO = CONFIGURADO && Boolean(WEBHOOK_SECRET);

console.log('[MERCADOPAGO INIT]', {
  ambiente: AMBIENTE,
  access_token: ACCESS_TOKEN ? `presente (${ACCESS_TOKEN.slice(0, 5)}…, ${ACCESS_TOKEN.length} chars)` : 'FALTANDO',
  public_key: PUBLIC_KEY ? `presente (${PUBLIC_KEY.slice(0, 5)}…)` : 'FALTANDO',
  webhook_secret: WEBHOOK_SECRET ? 'presente' : 'FALTANDO',
  pronto: PRONTO,
});
if (PROBLEMAS.length) console.error('[mercadopago] Assinaturas DESLIGADAS até corrigir:', PROBLEMAS.join('; '));

const client = CONFIGURADO ? new MercadoPagoConfig({ accessToken: ACCESS_TOKEN, options: { timeout: TIMEOUT_MS } }) : null;

module.exports = {
  AMBIENTE,
  PUBLIC_KEY,
  WEBHOOK_SECRET,
  client,
  // true = pode criar cobrança/assinatura (credenciais + segredo do webhook ok)
  PRONTO,
  PROBLEMAS,
};
