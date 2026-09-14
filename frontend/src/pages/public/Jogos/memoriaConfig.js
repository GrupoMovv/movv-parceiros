// Config dos 5 níveis + o pool de temas das cartas — espelha
// backend/src/config/memoriaNiveis.js (mesma convenção de duplicar
// config estática entre front/back já usada em roletaService.PREMIOS vs
// RoletaWheel.SETORES_ROLETA). `pares` aqui só decide o que a UI monta;
// quem valida de verdade é o backend.
export const NIVEIS = [
  { nivel: 1, nome: 'APRENDIZ',     emoji: '🥉', pares: 8,  cols: 4, dimensoes: '4x4' },
  { nivel: 2, nome: 'ESTUDANTE',    emoji: '🥈', pares: 10, cols: 5, dimensoes: '5x4' },
  { nivel: 3, nome: 'CONHECEDOR',   emoji: '🥇', pares: 12, cols: 6, dimensoes: '6x4' },
  { nivel: 4, nome: 'ESPECIALISTA', emoji: '🏆', pares: 15, cols: 6, dimensoes: '6x5' },
  { nivel: 5, nome: 'MESTRE',       emoji: '👑', pares: 18, cols: 6, dimensoes: '6x6' },
];

export function getNivelConfig(nivel) {
  return NIVEIS.find(n => n.nivel === Number(nivel));
}

// Pool de 18 temas de carta — exatamente o que o nível 5 (18 pares) usa
// inteiro; níveis menores sorteiam um subconjunto a cada partida (mais
// variedade nas partidas repetidas, já que "sem limite" é o objetivo).
// 10 parceiros ativos da Roleta (só 2 têm logo_url cadastrada hoje —
// nossa-drogaria, imaginari-personalizados — os demais usam badge de
// sigla+cor, ver MemoriaCarta.jsx), o mascote e 7 símbolos (3 "oficiais"
// IUB + 4 de preenchimento, já que só 8 temas de marca não dão pros 18
// pares do nível 5).
const PARCEIROS = [
  { chave: 'nossa-drogaria', nome: 'Drogaria Sindical', logo: 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788459943/iubmais/parceiros/1/logo/ipgi7gljwt7woyo0lqp1.png' },
  { chave: 'imaginari-personalizados', nome: 'Imaginari Personalizados', logo: 'https://res.cloudinary.com/emv2nb1j/image/upload/v1789000890/iubmais/parceiros/14/logo/qqmbgroahvivdxgfe8ym.jpg' },
  { chave: 'academia-atletica', nome: 'Academia Atlética', sigla: 'AA', cor: '#EF4444' },
  { chave: 'oticas-diniz', nome: 'Óticas Diniz', sigla: 'OD', cor: '#0EA5E9' },
  { chave: 'diroma-fiori', nome: 'Diroma Fiori', sigla: 'DF', cor: '#EC4899' },
  { chave: 'ezequiel-nutricionista', nome: 'Ezequiel Nutricionista', sigla: 'EN', cor: '#22C55E' },
  { chave: 'plenitude-psicologia', nome: 'Plenitude Psicologia', sigla: 'PP', cor: '#8B5CF6' },
  { chave: 'nesplora-neuropsicologia', nome: 'Nesplora', sigla: 'NE', cor: '#0D9488' },
  { chave: 'laura-clemente-estetica', nome: 'Laura Clemente Estética', sigla: 'LC', cor: '#F59E0B' },
  { chave: 'studio-vip', nome: 'Studio Vip', sigla: 'SV', cor: '#DB2777' },
].map(p => ({ ...p, tipo: 'parceiro' }));

const MASCOTE = { chave: 'mascote', tipo: 'mascote', nome: 'Mascote IUB MAIS+' };

const SIMBOLOS = [
  { chave: 'coracao', emoji: '❤️', nome: 'Coração' },
  { chave: 'estrela', emoji: '⭐', nome: 'Estrela' },
  { chave: 'presente', emoji: '🎁', nome: 'Presente' },
  { chave: 'trevo', emoji: '🍀', nome: 'Trevo' },
  { chave: 'raio', emoji: '⚡', nome: 'Raio' },
  { chave: 'alvo', emoji: '🎯', nome: 'Alvo' },
  { chave: 'trofeu', emoji: '🏆', nome: 'Troféu' },
].map(s => ({ ...s, tipo: 'simbolo' }));

export const POOL_PARES = [...PARCEIROS, MASCOTE, ...SIMBOLOS];
