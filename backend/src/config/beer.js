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
};
