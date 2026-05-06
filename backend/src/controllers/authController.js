const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function login(req, res) {
  const { code, password } = req.body;
  if (!code || !password) {
    return res.status(400).json({ error: 'Código e senha são obrigatórios' });
  }

  try {
    const result = await db.query(
      `SELECT p.*, pp.code AS parent_code, pp.name AS parent_name
       FROM partners p
       LEFT JOIN partners pp ON pp.id = p.parent_id
       WHERE p.code = $1 AND p.is_active = true`,
      [code.toUpperCase()]
    );
    const partner = result.rows[0];
    if (!partner) {
      return res.status(401).json({ error: 'Código ou senha inválidos' });
    }

    const valid = await bcrypt.compare(password, partner.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Código ou senha inválidos' });
    }

    const token = jwt.sign(
      { id: partner.id, code: partner.code, is_admin: partner.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, ...safe } = partner;
    return res.json({ token, partner: safe });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function me(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id, p.code, p.name, p.email, p.type, p.whatsapp, p.pix_key,
              p.is_admin, p.is_active, p.created_at,
              pp.code AS parent_code, pp.name AS parent_name
       FROM partners p
       LEFT JOIN partners pp ON pp.id = p.parent_id
       WHERE p.id = $1`,
      [req.user.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  try {
    const result = await db.query('SELECT password_hash FROM partners WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE partners SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    return res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { login, me, changePassword };
