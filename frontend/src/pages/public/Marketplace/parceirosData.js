// ⚠️ IUB MAIS (marketplace) - Fase 1 com dados hardcoded
// TODO Fase 2: buscar parceiros dinamicamente da tabela sindicato_parceiros
// TODO Fase 2: sistema de promocoes com prazo
// TODO Fase 2: cupom exclusivo pra associado
// TODO Fase 2: notificacoes de novas ofertas

export const PARCEIROS_INICIAIS = [
  {
    slug: 'nossa-drogaria',
    nome: 'Nossa Drogaria',
    categorias: ['Saude', 'Produtos'],
    icone: '💊',
    corIcone: '#10B981',
    descricao: 'Descontos exclusivos em produtos e medicamentos',
    beneficio: 'Super descontos pra associados SECI',
    whatsapp: '64992991403',
    endereco: 'Itumbiara/GO',
    exclusivo: true,
  },
  {
    slug: 'academia-atletica',
    nome: 'Academia Atlética',
    categorias: ['Esportes', 'Servicos'],
    icone: '🏋️',
    corIcone: '#F97316',
    descricao: 'Musculação, funcional e programas personalizados',
    beneficio: 'Mensalidade especial R$ 30,00',
    whatsapp: null,
    endereco: 'Itumbiara/GO',
    exclusivo: true,
  },
  {
    slug: 'diroma-fiori',
    nome: 'Diroma Fiori — Caldas Novas',
    categorias: ['Hotelaria', 'Servicos'],
    icone: '🏨',
    corIcone: '#0EA5E9',
    descricao: 'Pacote de final de semana em Caldas Novas',
    beneficio: 'R$ 300 sexta a domingo',
    whatsapp: '64992640899',
    endereco: 'Caldas Novas/GO',
  },
  {
    slug: 'oticas-diniz',
    nome: 'Óticas Diniz',
    categorias: ['Beleza', 'Produtos'],
    icone: '👓',
    corIcone: '#1E40AF',
    descricao: 'Armações, lentes e acessórios',
    beneficio: '20% de desconto',
    whatsapp: '6434320708',
    endereco: 'Itumbiara/GO',
    exclusivo: true,
  },
  {
    slug: 'ezequiel-nutricionista',
    nome: 'Ezequiel Reis — Nutricionista',
    categorias: ['Saude', 'Servicos'],
    icone: '🥗',
    corIcone: '#84CC16',
    descricao: 'Consulta com nutricionista e plano alimentar',
    beneficio: 'Consulta por R$ 70,00',
    whatsapp: '64993222304',
    endereco: 'Itumbiara/GO',
  },
  {
    slug: 'plenitude-psicologia',
    nome: 'Plenitude — Psicologia',
    categorias: ['Saude', 'Bem-estar'],
    icone: '🧠',
    corIcone: '#A855F7',
    descricao: 'Psicoterapia adulto, infantil, ABA e neuropsicologia',
    beneficio: 'Preço especial pra associados',
    whatsapp: '64992012585',
    endereco: 'Itumbiara/GO',
  },
  {
    slug: 'nesplora-neuropsicologia',
    nome: 'Nesplora',
    categorias: ['Saude', 'Servicos'],
    icone: '🥽',
    corIcone: '#3B82F6',
    descricao: 'Avaliação neuropsicológica com realidade virtual',
    beneficio: 'R$ 400 com relatório',
    whatsapp: '64992012585',
    endereco: 'Itumbiara/GO',
  },
  {
    slug: 'laura-clemente-estetica',
    nome: 'Laura Clemente — Estética',
    categorias: ['Beleza', 'Servicos'],
    icone: '💆‍♀️',
    corIcone: '#EC4899',
    descricao: 'Estética corporal e facial',
    beneficio: '10% de desconto em qualquer região',
    whatsapp: '64992300587',
    endereco: 'Itumbiara/GO',
    novo: true,
  },
  {
    slug: 'studio-vip',
    nome: 'Studio Vip — Beleza',
    categorias: ['Beleza', 'Servicos'],
    icone: '💇‍♀️',
    corIcone: '#EAB308',
    descricao: 'Beleza e saúde capilar',
    beneficio: '20% de desconto',
    whatsapp: null,
    endereco: 'Itumbiara/GO',
    novo: true,
  },
];

// Categorias do filtro (label acentuado, exibido) — comparação com as
// `categorias` de cada parceiro (que vieram sem acento no snippet original)
// é feita sem diferenciar acento/maiúsculas, ver normalizarCategoria().
export const CATEGORIAS_FILTRO = [
  { label: 'Todas', emoji: null },
  { label: 'Produtos', emoji: '🛍️' },
  { label: 'Serviços', emoji: '🔧' },
  { label: 'Alimentação', emoji: '🍔' },
  { label: 'Moda', emoji: '👕' },
  { label: 'Casa', emoji: '🏠' },
  { label: 'Automotivo', emoji: '🚗' },
  { label: 'Tecnologia', emoji: '💻' },
  { label: 'Beleza', emoji: '💄' },
  { label: 'Presentes', emoji: '🎁' },
  { label: 'Educação', emoji: '📚' },
  { label: 'Esportes', emoji: '🏋️' },
  { label: 'Saúde', emoji: '💊' },
  { label: 'Hotelaria', emoji: '🏨' },
  { label: 'Bem-estar', emoji: '🧠' },
];

export function normalizarCategoria(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function buscarParceiroPorSlug(slug) {
  return PARCEIROS_INICIAIS.find(p => p.slug === slug) || null;
}
