// Config dos níveis + o pool de temas das cartas — espelha
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
  // 👑 já era do MESTRE; LENDARIO ficou com 🐉. `destaque` só existe aqui:
  // é o gradiente roxo→dourado do card em MemoriaNiveis.jsx.
  { nivel: 6, nome: 'LENDARIO',     emoji: '🐉', pares: 21, cols: 7, dimensoes: '7x6', destaque: true },
];

export function getNivelConfig(nivel) {
  return NIVEIS.find(n => n.nivel === Number(nivel));
}

// Pool de 21 temas de carta — exatamente o que o LENDARIO (21 pares) usa
// inteiro; níveis menores sorteiam um subconjunto a cada partida (mais
// variedade nas partidas repetidas, já que "sem limite" é o objetivo).
// Só loja ATIVA com logo vira carta (09/10/2026: as 9 empresas dos convênios
// do SECI, pausadas, saíram — no lugar entram símbolos das categorias do
// IUB MAIS+). Loja que pausar tem que sair daqui também. O pool tem que
// ser >= o maior `pares` de NIVEIS; a checagem no fim do arquivo garante.
const PARCEIROS = [
  { chave: 'imaginari-personalizados', nome: 'Imaginari Personalizados', logo: 'https://res.cloudinary.com/emv2nb1j/image/upload/v1789000890/iubmais/parceiros/14/logo/qqmbgroahvivdxgfe8ym.jpg' },
].map(p => ({ ...p, tipo: 'parceiro' }));

// Símbolos das categorias do marketplace (mesmos emojis dos filtros).
const CATEGORIAS = [
  { chave: 'cat-saude', emoji: '💊', nome: 'Saúde' },
  { chave: 'cat-beleza', emoji: '💄', nome: 'Beleza' },
  { chave: 'cat-alimentacao', emoji: '🍔', nome: 'Alimentação' },
  { chave: 'cat-bebidas', emoji: '🍷', nome: 'Bebidas' },
  { chave: 'cat-pet', emoji: '🐾', nome: 'Pet' },
  { chave: 'cat-fitness', emoji: '🏋️', nome: 'Fitness' },
  { chave: 'cat-casa', emoji: '🏠', nome: 'Casa' },
  { chave: 'cat-moda', emoji: '👕', nome: 'Moda' },
  { chave: 'cat-tecnologia', emoji: '💻', nome: 'Tecnologia' },
].map(c => ({ ...c, tipo: 'simbolo' }));

const MASCOTE = { chave: 'mascote', tipo: 'mascote', nome: 'Mascote IUB MAIS+' };

const SIMBOLOS = [
  { chave: 'coracao', emoji: '❤️', nome: 'Coração' },
  { chave: 'estrela', emoji: '⭐', nome: 'Estrela' },
  { chave: 'presente', emoji: '🎁', nome: 'Presente' },
  { chave: 'trevo', emoji: '🍀', nome: 'Trevo' },
  { chave: 'raio', emoji: '⚡', nome: 'Raio' },
  { chave: 'alvo', emoji: '🎯', nome: 'Alvo' },
  { chave: 'trofeu', emoji: '🏆', nome: 'Troféu' },
  // Os 3 últimos entraram com o LENDARIO (21 pares): o pool tinha
  // exatamente 18, então `criarBaralho` montaria só 18 pares e o jogo
  // ficaria INVENCÍVEL — `casadas.size < cfg.pares` nunca fecharia.
  // Símbolos, e não parceiros novos, porque sigla/cor de parceiro é dado
  // real e eu não ia inventar.
  { chave: 'carrinho', emoji: '🛒', nome: 'Carrinho' },
  { chave: 'loja', emoji: '🏪', nome: 'Loja' },
  { chave: 'moeda', emoji: '💰', nome: 'Moeda' },
].map(s => ({ ...s, tipo: 'simbolo' }));

export const POOL_PARES = [...PARCEIROS, ...CATEGORIAS, MASCOTE, ...SIMBOLOS];

// Rede de segurança: se um nível pedir mais pares do que existe tema, o
// baralho sai menor e a vitória fica inalcançável — falha silenciosa e
// chata de achar. Estoura no boot do módulo, não no meio da partida.
const MAIOR_NIVEL = NIVEIS.reduce((a, n) => Math.max(a, n.pares), 0);
if (POOL_PARES.length < MAIOR_NIVEL) {
  throw new Error(
    `memoriaConfig: POOL_PARES tem ${POOL_PARES.length} temas, mas o maior nível pede ${MAIOR_NIVEL} pares.`
  );
}
