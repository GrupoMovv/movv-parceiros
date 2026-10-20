// Relógio do Fecha Mês — toda pergunta "que horas são" do evento passa por
// aqui (config/fechaMes.js). Em produção é sempre a hora real do servidor:
// não existe parâmetro de URL, cabeçalho nem variável de ambiente que mude
// isso. Só o banco descartável dos testes troca `agora` por fora (pelo
// require do Node, no próprio processo de teste), para simular as datas
// antes, durante e depois do evento.
function agora() {
  return new Date();
}

module.exports = { agora };
