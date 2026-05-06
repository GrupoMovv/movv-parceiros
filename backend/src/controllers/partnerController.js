const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function listPartners(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id, p.code, p.name, p.email, p.type, p.whatsapp, p.pix_key,
              p.is_admin, p.is_active, p.created_at,
              pp.name AS parent_name, pp.code AS parent_code,
              COUNT(r.id) AS total_referrals,
              COALESCE(SUM(CASE WHEN c.status != 'paid' THEN c.amount ELSE 0 END), 0) AS pending_balance
       FROM partners p
       LEFT JOIN partners pp ON pp.id = p.parent_id
       LEFT JOIN referrals r ON r.partner_id = p.id
       LEFT JOIN commissions c ON c.partner_id = p.id
       GROUP BY p.id, pp.name, pp.code
       ORDER BY p.created_at DESC`,
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getPartner(req, res) {
  try {
    const result = await db.query(
      `SELECT p.*, pp.name AS parent_name, pp.code AS parent_code
       FROM partners p
       LEFT JOIN partners pp ON pp.id = p.parent_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const { password_hash, ...safe } = result.rows[0];
    return res.json(safe);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createPartner(req, res) {
  const { name, email, type, whatsapp, pix_key, parent_id, password, is_admin } = req.body;
  if (!name || !email || !type || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, tipo, senha' });
  }

  try {
    const countResult = await db.query(
      "SELECT COUNT(*) FROM partners WHERE type = $1",
      [type]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const paddedCount = String(count).padStart(3, '0');
    let code;
    if (type === 'accounting') {
      code = `CONT-IT-${paddedCount}`;
    } else {
      code = `FUNC-IT-CS-${paddedCount}`;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, parent_id, is_admin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, code, name, email, type, whatsapp, pix_key, is_admin, is_active, created_at`,
      [code, name, email, hash, type, whatsapp, pix_key, parent_id || null, is_admin || false]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function updatePartner(req, res) {
  const { name, email, whatsapp, pix_key, parent_id, is_active } = req.body;
  try {
    const result = await db.query(
      `UPDATE partners SET name=$1, email=$2, whatsapp=$3, pix_key=$4, parent_id=$5, is_active=$6
       WHERE id=$7 RETURNING id, code, name, email, type, whatsapp, pix_key, is_active`,
      [name, email, whatsapp, pix_key, parent_id || null, is_active ?? true, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function resetPassword(req, res) {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE partners SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    return res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getMyStats(req, res) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [referrals, commissions, monthComm] = await Promise.all([
      db.query('SELECT COUNT(*) FROM referrals WHERE partner_id = $1', [req.user.id]),
      db.query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM commissions WHERE partner_id = $1 AND status != 'paid'",
        [req.user.id]
      ),
      db.query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM commissions WHERE partner_id = $1 AND reference_month = $2",
        [req.user.id, currentMonth]
      ),
    ]);

    const totalReferrals = parseInt(referrals.rows[0].count);
    let tier = 'Bronze';
    if (totalReferrals >= 20) tier = 'Diamante';
    else if (totalReferrals >= 10) tier = 'Ouro';
    else if (totalReferrals >= 5) tier = 'Prata';

    return res.json({
      pending_balance: parseFloat(commissions.rows[0].total),
      month_earnings: parseFloat(monthComm.rows[0].total),
      total_referrals: totalReferrals,
      tier,
      next_payment_day: 5,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { listPartners, getPartner, createPartner, updatePartner, resetPassword, getMyStats };
