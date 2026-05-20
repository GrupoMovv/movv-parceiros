const db = require('../config/database');
const { calcPabline, calcFernando, CURVA_PABLINE, CURVA_FERNANDO_AZUL, NET_FACTOR } = require('../services/internalCommissionService');

// ─── Admin: listar colaboradores ────────────────────────────────────────────
async function listCollaborators(req, res) {
  try {
    const result = await db.query(
      `SELECT ic.*,
              COUNT(cm.id)                                   AS commission_count,
              COALESCE(SUM(CASE WHEN cm.status = 'paid' THEN cm.total_amount END), 0) AS total_paid,
              COALESCE(SUM(CASE WHEN cm.status = 'pending' THEN cm.total_amount END), 0) AS total_pending
       FROM internal_collaborators ic
       LEFT JOIN internal_commissions cm ON cm.collaborator_id = ic.id
       WHERE ic.active = true
       GROUP BY ic.id
       ORDER BY ic.id`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar colaboradores' });
  }
}

// ─── Admin: preview de cálculo antes de salvar ──────────────────────────────
async function previewCommission(req, res) {
  try {
    const { collaborator_id, azul_revenue, base_via_accounting, base_via_direct, cert_count } = req.body;

    const collab = await db.query(
      'SELECT id, role FROM internal_collaborators WHERE id = $1 AND active = true',
      [collaborator_id]
    );
    if (!collab.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado' });

    const { role } = collab.rows[0];
    let calc;
    if (role === 'manager_azul') {
      calc = calcPabline({ azulRevenue: azul_revenue || 0 });
    } else {
      calc = calcFernando({
        azulRevenue:        azul_revenue        || 0,
        baseViaAccounting:  base_via_accounting || 0,
        baseViaDirect:      base_via_direct     || 0,
        certCount:          cert_count          || 0,
      });
    }

    return res.json({
      ...calc,
      net_revenue: parseFloat(azul_revenue || 0) * NET_FACTOR,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no preview' });
  }
}

// ─── Admin: lançar comissão do mês ──────────────────────────────────────────
async function createCommission(req, res) {
  try {
    const {
      collaborator_id, month,
      azul_revenue,
      base_via_accounting, base_via_direct, cert_count,
      notes,
    } = req.body;

    if (!collaborator_id || !month) {
      return res.status(400).json({ error: 'Colaborador e mês são obrigatórios' });
    }

    const collab = await db.query(
      'SELECT id, role FROM internal_collaborators WHERE id = $1 AND active = true',
      [collaborator_id]
    );
    if (!collab.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado' });

    const { role } = collab.rows[0];
    let calc;
    if (role === 'manager_azul') {
      calc = calcPabline({ azulRevenue: azul_revenue || 0 });
    } else {
      calc = calcFernando({
        azulRevenue:       azul_revenue        || 0,
        baseViaAccounting: base_via_accounting || 0,
        baseViaDirect:     base_via_direct     || 0,
        certCount:         cert_count          || 0,
      });
    }

    // Bloqueia lançamento sobre mês já pago
    const existing = await db.query(
      'SELECT status FROM internal_commissions WHERE collaborator_id = $1 AND month = $2',
      [collaborator_id, month]
    );
    if (existing.rows[0]?.status === 'paid') {
      return res.status(403).json({ error: 'Este mês já foi marcado como pago. Estorne o pagamento antes de relançar.' });
    }

    const result = await db.query(
      `INSERT INTO internal_commissions
         (collaborator_id, month, azul_revenue, azul_commission_pct, azul_commission,
          direta_certificates_count, direta_via_accounting, direta_via_direct, direta_commission,
          base_salary, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (collaborator_id, month) DO UPDATE SET
         azul_revenue              = EXCLUDED.azul_revenue,
         azul_commission_pct       = EXCLUDED.azul_commission_pct,
         azul_commission           = EXCLUDED.azul_commission,
         direta_certificates_count = EXCLUDED.direta_certificates_count,
         direta_via_accounting     = EXCLUDED.direta_via_accounting,
         direta_via_direct         = EXCLUDED.direta_via_direct,
         direta_commission         = EXCLUDED.direta_commission,
         base_salary               = EXCLUDED.base_salary,
         total_amount              = EXCLUDED.total_amount,
         notes                     = EXCLUDED.notes
       RETURNING *`,
      [
        collaborator_id, month,
        azul_revenue || 0,
        calc.azul_commission_pct,
        calc.azul_commission,
        calc.direta_certificates_count,
        calc.direta_via_accounting,
        calc.direta_via_direct,
        calc.direta_commission,
        calc.base_salary,
        calc.total_amount,
        notes || null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao lançar comissão' });
  }
}

// ─── Admin: marcar como pago ────────────────────────────────────────────────
async function markAsPaid(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE internal_commissions
       SET status = 'paid', paid_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao marcar como pago' });
  }
}

// ─── Admin: reverter para pendente ─────────────────────────────────────────
async function revertToPending(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE internal_commissions
       SET status = 'pending', paid_at = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    console.log(`[ESTORNO] ${new Date().toISOString()} — comissão ID ${id} (${result.rows[0].month}) estornada para pendente`);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao estornar' });
  }
}

// ─── Admin: editar comissão existente ──────────────────────────────────────
async function updateCommission(req, res) {
  try {
    const { id } = req.params;
    const { month, azul_revenue, base_via_accounting, base_via_direct, cert_count, notes } = req.body;

    const check = await db.query('SELECT * FROM internal_commissions WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status === 'paid') {
      return res.status(403).json({ error: 'Não é possível editar uma comissão já paga. Estorne o pagamento primeiro.' });
    }

    const collab = await db.query(
      'SELECT id, role FROM internal_collaborators WHERE id = $1',
      [check.rows[0].collaborator_id]
    );
    const { role } = collab.rows[0];

    let calc;
    if (role === 'manager_azul') {
      calc = calcPabline({ azulRevenue: azul_revenue || 0 });
    } else {
      calc = calcFernando({
        azulRevenue:       azul_revenue        || 0,
        baseViaAccounting: base_via_accounting || 0,
        baseViaDirect:     base_via_direct     || 0,
        certCount:         cert_count          || 0,
      });
    }

    const result = await db.query(
      `UPDATE internal_commissions SET
         month                     = $1,
         azul_revenue              = $2,
         azul_commission_pct       = $3,
         azul_commission           = $4,
         direta_certificates_count = $5,
         direta_via_accounting     = $6,
         direta_via_direct         = $7,
         direta_commission         = $8,
         base_salary               = $9,
         total_amount              = $10,
         notes                     = $11
       WHERE id = $12
       RETURNING *`,
      [
        month || check.rows[0].month,
        azul_revenue || 0,
        calc.azul_commission_pct,
        calc.azul_commission,
        calc.direta_certificates_count,
        calc.direta_via_accounting,
        calc.direta_via_direct,
        calc.direta_commission,
        calc.base_salary,
        calc.total_amount,
        notes !== undefined ? notes : check.rows[0].notes,
        id,
      ]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar comissão' });
  }
}

// ─── Admin: excluir comissão (apenas pendente) ──────────────────────────────
async function deleteCommission(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM internal_commissions WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    if (check.rows[0].status === 'paid') {
      return res.status(403).json({ error: 'Não é possível excluir uma comissão já paga. Estorne o pagamento primeiro.' });
    }
    await db.query('DELETE FROM internal_commissions WHERE id = $1', [id]);
    console.log(`[DELETE] ${new Date().toISOString()} — comissão ID ${id} (${check.rows[0].month}) excluída`);
    return res.json({ message: 'Comissão excluída com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir comissão' });
  }
}

// ─── Admin: listar todas as comissões (com filtros) ─────────────────────────
async function listAllCommissions(req, res) {
  try {
    const { month, collaborator_id, status } = req.query;
    const conditions = [];
    const params = [];

    if (month)           { params.push(month);           conditions.push(`cm.month = $${params.length}`); }
    if (collaborator_id) { params.push(collaborator_id); conditions.push(`cm.collaborator_id = $${params.length}`); }
    if (status)          { params.push(status);          conditions.push(`cm.status = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(
      `SELECT cm.*, ic.name AS collaborator_name, ic.role AS collaborator_role, ic.pix_key
       FROM internal_commissions cm
       JOIN internal_collaborators ic ON ic.id = cm.collaborator_id
       ${where}
       ORDER BY cm.month DESC, ic.id`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar comissões' });
  }
}

// ─── Colaborador: suas próprias comissões ───────────────────────────────────
async function myCommissions(req, res) {
  try {
    const result = await db.query(
      `SELECT * FROM internal_commissions
       WHERE collaborator_id = $1
       ORDER BY month DESC
       LIMIT 24`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar comissões' });
  }
}

// ─── Colaborador: resumo do mês atual ───────────────────────────────────────
async function mySummary(req, res) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [current, allTime] = await Promise.all([
      db.query(
        'SELECT * FROM internal_commissions WHERE collaborator_id = $1 AND month = $2',
        [req.user.id, currentMonth]
      ),
      db.query(
        `SELECT
           COALESCE(SUM(total_amount), 0) AS total_12m,
           COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount END), 0) AS total_paid,
           COUNT(*) AS months_count
         FROM internal_commissions
         WHERE collaborator_id = $1
           AND month >= to_char(NOW() - INTERVAL '11 months', 'YYYY-MM')`,
        [req.user.id]
      ),
    ]);

    return res.json({
      current_month: current.rows[0] || null,
      total_12m:     parseFloat(allTime.rows[0].total_12m),
      total_paid:    parseFloat(allTime.rows[0].total_paid),
      months_count:  parseInt(allTime.rows[0].months_count),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar resumo' });
  }
}

// ─── Curvas de comissão (público para colaboradores autenticados) ────────────
function getCurves(req, res) {
  return res.json({ CURVA_PABLINE, CURVA_FERNANDO_AZUL, NET_FACTOR });
}

module.exports = {
  listCollaborators,
  previewCommission,
  createCommission,
  updateCommission,
  deleteCommission,
  markAsPaid,
  revertToPending,
  listAllCommissions,
  myCommissions,
  mySummary,
  getCurves,
};
