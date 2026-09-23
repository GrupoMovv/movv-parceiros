// IUB DISK BEBIDAS — regras fixas da área +18 (migration 058). Única fonte
// de verdade no backend; o front espelha rótulos em
// frontend/src/pages/beer/beerConfig.js.

// beer_estabelecimentos.tipo
const TIPOS_ESTABELECIMENTO = ['adega', 'distribuidora', 'bar', 'conveniencia', 'emporio'];

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

const IDADE_MINIMA = 18;

// Versão do Termo IUB DISK BEBIDAS que o parceiro aceita ao ativar. Mudou o
// texto (frontend/src/components/beer/TermoDiskBebidas.jsx) = nova data
// aqui; quem aceitou a versão antiga fica registrado com ela.
const TERMO_VERSAO = '2026-09-23';

// ---------------------------------------------------------------------
// Camada 2 da proteção: filtro de termos no NOME e na DESCRIÇÃO do produto.
//
// TERMOS_BLOQUEADOS = sem outro sentido no catálogo de uma adega -> bloqueia
// o cadastro e grava tentativa em beer_log_moderacao.
//
// TERMOS_CONTEXTO = os que a lista original marca "(contexto droga)": têm
// uso legítimo no PRÓPRIO catálogo do Disk Bebidas (Coca-Cola, doce de
// leite, balas, gelo cristal, Smirnoff Ice, erva hortelã, papel-toalha...).
// Palavra solta não distingue contexto, então esses NÃO bloqueiam: o
// produto entra pendente com o termo em destaque pro moderador decidir
// (camada 3). "erva" mudou pra cá porque o catálogo tem erva_hortela.
//
// Comparação sem acento/maiúscula e por palavra inteira ("drogas" não pega
// "drogaria", "hash" não pega "hashtag", "pod" não pega "podão").
const TERMOS_BLOQUEADOS = [
  'vape', 'vapes', 'vaper', 'vaping', 'pod', 'pods', 'e-cig', 'ecig', 'cigarro eletronico', 'cigarro-eletronico', 'cigarros eletronicos',
  'maconha', 'cannabis', 'weed', 'marijuana', 'ganja', 'skunk', '420',
  'haxixe', 'hash', 'oleo thc', 'thc', 'cbd', 'canabidiol',
  'cocaina', 'po branco', 'branquinha',
  'crack', 'oxi',
  'lsd', 'acido lisergico',
  'ecstasy', 'extasy', 'mdma',
  'heroina',
  'metanfetamina',
  'drogas', 'entorpecente', 'entorpecentes', 'psicoativo', 'psicoativos',
  'anabolizante', 'anabolizantes',
  'narguile', 'narguiles', 'bong', 'dichavador', 'seda de fumar',
  'opio',
  'salvia divinorum', 'dmt', 'mescalina', 'cogumelo psicodelico', 'cogumelos psicodelicos',
];

const TERMOS_CONTEXTO = [
  'coca', 'pedra', 'doce', 'papel', 'bala', 'cavalo', 'cristal', 'ice', 'farinha',
  'erva', 'toxico', 'morfina', 'esteroide', 'esteroides',
];

function normalizarTexto(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Casa termo inteiro (com espaço dos dois lados) no texto já normalizado.
// Hífen/pontuação do termo viram espaço do mesmo jeito que no texto.
function contem(textoNormalizado, termo) {
  return ` ${textoNormalizado} `.includes(` ${normalizarTexto(termo)} `);
}

// Segunda leitura com a troca mais comum de letra por número/símbolo
// ("v4pe", "m@conha", "c0caina") — sem ela o bloqueio caía com um dígito.
const LEET = { 4: 'a', '@': 'a', 3: 'e', 1: 'i', '!': 'i', 0: 'o', 5: 's', $: 's', 7: 't' };
function desleet(s) {
  return String(s || '').replace(/[4@31!05$7]/g, c => LEET[c]);
}

// { bloqueado: 'termo' | null, sinalizados: ['termo', ...] }
function verificarTermos(...textos) {
  const bruto = textos.filter(Boolean).join(' ');
  const leituras = [normalizarTexto(bruto), normalizarTexto(desleet(bruto))];
  const achou = termo => leituras.some(t => contem(t, termo));
  const bloqueado = TERMOS_BLOQUEADOS.find(achou) || null;
  const sinalizados = TERMOS_CONTEXTO.filter(achou);
  return { bloqueado, sinalizados };
}

const MENSAGEM_TERMO_PROIBIDO = 'Este produto contém termos que não são permitidos no IUB. Entre em contato com o suporte se acredita ser um erro.';

// Idade em anos completos na data de HOJE em Itumbiara (não no fuso do
// servidor, que no Render é UTC — perto da meia-noite daria o dia errado).
// `dataNascimento` = "YYYY-MM-DD" (DATE chega como string, ver
// config/database.js). null se a data for inválida.
function idadeEmAnos(dataNascimento, agora = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataNascimento || ''));
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [anoHoje, mesHoje, diaHoje] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
    .format(agora).split('-').map(Number);
  let idade = anoHoje - ano;
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

// Chave do dia de HOJE em Itumbiara ('seg'..'dom') — pro filtro de
// dias_disponiveis ("só domingo").
function diaDeHoje(agora = new Date()) {
  const curto = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(agora);
  return { Mon: 'seg', Tue: 'ter', Wed: 'qua', Thu: 'qui', Fri: 'sex', Sat: 'sab', Sun: 'dom' }[curto];
}

// ---------------------------------------------------------------------
// "Aberto agora" preso ao horário de funcionamento (evita loja "aberta
// 24h" porque o parceiro esqueceu o botão ligado):
//   - o botão só LIGA dentro de um turno do horário cadastrado;
//   - ligado vale só pro turno em que foi ligado — terminou o turno, a loja
//     aparece Fechada sozinha e no próximo turno precisa ligar de novo
//     (senão reabria "sozinha" todo dia no horário, mesmo sem ninguém lá).
// Mesmo formato/regras do IUB Food (frontend/src/utils/iubFood.js):
// fecha < abre = vira a noite (18:00–02:00), e de madrugada quem vale é o
// turno de ONTEM. São Paulo não tem horário de verão desde 2019: -03:00 fixo.
const DIAS_POR_INDICE = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const HHMM_VALIDO = /^([01]\d|2[0-3]):[0-5]\d$/;

function paraMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function turnoValido(t) {
  return Boolean(t?.aberto && HHMM_VALIDO.test(t.abre || '') && HHMM_VALIDO.test(t.fecha || ''));
}
// "YYYY-MM-DD" em Itumbiara, `deslocDias` dias a partir de hoje.
function dataSP(agora, deslocDias = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
    .format(new Date(agora.getTime() + deslocDias * 86400000));
}
function instante(ymd, hhmm) {
  return new Date(`${ymd}T${hhmm}:00-03:00`);
}

function horarioConfigurado(horario) {
  return DIAS.some(d => turnoValido(horario?.[d]));
}

// Turno que está valendo AGORA: { inicio: Date, fim: Date, abre, fecha } ou null.
function turnoAtual(horario, agora = new Date()) {
  if (!horario) return null;
  const hoje = dataSP(agora);
  const ontem = dataSP(agora, -1);
  const amanha = dataSP(agora, 1);
  const idx = DIAS_POR_INDICE.indexOf(diaDeHoje(agora));
  const [hh, mm] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(agora).split(':').map(Number);
  const minutos = hh * 60 + mm;

  const tOntem = horario[DIAS_POR_INDICE[(idx + 6) % 7]];
  if (turnoValido(tOntem) && paraMin(tOntem.fecha) <= paraMin(tOntem.abre) && minutos < paraMin(tOntem.fecha)) {
    return { inicio: instante(ontem, tOntem.abre), fim: instante(hoje, tOntem.fecha), abre: tOntem.abre, fecha: tOntem.fecha };
  }
  const tHoje = horario[DIAS_POR_INDICE[idx]];
  if (turnoValido(tHoje)) {
    const a = paraMin(tHoje.abre);
    const f = paraMin(tHoje.fecha);
    if (f > a && minutos >= a && minutos < f) return { inicio: instante(hoje, tHoje.abre), fim: instante(hoje, tHoje.fecha), abre: tHoje.abre, fecha: tHoje.fecha };
    if (f <= a && minutos >= a) return { inicio: instante(hoje, tHoje.abre), fim: instante(amanha, tHoje.fecha), abre: tHoje.abre, fecha: tHoje.fecha };
  }
  return null;
}

// "hoje às 18:00" / "sex às 18:00" / null — próxima abertura FORA de turno.
function proximaAbertura(horario, agora = new Date()) {
  if (!horarioConfigurado(horario)) return null;
  const idx = DIAS_POR_INDICE.indexOf(diaDeHoje(agora));
  const [hh, mm] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(agora).split(':').map(Number);
  const minutos = hh * 60 + mm;
  for (let i = 0; i <= 7; i++) {
    const t = horario[DIAS_POR_INDICE[(idx + i) % 7]];
    if (!turnoValido(t) || (i === 0 && paraMin(t.abre) <= minutos)) continue;
    return `${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS_POR_INDICE[(idx + i) % 7]} às ${t.abre}`;
  }
  return null;
}

// O que o cliente vê: botão ligado DENTRO de um turno E ligado neste turno.
function abertoEfetivo(est, agora = new Date()) {
  if (!est?.status_aberto || !est.ultimo_status_update) return false;
  const turno = turnoAtual(est.horario_funcionamento, agora);
  return Boolean(turno && new Date(est.ultimo_status_update) >= turno.inicio);
}

// dias_disponiveis aceito do front: {"todos": true} ou só chaves de DIAS
// marcadas true. Qualquer outra coisa vira "todos".
function normalizarDias(entrada) {
  if (!entrada || typeof entrada !== 'object' || entrada.todos) return { todos: true };
  const dias = Object.fromEntries(DIAS.filter(d => entrada[d] === true).map(d => [d, true]));
  return Object.keys(dias).length ? dias : { todos: true };
}

module.exports = {
  TIPOS_ESTABELECIMENTO, DIAS, IDADE_MINIMA, TERMO_VERSAO,
  TERMOS_BLOQUEADOS, TERMOS_CONTEXTO, MENSAGEM_TERMO_PROIBIDO,
  verificarTermos, normalizarTexto, idadeEmAnos, diaDeHoje, normalizarDias,
  horarioConfigurado, turnoAtual, proximaAbertura, abertoEfetivo,
};
