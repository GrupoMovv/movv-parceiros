const db = require('../config/database');
const { hojeSP } = require('../config/pet');

// Pet parte 4 — o que o pet shop e o dono enxergam de um atendimento que
// JÁ ACONTECEU: fotos antes/depois e a avaliação.

const LIMITE_FOTOS_POR_TIPO = 3;

// Atendimento "feito" = confirmado e o dia já chegou (hoje conta: o pet
// shop fotografa no próprio dia; o cliente avalia a partir do mesmo dia).
function atendimentoFeito(ag) {
  return ag.status === 'confirmado' && String(ag.data).slice(0, 10) <= hojeSP();
}

// Acrescenta fotos[] e avaliacao a cada agendamento da lista (1 ida por tabela).
async function anexarFotosEAvaliacoes(ags) {
  if (!ags.length) return ags;
  const ids = ags.map(a => a.id);
  const fotos = (await db.query(
    'SELECT id, agendamento_id, tipo, url FROM pet_atendimento_fotos WHERE agendamento_id = ANY($1) ORDER BY id', [ids]
  )).rows;
  const avs = (await db.query(
    'SELECT id, agendamento_id, nota, comentario, resposta, respondido_em, oculta, created_at FROM pet_avaliacoes WHERE agendamento_id = ANY($1)', [ids]
  )).rows;
  return ags.map(a => ({
    ...a,
    atendimento_feito: atendimentoFeito(a),
    fotos: fotos.filter(f => f.agendamento_id === a.id).map(({ agendamento_id, ...f }) => f),
    avaliacao: (({ agendamento_id, ...r } = {}) => (r.id ? r : null))(avs.find(v => v.agendamento_id === a.id)),
  }));
}

module.exports = { LIMITE_FOTOS_POR_TIPO, atendimentoFeito, anexarFotosEAvaliacoes };
