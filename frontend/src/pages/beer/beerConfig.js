// IUB BEER — rótulos/emoji das chaves fechadas do backend
// (backend/src/config/beer.js) e a paleta da área. Chave nova lá = entrada
// nova aqui, senão o filtro/card não sabe mostrar.

export const CATEGORIAS_BEBIDA = [
  { chave: 'cerveja', label: 'Cerveja', emoji: '🍺' },
  { chave: 'vinho', label: 'Vinho', emoji: '🍷' },
  { chave: 'whisky', label: 'Whisky', emoji: '🥃' },
  { chave: 'destilado', label: 'Destilados', emoji: '🍶' },
  { chave: 'champagne', label: 'Champagne', emoji: '🥂' },
  { chave: 'drink', label: 'Drinks', emoji: '🍸' },
  { chave: 'sem_alcool', label: 'Sem álcool', emoji: '🥤' },
  { chave: 'petisco', label: 'Petiscos', emoji: '🍿' },
  { chave: 'gelo', label: 'Gelo', emoji: '🧊' },
];

export const TIPOS_ESTABELECIMENTO = {
  adega: 'Adega', distribuidora: 'Distribuidora', bar: 'Bar', conveniencia: 'Conveniência', emporio: 'Empório',
};

// "Whisky lounge": roxo escuro dominante, lavanda pra texto secundário e
// dourado SÓ em detalhe (botão principal, fio fino) — nada de amarelo de
// marca de cerveja.
export const BEER = {
  fundo: '#12091F',
  painel: '#1B0E31',
  card: '#221040',
  borda: 'rgba(196,181,253,0.14)',
  roxo: '#4C1D95',
  violeta: '#7C3AED',
  lavanda: '#C4B5FD',
  dourado: '#FFB800',
};

// Roxinho Gentleman (bigode + gravata-borboleta) recortado da peça
// quadrada do banner — mesma arte do carrossel, sem asset novo.
export const ROXINHO_GENTLEMAN_URL =
  'https://res.cloudinary.com/emv2nb1j/image/upload/c_crop,x_200,y_20,w_820,h_780/w_360/f_auto,q_auto/v1790187628/beer-mobile.png';

export const CHAVE_SESSAO_IDADE = 'iub_beer_idade_confirmada';

export function labelCategoria(chave) {
  return CATEGORIAS_BEBIDA.find(c => c.chave === chave) || null;
}
