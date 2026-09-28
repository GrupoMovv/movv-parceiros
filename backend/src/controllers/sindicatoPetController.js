const db = require('../config/database');

// Pet parte 4 — moderação de avaliações (só admin). Ocultar esconde o
// COMENTÁRIO ofensivo; a nota continua contando na média (decisão do Junior).

// GET /api/sindicato-pet/avaliacoes?filtro=comentadas|ocultas|todas
async function listar(req, res) {
  try {
    const where = {
      comentadas: 'av.comentario IS NOT NULL AND av.oculta = false',
      ocultas: 'av.oculta = true',
      todas: 'true',
    }[req.query.filtro] || 'av.comentario IS NOT NULL AND av.oculta = false';
    const r = await db.query(
      `SELECT av.id, av.nota, av.comentario, av.resposta, av.oculta, av.oculta_por, av.created_at,
              ag.pet_nome, ag.servico, a.nome_completo AS cliente, p.nome AS pet_shop, p.slug
       FROM pet_avaliacoes av
       JOIN pet_agendamentos ag ON ag.id = av.agendamento_id
       JOIN sindicato_associados a ON a.id = av.associado_id
       JOIN sindicato_parceiros p ON p.id = av.parceiro_id
       WHERE ${where} ORDER BY av.created_at DESC LIMIT 200`
    );
    return res.json({ avaliacoes: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar avaliações' });
  }
}

// POST /api/sindicato-pet/avaliacoes/:id/ocultar { oculta: bool }
async function ocultar(req, res) {
  try {
    const oculta = req.body?.oculta !== false;
    const r = await db.query(
      'UPDATE pet_avaliacoes SET oculta = $1, oculta_por = $2 WHERE id = $3 RETURNING id',
      [oculta, oculta ? (req.user?.email || String(req.user?.id || 'admin')) : null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Avaliação não encontrada' });
    return res.json({ ok: true, oculta });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao moderar' });
  }
}

module.exports = { listar, ocultar };
