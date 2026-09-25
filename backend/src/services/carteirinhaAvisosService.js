const db = require('../config/database');
const { sendWhatsAppMessage } = require('./zapApiService');
const { HOJE_SP } = require('./beneficioAssociado');

// Avisos de WhatsApp da carteirinha de 6 meses (associado novo; legado não
// vence e nunca recebe). Cada aviso é registrado em carteirinha_avisos ANTES
// de enviar — o UNIQUE (associado, tipo, validade) garante que nunca sai
// duplicado, nem com duas rotinas rodando juntas. Se o envio falha, o
// registro é apagado e a rotina do dia seguinte tenta de novo.
const URL_PAINEL = `${(process.env.FRONTEND_URL || 'https://portal.grupomovv.com.br').replace(/\/$/, '')}/meu`;
const LOTE_MAX = 200;
const PAUSA_ENTRE_ENVIOS_MS = 400;

const esperar = ms => new Promise(r => setTimeout(r, ms));

function fmtData(d) {
  const iso = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  const [y, m, dia] = iso.split('-');
  return `${dia}/${m}/${y}`;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

const MENSAGENS = {
  vence_30: a => `Olá, ${primeiroNome(a.nome_completo)}! 👋\n\nSua carteirinha de associado(a) SECI no *IUB MAIS+* vence em *${fmtData(a.carteirinha_valida_ate)}*.\n\nPra continuar com seus descontos, renove informando o CNPJ da empresa onde você trabalha:\n${URL_PAINEL}\n\nLeva menos de 1 minuto. 💜`,
  vence_hoje: a => {
    const hoje = a.venceu_hoje;
    return `Olá, ${primeiroNome(a.nome_completo)}!\n\nSua carteirinha de associado(a) SECI no *IUB MAIS+* ${hoje ? '*vence hoje*' : `venceu em *${fmtData(a.carteirinha_valida_ate)}*`}.\n\nRenove agora pra não perder seus descontos — é só informar o CNPJ da empresa onde você trabalha:\n${URL_PAINEL}`;
  },
  renovada: a => `✅ Carteirinha renovada, ${primeiroNome(a.nome_completo)}!\n\nSeus descontos de associado(a) SECI no *IUB MAIS+* estão garantidos até *${fmtData(a.carteirinha_valida_ate)}*.\n\n${URL_PAINEL}`,
  ativada: a => `🎊 Bem-vindo(a) associado(a) SECI, ${primeiroNome(a.nome_completo)}!\n\nSeus descontos exclusivos no *IUB MAIS+* já estão ativos e sua carteirinha digital vale até *${fmtData(a.carteirinha_valida_ate)}*.\n\n${URL_PAINEL}`,
};

// Registra e envia um aviso. Devolve 'enviado' | 'ja_enviado' | 'falhou'.
async function enviarAviso(associado, tipo) {
  const reg = await db.query(
    `INSERT INTO carteirinha_avisos (associado_id, tipo, referencia) VALUES ($1, $2, $3)
     ON CONFLICT (associado_id, tipo, referencia) DO NOTHING RETURNING id`,
    [associado.id, tipo, associado.carteirinha_valida_ate]
  );
  if (!reg.rows[0]) return 'ja_enviado';

  const r = await sendWhatsAppMessage(associado.whatsapp, MENSAGENS[tipo](associado));
  if (r.success) return 'enviado';
  await db.query('DELETE FROM carteirinha_avisos WHERE id = $1', [reg.rows[0].id]);
  console.error(`[avisos carteirinha] ${tipo} pro associado ${associado.id} falhou: ${r.reason}`);
  return 'falhou';
}

// Janela (e não "exatamente o dia X"): se o Cron Job falhar um dia, o aviso
// sai no seguinte. vence_30 = vence nos próximos 30 dias; vence_hoje = venceu
// hoje ou nos últimos 7 dias (depois disso, quem não renovou já viu o selo
// VENCIDO no painel e na carteirinha).
const CANDIDATOS = {
  vence_30: `a.carteirinha_valida_ate > ${HOJE_SP} AND a.carteirinha_valida_ate <= ${HOJE_SP} + 30`,
  vence_hoje: `a.carteirinha_valida_ate <= ${HOJE_SP} AND a.carteirinha_valida_ate >= ${HOJE_SP} - 7`,
};

async function rotinaDiaria() {
  const resumo = {};
  for (const [tipo, janela] of Object.entries(CANDIDATOS)) {
    const r = await db.query(
      `SELECT a.id, a.nome_completo, a.whatsapp, a.carteirinha_valida_ate,
              (a.carteirinha_valida_ate = ${HOJE_SP}) AS venceu_hoje
       FROM sindicato_associados a
       WHERE a.tipo_acesso = 'seci' AND a.ativo AND NOT a.legado
         AND a.whatsapp IS NOT NULL AND a.carteirinha_hash IS NOT NULL
         AND ${janela}
         AND NOT EXISTS (
           SELECT 1 FROM carteirinha_avisos v
           WHERE v.associado_id = a.id AND v.tipo = $1 AND v.referencia = a.carteirinha_valida_ate
         )
       ORDER BY a.carteirinha_valida_ate
       LIMIT ${LOTE_MAX}`,
      [tipo]
    );
    const conta = { candidatos: r.rows.length, enviados: 0, falhas: 0 };
    for (const a of r.rows) {
      const s = await enviarAviso(a, tipo);
      if (s === 'enviado') conta.enviados++;
      if (s === 'falhou') conta.falhas++;
      await esperar(PAUSA_ENTRE_ENVIOS_MS);
    }
    resumo[tipo] = conta;
  }
  return resumo;
}

// Confirmação na hora em que a pessoa ativa/renova pelo /meu. Não trava a
// resposta da tela: quem chama não espera (fire-and-forget com catch).
async function avisarRenovacao(associadoId, tipo) {
  const r = await db.query(
    `SELECT id, nome_completo, whatsapp, carteirinha_valida_ate FROM sindicato_associados
     WHERE id = $1 AND whatsapp IS NOT NULL AND carteirinha_valida_ate IS NOT NULL`,
    [associadoId]
  );
  if (!r.rows[0]) return 'sem_whatsapp';
  return enviarAviso(r.rows[0], tipo);
}

module.exports = { rotinaDiaria, avisarRenovacao, MENSAGENS };
