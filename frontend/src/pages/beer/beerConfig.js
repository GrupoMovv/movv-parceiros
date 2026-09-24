import { formatarBRL } from '../../utils/iubFood';

// IUB DISK BEBIDAS — rótulos e paleta da área. As listas fechadas moram no
// backend (backend/src/config/beer.js e tabela beer_categorias); aqui só o
// que é de exibição.

export const TIPOS_ESTABELECIMENTO = {
  adega: 'Adega', distribuidora: 'Distribuidora', bar: 'Bar', conveniencia: 'Conveniência', emporio: 'Empório',
};

export const DIAS = [
  { chave: 'seg', curto: 'Seg', label: 'Segunda' }, { chave: 'ter', curto: 'Ter', label: 'Terça' },
  { chave: 'qua', curto: 'Qua', label: 'Quarta' }, { chave: 'qui', curto: 'Qui', label: 'Quinta' },
  { chave: 'sex', curto: 'Sex', label: 'Sexta' }, { chave: 'sab', curto: 'Sáb', label: 'Sábado' },
  { chave: 'dom', curto: 'Dom', label: 'Domingo' },
];

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
  lavandaFraca: 'rgba(196,181,253,0.65)',
  dourado: '#FFB800',
};

// Roxinho Gentleman (bigode fino + gravata-borboleta) recortado da peça
// quadrada do banner — mesma arte do carrossel, sem asset novo.
export const ROXINHO_GENTLEMAN_URL =
  'https://res.cloudinary.com/emv2nb1j/image/upload/c_crop,x_200,y_20,w_820,h_780/w_360/f_auto,q_auto/v1790187628/beer-mobile.png';

export const CHAVE_SESSAO_IDADE = 'iub_beer_idade_confirmada';

// Grade "Mais acessados" da home. `codigo` = grupo de beer_categorias
// (vira /beer/categoria/:codigo); `rota` = página própria.
export const MAIS_ACESSADOS = [
  { id: 'quero-agora', label: 'QUERO AGORA', icone: '⚡', rota: '/beer/quero-agora', destaque: true },
  { id: 'cervejas', label: 'Cerveja', icone: '🍺', codigo: 'cervejas' },
  { id: 'destilados', label: 'Destilados', icone: '🥃', codigo: 'destilados' },
  { id: 'vinhos', label: 'Vinhos', icone: '🍷', codigo: 'vinhos' },
  { id: 'drinks', label: 'Drinks', icone: '🍸', codigo: 'drinks_prontos' },
  { id: 'gelo', label: 'Gelo', icone: '🧊', codigo: 'gelo' },
  { id: 'petiscos', label: 'Petiscos', icone: '🥜', codigo: 'petiscos' },
  { id: 'comidas', label: 'Comidas Prontas', icone: '🍽️', codigo: 'comidas_prontas', domingo: true },
  { id: 'churrasco', label: 'Churrasco', icone: '🔥', codigo: 'churrasco' },
  { id: 'festa', label: 'Festa', icone: '🎉', codigo: 'festa' },
];

export const AVISO_VITRINE = 'IUB é uma vitrine que conecta você ao estabelecimento parceiro. A responsabilidade sobre qualidade, higiene e origem do produto é do estabelecimento fornecedor.';

// "Só domingo" / "Sáb e Dom" / null (todos os dias).
export function textoDias(dias) {
  if (!dias || dias.todos) return null;
  const marcados = DIAS.filter(d => dias[d.chave]);
  if (!marcados.length) return null;
  if (marcados.length === 1) return `Só ${marcados[0].label.toLowerCase()}`;
  return marcados.map(d => d.curto).join(', ').replace(/, ([^,]*)$/, ' e $1');
}

// Pedido pronto no WhatsApp do estabelecimento. A mensagem tem emoji (ícone
// da categoria + 💰), então vai por api.whatsapp.com e NÃO por wa.me: o
// redirect do wa.me corrompe emoji (vira "�"), ver utils/carteirinhaWhatsapp.js.
export function linkPedido(produto, { agora = false } = {}) {
  const digitos = String(produto.estabelecimento?.whatsapp || '').replace(/\D/g, '');
  if (!digitos) return null;
  const comDdi = digitos.startsWith('55') && digitos.length > 11 ? digitos : `55${digitos}`;
  const icone = produto.categoria?.icone || '🍻';
  const msg = `${agora ? 'Olá! Quero AGORA do IUB DISK BEBIDAS:' : 'Olá! Quero pedir do IUB DISK BEBIDAS:'}\n\n`
    + `${icone} ${produto.nome}\n💰 ${formatarBRL(produto.preco)}\n\n`
    + 'Meu endereço: \n\nAguardo confirmação!';
  return `https://api.whatsapp.com/send?phone=${comDdi}&text=${encodeURIComponent(msg)}`;
}

// % de desconto arredondado ("-22%") — só com oferta ativa.
export function percentualDesconto(produto) {
  if (!produto.em_oferta || !produto.preco_original) return null;
  const pct = Math.round((1 - Number(produto.preco) / Number(produto.preco_original)) * 100);
  return pct > 0 ? pct : null;
}

export const ORDENACOES = [
  { valor: 'relevancia', label: 'Relevância' },
  { valor: 'menor_preco', label: 'Menor preço' },
  { valor: 'maior_preco', label: 'Maior preço' },
  { valor: 'estabelecimento', label: 'Estabelecimento (A-Z)' },
  { valor: 'rapido', label: 'Mais rápido (entrega)' },
];
