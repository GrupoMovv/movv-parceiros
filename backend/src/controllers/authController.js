const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function login(req, res) {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identificador e senha são obrigatórios' });
  }

  const raw        = identifier.trim();
  const asEmail    = raw.toLowerCase();
  const asWhatsapp = raw.replace(/\D/g, '');

  try {
    // 1. Tenta colaborador interno (email ou whatsapp)
    const internalResult = await db.query(
      `SELECT * FROM internal_collaborators
       WHERE (email = $1 OR ($2 <> '' AND whatsapp = $2))
         AND active = true
       LIMIT 1`,
      [asEmail, asWhatsapp]
    );
    const internalUser = internalResult.rows[0];

    if (internalUser) {
      const valid = await bcrypt.compare(password, internalUser.password_hash);
      if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

      const token = jwt.sign(
        { id: internalUser.id, userType: 'internal', role: internalUser.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const { password_hash, ...safe } = internalUser;
      return res.json({ token, partner: { ...safe, type: 'internal', is_admin: false, code: null } });
    }

    // 2. Tenta parceiro (código, email ou whatsapp)
    const asCode = raw.toUpperCase();
    const partnerResult = await db.query(
      `SELECT p.*, pp.code AS parent_code, pp.name AS parent_name
       FROM partners p
       LEFT JOIN partners pp ON pp.id = p.parent_id
       WHERE (p.code = $1 OR p.email = $2 OR ($3 <> '' AND p.whatsapp = $3))
         AND p.is_active = true
       LIMIT 1`,
      [asCode, asEmail, asWhatsapp]
    );
    const partner = partnerResult.rows[0];

    if (partner) {
      const valid = await bcrypt.compare(password, partner.password_hash);
      if (!valid) return res.status(401).json({ error: 'Código ou senha inválidos' });

      const token = jwt.sign(
        { id: partner.id, userType: 'partner', code: partner.code, is_admin: partner.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const { password_hash, ...safe } = partner;
      return res.json({ token, partner: safe });
    }

    // 3. Tenta indicador (CPF sem máscara, email ou whatsapp)
    const asCpf = raw.replace(/\D/g, '');
    const indicatorResult = await db.query(
      `SELECT * FROM indicators WHERE (cpf = $1 OR email = $2 OR ($3 <> '' AND whatsapp = $3)) AND status = 'approved' LIMIT 1`,
      [asCpf, asEmail, asWhatsapp]
    );
    const indicator = indicatorResult.rows[0];
    if (indicator) {
      const valid = await bcrypt.compare(password, indicator.password_hash);
      if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
      const token = jwt.sign(
        { id: indicator.id, userType: 'indicator' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      const { password_hash, ...safe } = indicator;
      return res.json({ token, partner: { ...safe, type: 'indicator', is_admin: false, code: null } });
    }

    return res.status(401).json({ error: 'Credenciais inválidas' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function me(req, res) {
  try {
    if (req.user.type === 'internal') {
      const result = await db.query(
        'SELECT id, name, email, role, whatsapp, pix_key, base_salary, active, created_at, must_change_password FROM internal_collaborators WHERE id = $1',
        [req.user.id]
      );
      const u = result.rows[0];
      return res.json({ ...u, type: 'internal', is_admin: false, code: null });
    }

    if (req.user.type === 'indicator') {
      const result = await db.query(
        'SELECT id, name, cpf, email, whatsapp, pix_key, pix_key_type, status, total_indications, total_commissions, total_paid, pending_amount, created_at FROM indicators WHERE id = $1',
        [req.user.id]
      );
      return res.json({ ...result.rows[0], type: 'indicator', is_admin: false, code: null });
    }

    const result = await db.query(
      `SELECT p.id, p.code, p.name, p.email, p.type, p.whatsapp, p.pix_key,
              p.is_admin, p.is_active, p.created_at, p.must_change_password,
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
    if (req.user.type === 'internal') {
      const result = await db.query('SELECT password_hash FROM internal_collaborators WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
      const hash = await bcrypt.hash(newPassword, 10);
      await db.query('UPDATE internal_collaborators SET password_hash = $1, must_change_password = false WHERE id = $2', [hash, req.user.id]);
    } else {
      const result = await db.query('SELECT password_hash FROM partners WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
      const hash = await bcrypt.hash(newPassword, 10);
      await db.query('UPDATE partners SET password_hash = $1, must_change_password = false WHERE id = $2', [hash, req.user.id]);
    }
    return res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function forceChangePassword(req, res) {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    if (req.user.type === 'internal') {
      await db.query(
        'UPDATE internal_collaborators SET password_hash = $1, must_change_password = false WHERE id = $2',
        [hash, req.user.id]
      );
    } else {
      await db.query(
        'UPDATE partners SET password_hash = $1, must_change_password = false WHERE id = $2',
        [hash, req.user.id]
      );
    }
    return res.json({ message: 'Senha definida com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { login, me, changePassword, forceChangePassword };
