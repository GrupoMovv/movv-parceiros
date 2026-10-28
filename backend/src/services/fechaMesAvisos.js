const db = require('../config/database');
const { sendWhatsAppMessage } = require('./zapApiService');
const { planoEfetivo } = require('../config/planos');
const {
  podeParticipar, limiteProdutosCatalogo, limiteProdutosBonus, agoraISOBrasil, janelaAvisoISO,
} = require('../config/fechaMes');
const { fechaMesHabilitadoGlobalmente, obterProximoEvento } = require('./fechaMesService');

// Avisos do Fecha Mês pelo WhatsApp da IUB às lojas (decisão do Junior,
// 20/10/2026): convite na segunda da semana do evento e lembrete do prazo
// na quinta, os dois às 10:00 de Itumbiara, com texto diferente para loja
// que já tem produto no evento e para loja que ainda não tem. Só loja
// ATIVA (nunca pausada nem de teste), CNPJ, com plano que participa e
// WhatsApp cadastrado. Nada de e-mail.
//
// Cada aviso é gravado em fecha_mes_avisos ANTES do envio (UNIQUE por
// edição, loja e tipo): nunca sai em dobro. Se o envio falha, a linha é
// apagada e a próxima rodada, ainda dentro da janela, tenta de novo.
const PAUSA_ENTRE_ENVIOS_MS = 400;
const esperar = ms => new Promise(r => setTimeout(r, ms));
const FRONT = () => (process.env.FRONTEND_URL || 'https://iubmais.com.br').replace(/\/$/, '');

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function diaCurto(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  const semana = DIAS[new Date(`${ano}-${mes}-${dia}T12:00:00Z`).getUTCDay()];
  return `${semana}, ${dia}/${mes}`;
}

function textoLimites(plano) {
  const cat = limiteProdutosCatalogo(plano);
  const bonus = limiteProdutosBonus(plano);
  return cat > 0
    ? `${cat} produtos do seu catálogo e ${bonus} produtos bônus`
    : `${bonus} produtos bônus (eles aparecem só no evento)`;
}

function produtos(n) {
  return n === 1 ? '1 produto confirmado' : `${n} produtos confirmados`;
}

// Os quatro textos. `c` = { loja, plano, confirmados, dataEvento, prazo, link }
const TEXTOS = {
  convite: {
    com_produto: c => `🔥 *Fecha Mês do IUB MAIS+*: ${diaCurto(c.dataEvento)}\n\nOlá, ${c.loja}! Sua loja já tem ${produtos(c.confirmados)} no Fecha Mês. Seu plano permite até ${textoLimites(c.plano)}.\n\nDá para cadastrar mais e trocar até *${diaCurto(c.prazo)}, às 18:00*:\n${c.link}`,
    sem_produto: c => `🔥 *Fecha Mês do IUB MAIS+*: ${diaCurto(c.dataEvento)}\n\nOlá, ${c.loja}! Na última sexta de cada mês o IUB MAIS+ faz o Fecha Mês: um dia inteiro de ofertas, com os produtos das lojas participantes em destaque no topo do site.\n\nSeu plano permite até ${textoLimites(c.plano)}. Cadastre até *${diaCurto(c.prazo)}, às 18:00*:\n${c.link}`,
  },
  lembrete: {
    com_produto: c => `⏰ *Fecha Mês é amanhã* (${diaCurto(c.dataEvento)})\n\n${c.loja}, sua loja tem ${produtos(c.confirmados)}. Para trocar ou acrescentar, o prazo é *hoje até as 18:00*:\n${c.link}`,
    sem_produto: c => `⏰ *Fecha Mês é amanhã* (${diaCurto(c.dataEvento)})\n\n${c.loja}, sua loja ainda não tem produtos no evento. Seu plano permite até ${textoLimites(c.plano)}. Cadastre *hoje até as 18:00*:\n${c.link}`,
  },
};

// Qual aviso está na hora agora (null = nenhum).
function avisoDaVez(dataEvento, agora = agoraISOBrasil()) {
  for (const tipo of ['convite', 'lembrete']) {
    const { de, ate } = janelaAvisoISO(dataEvento, tipo);
    if (agora >= de && agora < ate) return tipo;
  }
  return null;
}

// Fecha Mês de 30/10/2026, o primeiro no ar, só com a Imaginari
// Personalizados (id 14). Decisão do Junior em 28/10: o convite de segunda
// não saiu e não sai depois; o lembrete de quinta, 10:00, vai só para ela,
// mesmo que outra loja fique ativa até lá. Edições sem entrada aqui seguem
// a regra geral.
const SO_NESTA_EDICAO = {
  '2026-10-30': { tipos: ['lembrete'], lojas: [14] },
};

async function lojasQueRecebem(fechaMesId) {
  const { rows } = await db.query(
    `SELECT pa.id, pa.nome, pa.whatsapp, pa.plano, pa.plano_expira_em, pa.cortesia_interna,
            (SELECT COUNT(*)::int FROM sindicato_fecha_mes_produtos fmp
              WHERE fmp.fecha_mes_id = $1 AND fmp.parceiro_id = pa.id AND fmp.status = 'confirmado') AS confirmados
     FROM sindicato_parceiros pa
     WHERE pa.status = 'ativo' AND NOT pa.empresa_teste AND pa.tipo_pessoa = 'pj'
       AND pa.whatsapp IS NOT NULL AND btrim(pa.whatsapp) <> ''
     ORDER BY pa.id`,
    [fechaMesId]
  );
  return rows.filter(l => podeParticipar(planoEfetivo(l))).map(l => ({ ...l, plano: planoEfetivo(l) }));
}

async function rodarAvisos() {
  const resultado = { tipo: null, enviados: 0, falhas: 0, ja_enviados: 0 };
  if (!(await fechaMesHabilitadoGlobalmente())) return resultado;
  const evento = await obterProximoEvento();
  if (!evento.ativo) return resultado;
  const dataEvento = String(evento.data_evento).slice(0, 10);
  const tipo = avisoDaVez(dataEvento);
  if (!tipo) return resultado;
  const restricao = SO_NESTA_EDICAO[dataEvento];
  if (restricao && !restricao.tipos.includes(tipo)) return resultado;
  resultado.tipo = tipo;
  const prazo = janelaAvisoISO(dataEvento, 'lembrete').ate;
  const link = `${FRONT()}/parceiro/painel/fecha-mes`;

  let lojas = await lojasQueRecebem(evento.id);
  if (restricao) lojas = lojas.filter(l => restricao.lojas.includes(l.id));
  for (const loja of lojas) {
    const variante = loja.confirmados > 0 ? 'com_produto' : 'sem_produto';
    const reservado = await db.query(
      `INSERT INTO fecha_mes_avisos (fecha_mes_id, parceiro_id, tipo, variante, whatsapp)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (fecha_mes_id, parceiro_id, tipo) DO NOTHING RETURNING id`,
      [evento.id, loja.id, tipo, variante, loja.whatsapp]
    );
    if (!reservado.rows[0]) { resultado.ja_enviados++; continue; }
    const texto = TEXTOS[tipo][variante]({ loja: loja.nome, plano: loja.plano, confirmados: loja.confirmados, dataEvento, prazo, link });
    let r;
    try { r = await sendWhatsAppMessage(loja.whatsapp, texto); } catch (err) { r = { success: false, reason: err.message }; }
    if (r?.success) resultado.enviados++;
    else {
      resultado.falhas++;
      await db.query('DELETE FROM fecha_mes_avisos WHERE id = $1', [reservado.rows[0].id]);
      console.error('[fecha mês avisos] falhou para a loja', loja.id, r?.reason || '');
    }
    await esperar(PAUSA_ENTRE_ENVIOS_MS);
  }
  return resultado;
}

// Timer no próprio servidor (mesmo padrão dos avisos do Clube), a cada 10
// minutos: o aviso das 10:00 sai até 10:10. A rota interna é a reserva.
function iniciarTimer(intervaloMs = 10 * 60 * 1000) {
  let rodando = false;
  const passo = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await rodarAvisos();
      if (r.enviados || r.falhas) console.log('[fecha mês avisos]', JSON.stringify(r));
    } catch (err) {
      console.error('[fecha mês avisos] rodada falhou:', err.message);
    } finally { rodando = false; }
  };
  setTimeout(passo, 45 * 1000);
  setInterval(passo, intervaloMs);
  console.log('[fecha mês avisos] timer ligado');
}

module.exports = { rodarAvisos, iniciarTimer, avisoDaVez, TEXTOS, textoLimites };
