const db = require('../config/database');

async function listCommissions(req, res) {
  try {
    const { month, status } = req.query;
    let query = `
      SELECT c.*, p.name AS partner_name, p.code AS partner_code,
             r.protocol, r.client_name, pr.name AS product_name
      FROM commissions c
      JOIN partners p ON p.id = c.partner_id
      JOIN referrals r ON r.id = c.referral_id
      JOIN products pr ON pr.id = r.product_id
      WHERE 1=1
    `;
    const params = [];

    if (!req.user.is_admin) {
      params.push(req.user.id);
      query += ` AND c.partner_id = $${params.length}`;
    }
    if (month) {
      params.push(month);
      query += ` AND c.reference_month = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    query += ' ORDER BY c.created_at DESC';

    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getStatement(req, res) {
  try {
    const partnerId = req.user.is_admin ? (req.query.partner_id || req.user.id) : req.user.id;
    const result = await db.query(
      `SELECT
         c.reference_month,
         pr.name AS product_name,
         r.protocol,
         r.client_name,
         r.operated_value,
         c.amount,
         c.type,
         c.status,
         c.created_at
       FROM commissions c
       JOIN referrals r ON r.id = c.referral_id
       JOIN products pr ON pr.id = r.product_id
       WHERE c.partner_id = $1
       ORDER BY c.created_at DESC`,
      [partnerId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getSummaryByMonth(req, res) {
  try {
    const partnerId = req.user.is_admin ? (req.query.partner_id || req.user.id) : req.user.id;
    const result = await db.query(
      `SELECT reference_month, SUM(amount) AS total, status, COUNT(*) AS count
       FROM commissions
       WHERE partner_id = $1
       GROUP BY reference_month, status
       ORDER BY reference_month DESC`,
      [partnerId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function approveCommissions(req, res) {
  const { commission_ids } = req.body;
  if (!commission_ids?.length) return res.status(400).json({ error: 'IDs obrigatórios' });
  try {
    await db.query(
      `UPDATE commissions SET status='approved' WHERE id = ANY($1) AND status='pending'`,
      [commission_ids]
    );
    return res.json({ message: 'Comissões aprovadas' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { listCommissions, getStatement, getSummaryByMonth, approveCommissions };
