const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

async function generateEmployeeCode() {
  const countResult = await db.query("SELECT COUNT(*) FROM partners WHERE type = 'employee'");
  const count = parseInt(countResult.rows[0].count) + 1;
  return `FUNC-IT-CS-${String(count).padStart(3, '0')}`;
}

async function listEmployees(req, res) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const result = await db.query(
      `SELECT p.id, p.code, p.name, p.email, p.whatsapp, p.pix_key, p.is_active, p.created_at,
              COUNT(DISTINCT r.id)::int AS total_referrals,
              COUNT(DISTINCT CASE WHEN c.reference_month = $2 THEN r.id END)::int AS month_referrals,
              COALESCE(SUM(CASE WHEN c.status != 'paid' THEN c.amount ELSE 0 END), 0)::float AS pending_balance
       FROM partners p
       LEFT JOIN referrals r ON r.partner_id = p.id
       LEFT JOIN commissions c ON c.referral_id = r.id
       WHERE p.parent_id = $1 AND p.type = 'employee'
       GROUP BY p.id
       ORDER BY p.name`,
      [req.user.id, currentMonth]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createEmployee(req, res) {
  const { name, email, whatsapp, pix_key } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios' });
  }
  try {
    const code = await generateEmployeeCode();
    const password = generatePassword();
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, parent_id)
       VALUES ($1,$2,$3,$4,'employee',$5,$6,$7)
       RETURNING id, code, name, email, type, whatsapp, pix_key, is_active, created_at`,
      [code, name, email, hash, whatsapp || null, pix_key || null, req.user.id]
    );
    const employee = result.rows[0];
    emailService.enviarCredenciais({
      nome: employee.name,
      email: employee.email,
      codigoAcesso: password,
      whatsapp: employee.whatsapp,
    }).catch(err => console.error('[EMAIL]', err.message));
    return res.status(201).json({ ...employee, plain_password: password });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function updateEmployee(req, res) {
  const { name, email, whatsapp, pix_key } = req.body;
  try {
    const own = await db.query(
      `SELECT id FROM partners WHERE id = $1 AND parent_id = $2 AND type = 'employee'`,
      [req.params.id, req.user.id]
    );
    if (!own.rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });

    const result = await db.query(
      `UPDATE partners SET name=$1, email=$2, whatsapp=$3, pix_key=$4
       WHERE id=$5 RETURNING id, code, name, email, whatsapp, pix_key, is_active`,
      [name, email, whatsapp || null, pix_key || null, req.params.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function toggleEmployee(req, res) {
  try {
    const own = await db.query(
      `SELECT id, is_active FROM partners WHERE id = $1 AND parent_id = $2 AND type = 'employee'`,
      [req.params.id, req.user.id]
    );
    if (!own.rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });

    const newActive = !own.rows[0].is_active;
    await db.query('UPDATE partners SET is_active = $1 WHERE id = $2', [newActive, req.params.id]);
    return res.json({ is_active: newActive });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function resendCredentials(req, res) {
  try {
    const own = await db.query(
      `SELECT id, code, name, email, whatsapp FROM partners WHERE id = $1 AND parent_id = $2 AND type = 'employee'`,
      [req.params.id, req.user.id]
    );
    if (!own.rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });

    const employee = own.rows[0];
    const password = generatePassword();
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE partners SET password_hash = $1 WHERE id = $2', [hash, employee.id]);

    emailService.enviarCredenciais({
      nome: employee.name,
      email: employee.email,
      codigoAcesso: password,
      whatsapp: employee.whatsapp,
    }).catch(err => console.error('[EMAIL]', err.message));

    return res.json({
      code: employee.code,
      name: employee.name,
      email: employee.email,
      plain_password: password,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { listEmployees, createEmployee, updateEmployee, toggleEmployee, resendCredentials };
