// Fecha Mês — toda a matemática de datas mora aqui, pura (sem banco), pra
// dar pra testar isolado e pra não precisar de cron nenhum: "está ativo
// hoje" é sempre uma pergunta calculada na hora, não um flag que alguém
// esqueceu de ligar/desligar. Datas sempre no horário de Brasília
// (America/Sao_Paulo) — o servidor roda em UTC (Render), calcular "hoje"/
// "sexta" sem isso erraria o dia perto da meia-noite.
const TIMEZONE = 'America/Sao_Paulo';
const { beneficios, planoValido } = require('./planos');

// Limite de catálogo no Fecha Mês = mesmo número da vitrine rotativa
// (config/planos.js `max_produtos_rotativa`) — de propósito acoplado
// agora (antes era uma constante própria e ficou desatualizada). Bônus é
// um limite À PARTE (produtos exclusivos daquela edição, não do
// catálogo) — mesmo valor pra todo plano, inclusive Grátis.
function limiteProdutosCatalogo(plano) {
  return beneficios(plano).max_produtos_rotativa ?? 0;
}

function limiteProdutosBonus(plano) {
  return podeParticipar(plano) ? (beneficios(plano).max_produtos_bonus_fecha_mes ?? 0) : 0;
}

// Total só pra exibição/compat — os dois limites NÃO são intercambiáveis
// (não dá pra usar as 3 vagas de bônus como catálogo nem vice-versa).
function limiteProdutosFechaMes(plano) {
  return limiteProdutosCatalogo(plano) + limiteProdutosBonus(plano);
}

// Grátis agora participa (só com bônus, ver config/planos.js) — qualquer
// plano válido participa de algum jeito.
function podeParticipar(plano) {
  return planoValido(plano) && beneficios(plano).participa_fecha_mes === true;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function agoraBrasil() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const obter = (tipo) => partes.find(p => p.type === tipo).value;
  return {
    ano: Number(obter('year')), mes: Number(obter('month')), dia: Number(obter('day')),
    hora: Number(obter('hour') === '24' ? '0' : obter('hour')), minuto: Number(obter('minute')), segundo: Number(obter('second')),
  };
}

function dataISO({ ano, mes, dia }) {
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}

function hojeISOBrasil() {
  const { ano, mes, dia } = agoraBrasil();
  return dataISO({ ano, mes, dia });
}

function agoraISOBrasil() {
  const { ano, mes, dia, hora, minuto, segundo } = agoraBrasil();
  return `${dataISO({ ano, mes, dia })}T${pad2(hora)}:${pad2(minuto)}:${pad2(segundo)}`;
}

// Dia da semana (0=domingo...5=sexta...6=sábado) de uma data YYYY-MM-DD —
// usa meio-dia UTC de propósito, pra nunca "vazar" pro dia anterior/
// seguinte por causa de fuso na hora de criar o Date.
function diaDaSemana(anoMesDiaISO) {
  return new Date(`${anoMesDiaISO}T12:00:00Z`).getUTCDay();
}

// Última sexta-feira de um mês (mes 1-indexed, igual data real).
function ultimaSextaDoMes(ano, mes) {
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let dia = ultimoDiaDoMes; dia >= 1; dia--) {
    const iso = dataISO({ ano, mes, dia });
    if (diaDaSemana(iso) === 5) return iso;
  }
  /* istanbul ignore next: todo mês tem uma sexta-feira */
  throw new Error('Não foi possível calcular a última sexta-feira do mês');
}

// A partir de uma data de referência (hoje, por padrão): se hoje já é a
// última sexta do mês corrente, o "próximo" Fecha Mês é hoje mesmo (em
// curso ou prestes a começar); senão é a última sexta deste mês (se ainda
// não passou) ou do mês seguinte.
function proximoFechaMes(refISO = hojeISOBrasil()) {
  const [ano, mes] = refISO.split('-').map(Number);
  const desteMes = ultimaSextaDoMes(ano, mes);
  if (desteMes >= refISO) return desteMes;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  return ultimaSextaDoMes(proxAno, proxMes);
}

function ehHojeODiaDoEvento(dataEventoISO) {
  return hojeISOBrasil() === dataEventoISO;
}

// Deadline pra parceiro confirmar participação: quinta 23:59:59 (véspera).
function deadlineConfirmacaoISO(dataEventoISO) {
  const d = new Date(`${dataEventoISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${dataISO({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() })}T23:59:59`;
}

function passouDaDeadline(dataEventoISO) {
  return agoraISOBrasil() > deadlineConfirmacaoISO(dataEventoISO);
}

// Prazo pra editar/remover/adicionar produto na edição (Feature 1): até 3
// dias ANTES do evento, 23:59:59 — depois disso a seleção trava (logística
// já em andamento). Substitui deadlineConfirmacaoISO/passouDaDeadline (que
// só valiam pra "confirmar participação" na véspera) como o prazo único
// pra qualquer mudança na lista de produtos.
function prazoEdicaoISO(dataEventoISO) {
  const d = new Date(`${dataEventoISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 3);
  return `${dataISO({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() })}T23:59:59`;
}

function passouPrazoEdicao(dataEventoISO) {
  return agoraISOBrasil() > prazoEdicaoISO(dataEventoISO);
}

// ISO com offset explícito de Brasília — o front só precisa de
// `new Date(terminaEm)` pra ter o instante certo, sem se preocupar com fuso.
function terminaEmISO(dataEventoISO) {
  return `${dataEventoISO}T23:59:59-03:00`;
}
function comecaEmISO(dataEventoISO) {
  return `${dataEventoISO}T00:00:00-03:00`;
}

function diasAte(dataEventoISO, refISO = hojeISOBrasil()) {
  const hoje = new Date(`${refISO}T00:00:00Z`);
  const evento = new Date(`${dataEventoISO}T00:00:00Z`);
  return Math.round((evento - hoje) / 86400000);
}

module.exports = {
  limiteProdutosCatalogo,
  limiteProdutosBonus,
  limiteProdutosFechaMes,
  podeParticipar,
  hojeISOBrasil,
  agoraISOBrasil,
  ultimaSextaDoMes,
  proximoFechaMes,
  ehHojeODiaDoEvento,
  deadlineConfirmacaoISO,
  passouDaDeadline,
  prazoEdicaoISO,
  passouPrazoEdicao,
  terminaEmISO,
  comecaEmISO,
  diasAte,
};
