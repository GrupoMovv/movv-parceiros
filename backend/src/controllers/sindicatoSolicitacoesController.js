const db = require('../config/database');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');

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
      `SELECT s.*, c.name AS atendido_por_nome, a.tipo_acesso AS conta_tipo_acesso
       FROM sindicato_solicitacoes_empresa s
       LEFT JOIN internal_collaborators c ON c.id = s.atendido_por_id
       LEFT JOIN sindicato_associados a ON a.id = s.associado_id
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

// Solicitação vinda do /acesso (Fluxo 2) tem conta no app ligada
// (associado_id, tipo 'pendente_seci', que usa o marketplace como cliente
// enquanto espera). Converter promove a conta a associado SECI com
// carteirinha; rejeitar deixa como cliente. Só mexe em conta que AINDA está
// pendente — nunca rebaixa quem já é associado por outro caminho.
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: 'status inválido' });

    const atendidoPorId = req.user?.type === 'internal' ? req.user.id : null;
    const hash = status === 'convertido' ? await gerarHashUnico('sindicato_associados') : null;

    const solicitacao = await db.transacao(async (client) => {
      const result = await client.query(
        `UPDATE sindicato_solicitacoes_empresa
         SET status = $1, atendido_por_id = $2, atendido_em = NOW()
         WHERE id = $3 RETURNING *`,
        [status, atendidoPorId, id]
      );
      const s = result.rows[0];
      if (!s?.associado_id) return s;

      if (status === 'convertido') {
        await client.query(
          `UPDATE sindicato_associados
           SET tipo_acesso = 'seci',
               carteirinha_hash = COALESCE(carteirinha_hash, $1),
               carteirinha_gerada_em = COALESCE(carteirinha_gerada_em, NOW()),
               carteirinha_valida_ate = COALESCE(carteirinha_valida_ate, $2),
               updated_at = NOW()
           WHERE id = $3 AND tipo_acesso = 'pendente_seci'`,
          [hash, calcularValidoAte(), s.associado_id]
        );
      } else if (status === 'rejeitado') {
        await client.query(
          `UPDATE sindicato_associados SET tipo_acesso = 'cliente', updated_at = NOW()
           WHERE id = $1 AND tipo_acesso = 'pendente_seci'`,
          [s.associado_id]
        );
      }
      return s;
    });

    if (!solicitacao) return res.status(404).json({ error: 'Solicitação não encontrada' });
    return res.json(solicitacao);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar solicitação' });
  }
}

module.exports = { listSolicitacoes, countPendentes, updateStatus };
