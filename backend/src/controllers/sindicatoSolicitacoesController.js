const db = require('../config/database');

const STATUS_VALIDOS = ['pendente', 'contatado', 'convertido', 'rejeitado'];

async function listSolicitacoes(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const where = [];
    const params = [];
    if (status) {
      params.push(status);
      where.push(`s.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_solicitacoes_empresa s ${whereSql}`, params);

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT s.*, c.name AS atendido_por_nome
       FROM sindicato_solicitacoes_empresa s
       LEFT JOIN internal_collaborators c ON c.id = s.atendido_por_id
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar solicitações' });
  }
}

async function countPendentes(req, res) {
  try {
    const result = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_solicitacoes_empresa WHERE status = 'pendente'`);
    return res.json({ pendentes: result.rows[0].total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao contar solicitações' });
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: 'status inválido' });

    const atendidoPorId = req.user?.type === 'internal' ? req.user.id : null;
    const result = await db.query(
      `UPDATE sindicato_solicitacoes_empresa
       SET status = $1, atendido_por_id = $2, atendido_em = NOW()
       WHERE id = $3 RETURNING *`,
      [status, atendidoPorId, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Solicitação não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar solicitação' });
  }
}

module.exports = { listSolicitacoes, countPendentes, updateStatus };
