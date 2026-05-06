const db = require('../config/database');
const path = require('path');

async function listPayments(req, res) {
  try {
    const { partner_id, month } = req.query;
    let query = `
      SELECT pay.*, p.name AS partner_name, p.code AS partner_code, p.pix_key
      FROM payments pay
      JOIN partners p ON p.id = pay.partner_id
      WHERE 1=1
    `;
    const params = [];

    if (!req.user.is_admin) {
      params.push(req.user.id);
      query += ` AND pay.partner_id = $${params.length}`;
    } else if (partner_id) {
      params.push(partner_id);
      query += ` AND pay.partner_id = $${params.length}`;
    }
    if (month) {
      params.push(month);
      query += ` AND pay.reference_month = $${params.length}`;
    }
    query += ' ORDER BY pay.payment_date DESC';

    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function registerPayment(req, res) {
  const { partner_id, amount, payment_date, reference_month, commission_ids } = req.body;
  if (!partner_id || !amount || !reference_month) {
    return res.status(400).json({ error: 'Parceiro, valor e mês de referência são obrigatórios' });
  }

  const receiptFile = req.file ? req.file.filename : null;

  try {
    await db.query('BEGIN');
    const payResult = await db.query(
      `INSERT INTO payments (partner_id, amount, payment_date, reference_month, commission_ids, pix_receipt)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        partner_id,
        amount,
        payment_date || new Date().toISOString().slice(0, 10),
        reference_month,
        commission_ids || null,
        receiptFile,
      ]
    );

    if (commission_ids?.length) {
      await db.query(
        `UPDATE commissions SET status='paid' WHERE id = ANY($1) AND partner_id = $2`,
        [commission_ids, partner_id]
      );
    }
    await db.query('COMMIT');
    return res.status(201).json(payResult.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getPendingByPartner(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.code, p.pix_key,
              COALESCE(SUM(c.amount),0) AS pending_total,
              COUNT(c.id) AS commission_count,
              ARRAY_AGG(c.id) AS commission_ids
       FROM partners p
       LEFT JOIN commissions c ON c.partner_id = p.id AND c.status = 'approved'
       GROUP BY p.id
       HAVING COALESCE(SUM(c.amount),0) > 0
       ORDER BY pending_total DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { listPayments, registerPayment, getPendingByPartner };
