// IUB BEER — listas fechadas da área de bebidas +18 (migration 058). Única
// fonte de verdade no backend; o front espelha em
// frontend/src/pages/beer/beerConfig.js (rótulo/emoji de cada chave).

// sindicato_parceiros.beer_tipo
const TIPOS_ESTABELECIMENTO = ['adega', 'distribuidora', 'bar', 'conveniencia', 'emporio'];

// sindicato_parceiro_produtos.beer_categoria
const CATEGORIAS_PRODUTO = ['cerveja', 'vinho', 'whisky', 'destilado', 'champagne', 'drink', 'sem_alcool', 'petisco', 'gelo'];

const IDADE_MINIMA = 18;

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

module.exports = { TIPOS_ESTABELECIMENTO, CATEGORIAS_PRODUTO, IDADE_MINIMA, idadeEmAnos };
