// Categorias do marketplace (filtros, faixa da home e rodapé). As lojas vêm
// do banco; a lista de parceiros escrita aqui saiu em 09/10/2026.

export const CATEGORIAS_FILTRO = [
  { label: 'Todas', emoji: null },
  { label: 'Saúde', emoji: '💊' },
  { label: 'Beleza', emoji: '💄' },
  { label: 'Alimentação', emoji: '🍔' },
  { label: 'Bebidas', emoji: '🍷' },
  { label: 'Serviços', emoji: '🔧' },
  { label: 'Pet', emoji: '🐾' },
  { label: 'Fitness', emoji: '🏋️' },
  { label: 'Casa', emoji: '🏠' },
  { label: 'Moda', emoji: '👕' },
  { label: 'Tecnologia', emoji: '💻' },
  { label: 'Automotivo', emoji: '🚗' },
  { label: 'Presentes', emoji: '🎁' },
  { label: 'Educação', emoji: '📚' },
  { label: 'Esportes', emoji: '⚽' },
  { label: 'Hospedagem', emoji: '🏨' },
  { label: 'Bem-estar', emoji: '🧠' },
];

// Espelha CATEGORIAS_HOME do backend (marketplaceHomeController) — só os
// slugs/labels usados no footer, sem precisar buscar da API pra isso.
export const CATEGORIAS_HOME_FOOTER = [
  { slug: 'saude', label: 'Saúde' },
  { slug: 'beleza', label: 'Beleza' },
  { slug: 'alimentacao', label: 'Alimentação' },
  { slug: 'servicos', label: 'Serviços' },
  { slug: 'fitness', label: 'Fitness' },
  { slug: 'casa', label: 'Casa' },
  { slug: 'moda', label: 'Moda' },
  { slug: 'tecnologia', label: 'Tecnologia' },
  { slug: 'pet', label: 'Pet' },
];

export function normalizarCategoria(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
