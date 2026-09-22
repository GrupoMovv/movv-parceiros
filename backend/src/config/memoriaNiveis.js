// Config dos níveis progressivos do Jogo da Memória — única fonte de
// verdade no backend pra validar nivel/jogadas em memoriaController.js.
// O frontend tem uma cópia paralela (mesma convenção já usada em
// roletaService.PREMIOS vs RoletaWheel.SETORES_ROLETA) só com o que a UI
// precisa (nome, emoji, cols) — pares/nivel aqui é que manda de verdade.
const NIVEIS = [
  { nivel: 1, nome: 'APRENDIZ',     emoji: '🥉', pares: 8 },
  { nivel: 2, nome: 'ESTUDANTE',    emoji: '🥈', pares: 10 },
  { nivel: 3, nome: 'CONHECEDOR',   emoji: '🥇', pares: 12 },
  { nivel: 4, nome: 'ESPECIALISTA', emoji: '🏆', pares: 15 },
  { nivel: 5, nome: 'MESTRE',       emoji: '👑', pares: 18 },
  // O 👑 já era do MESTRE, então o LENDARIO ficou com o 🐉. A faixa do
  // CHECK no banco (migration 057) tem que acompanhar o maior nível daqui.
  { nivel: 6, nome: 'LENDARIO',     emoji: '🐉', pares: 21 },
];

function getNivel(n) {
  return NIVEIS.find(l => l.nivel === Number(n));
}

module.exports = { NIVEIS, getNivel };
