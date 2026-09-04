import {
  Pill, Barbell, Bed, Sparkle, ForkKnife, Brain, Eyeglasses, Scissors, Gift, Wrench, Storefront,
} from '@phosphor-icons/react';

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Regras da mais específica pra mais genérica de propósito: um parceiro de
// nutrição tem "Saúde" na categoria igual uma farmácia, então se o termo
// genérico fosse checado primeiro todo mundo de "Saúde" viraria Pill.
// Testa nome+descrição+categoria juntos como um texto só, na ordem abaixo,
// e usa o ícone da primeira regra que bater.
const REGRAS = [
  { icone: Eyeglasses, palavras: ['otica', 'oculos'] },
  { icone: Scissors, palavras: ['cabeleireiro', 'barbearia', 'studio', 'salao de beleza'] },
  { icone: Brain, palavras: ['psicolog', 'neuropsicolog', 'psicoterapia'] },
  { icone: ForkKnife, palavras: ['nutri', 'restaurante', 'lanchonete', 'pizzaria', 'alimenta'] },
  { icone: Bed, palavras: ['hotel', 'pousada', 'hospedagem', 'hotelaria'] },
  { icone: Barbell, palavras: ['academia', 'fitness', 'esporte'] },
  { icone: Gift, palavras: ['presente'] },
  { icone: Pill, palavras: ['farmacia', 'drogaria'] },
  { icone: Sparkle, palavras: ['estetica', 'beleza'] },
  { icone: Wrench, palavras: ['servic'] },
  { icone: Pill, palavras: ['saude'] },
];

function escolherIcone(textoBusca) {
  const alvo = normalizar(textoBusca);
  const regra = REGRAS.find(r => r.palavras.some(p => alvo.includes(p)));
  return regra?.icone || Storefront;
}

// `categoria`/`categorias` aceita tanto uma string única (categoria_principal
// do banco) quanto um array (categorias[] do banco ou do parceirosData
// hardcoded) — tudo vira um texto só de busca junto com nome/descrição.
export default function IconePorCategoria({ nome, descricao, categoria, categorias, size = 32, weight = 'duotone', color, className }) {
  const texto = [nome, descricao, categoria, ...(Array.isArray(categorias) ? categorias : [])]
    .filter(Boolean)
    .join(' ');
  const Icone = escolherIcone(texto);
  return <Icone size={size} weight={weight} color={color} className={className} />;
}
