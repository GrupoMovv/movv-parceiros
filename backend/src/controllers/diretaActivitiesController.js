const db = require('../config/database');

function monthFromDate(dateStr) {
  return (dateStr ? new Date(dateStr) : new Date()).toISOString().slice(0, 7);
}

// ─── Listar atividades (admin: todas + filtros; Fernando: apenas as próprias) ─
async function listActivities(req, res) {
  try {
    const isAdmin = !!req.user?.is_admin;
    const { collaborator_id, reference_month, tipo, status_lead } = req.query;

    const conditions = [];
    const params = [];

    if (isAdmin) {
      if (collaborator_id) { params.push(collaborator_id); conditions.push(`sa.collaborator_id = $${params.length}`); }
    } else {
      params.push(req.user.id);
      conditions.push(`sa.collaborator_id = $${params.length}`);
    }
    if (reference_month) { params.push(reference_month); conditions.push(`sa.reference_month = $${params.length}`); }
    if (tipo)             { params.push(tipo);             conditions.push(`sa.tipo = $${params.length}`); }
    if (status_lead)      { params.push(status_lead);      conditions.push(`sa.status_lead = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(
      `SELECT sa.*, p.name AS contabilidade_name, p.code AS contabilidade_code
       FROM sales_activities sa
       LEFT JOIN partners p ON p.id = sa.contabilidade_id
       ${where}
       ORDER BY sa.data_atividade DESC, sa.id DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar atividades' });
  }
}

async function getActivity(req, res) {
  try {
    const { id } = req.params;
    const isAdmin = !!req.user?.is_admin;

    const result = await db.query('SELECT * FROM sales_activities WHERE id = $1', [id]);
    const activity = result.rows[0];
    if (!activity) return res.status(404).json({ error: 'Atividade não encontrada' });
    if (!isAdmin && activity.collaborator_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta atividade' });
    }
    return res.json(activity);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar atividade' });
  }
}

async function createActivity(req, res) {
  try {
    const {
      data_atividade, tipo, contabilidade_id, contato_nome,
      observacoes, proximo_passo, data_proximo_passo, status_lead,
    } = req.body;

    if (!tipo || !['visita', 'ligacao', 'whatsapp', 'reuniao'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo deve ser visita, ligacao, whatsapp ou reuniao' });
    }
    if (!observacoes) {
      return res.status(400).json({ error: 'observacoes é obrigatório' });
    }

    const collaboratorId = req.user.id;
    const dataAtividade   = data_atividade || new Date().toISOString().slice(0, 10);
    const referenceMonth  = monthFromDate(dataAtividade);

    const result = await db.query(
      `INSERT INTO sales_activities
         (collaborator_id, data_atividade, tipo, contabilidade_id, contato_nome,
          observacoes, proximo_passo, data_proximo_passo, status_lead, reference_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        collaboratorId, dataAtividade, tipo, contabilidade_id || null, contato_nome || null,
        observacoes, proximo_passo || null, data_proximo_passo || null,
        status_lead || 'morno', referenceMonth,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar atividade' });
  }
}

async function updateActivity(req, res) {
  try {
    const { id } = req.params;
    const {
      data_atividade, tipo, contabilidade_id, contato_nome,
      observacoes, proximo_passo, data_proximo_passo, status_lead,
    } = req.body;

    const check = await db.query('SELECT * FROM sales_activities WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Atividade não encontrada' });
    if (check.rows[0].collaborator_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta atividade' });
    }

    const dataAtividade  = data_atividade || check.rows[0].data_atividade;
    const referenceMonth = monthFromDate(dataAtividade);

    const result = await db.query(
      `UPDATE sales_activities SET
         data_atividade     = $1,
         tipo               = $2,
         contabilidade_id   = $3,
         contato_nome       = $4,
         observacoes        = $5,
         proximo_passo      = $6,
         data_proximo_passo = $7,
         status_lead        = $8,
         reference_month    = $9
       WHERE id = $10
       RETURNING *`,
      [
        dataAtividade,
        tipo || check.rows[0].tipo,
        contabilidade_id !== undefined ? contabilidade_id : check.rows[0].contabilidade_id,
        contato_nome !== undefined ? contato_nome : check.rows[0].contato_nome,
        observacoes || check.rows[0].observacoes,
        proximo_passo !== undefined ? proximo_passo : check.rows[0].proximo_passo,
        data_proximo_passo !== undefined ? data_proximo_passo : check.rows[0].data_proximo_passo,
        status_lead || check.rows[0].status_lead,
        referenceMonth,
        id,
      ]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar atividade' });
  }
}

async function deleteActivity(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM sales_activities WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Atividade não encontrada' });
    if (check.rows[0].collaborator_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado a esta atividade' });
    }
    await db.query('DELETE FROM sales_activities WHERE id = $1', [id]);
    return res.json({ message: 'Atividade excluída com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir atividade' });
  }
}

module.exports = {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
};
