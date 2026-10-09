const bcrypt = require('bcryptjs');
const { ADMIN_PRINCIPAL, ehAdminPrincipal } = require('../config/adminPrincipal');
const db = require('../config/database');
const emailService = require('../services/emailService');
const { registrarTrocaPix } = require('../services/historicoPix');

async function listPartners(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id, p.code, p.name, p.email, p.type, p.whatsapp, p.pix_key,
              p.is_admin, p.perfil_admin, p.is_active, p.created_at,
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
  const isAdmin = !!req.user?.is_admin;
  let { name, email, type, whatsapp, pix_key, parent_id, password, is_admin } = req.body;

  if (!isAdmin) {
    // Fernando (comercial_full) e o perfil financeiro só cadastram contabilidades parceiras —
    // ignora qualquer type/is_admin/parent_id que venha no corpo da requisição.
    type = 'accounting';
    is_admin = false;
    parent_id = null;
  }

  if (!name || !email || !type || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, tipo, senha' });
  }
  if (is_admin && !ehAdminPrincipal(req.user)) {
    return res.status(403).json({ error: `Só o ${ADMIN_PRINCIPAL} cria contas de administrador.` });
  }

  try {
    const countResult = await db.query(
      "SELECT COUNT(*) FROM partners WHERE type = $1",
      [type]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const paddedCount = String(count).padStart(3, '0');
    let code;
    if (is_admin) {
      const n = (await db.query("SELECT COUNT(*)::int AS n FROM partners WHERE code LIKE 'ADMIN-%'")).rows[0].n + 1;
      code = `ADMIN-${String(n).padStart(3, '0')}`;
    } else if (type === 'accounting') {
      code = `CONT-IT-${paddedCount}`;
    } else {
      code = `FUNC-IT-CS-${paddedCount}`;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, parent_id, is_admin, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id, code, name, email, type, whatsapp, pix_key, is_admin, is_active, created_at`,
      // conta de admin nasce com senha provisória: troca obrigatória no 1º acesso
      [code, name, email, hash, type, whatsapp, pix_key, parent_id || null, Boolean(is_admin)]
    );
    const partner = result.rows[0];
    emailService.enviarCredenciais({
      nome: partner.name,
      email: partner.email,
      codigoAcesso: password,
      whatsapp: partner.whatsapp,
    }).catch(err => console.error('[EMAIL]', err.message));
    return res.status(201).json(partner);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Conta de outro admin: só o ADMIN-001 edita ou desativa (09/10).
async function protegerOutroAdmin(req, res, { soDono = false } = {}) {
  const alvo = (await db.query('SELECT id, is_admin FROM partners WHERE id = $1', [req.params.id])).rows[0];
  if (!alvo || !alvo.is_admin || alvo.id === req.user.id) return false;
  if (soDono) {
    res.status(403).json({ error: 'A senha de uma conta de administrador só o próprio dono troca.' });
    return true;
  }
  if (!ehAdminPrincipal(req.user)) {
    res.status(403).json({ error: `Só o ${ADMIN_PRINCIPAL} altera a conta de outro administrador.` });
    return true;
  }
  return false;
}

async function updatePartner(req, res) {
  const { name, email, whatsapp, pix_key, parent_id, is_active } = req.body;
  try {
    if (await protegerOutroAdmin(req, res)) return;
    // troca de chave PIX fica registrada (quem e quando), na mesma transação
    const linha = await db.transacao(async cx => {
      const antes = (await cx.query('SELECT pix_key FROM partners WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!antes) return null;
      const result = await cx.query(
        `UPDATE partners SET name=$1, email=$2, whatsapp=$3, pix_key=$4, parent_id=$5, is_active=$6
         WHERE id=$7 RETURNING id, code, name, email, type, whatsapp, pix_key, is_active`,
        [name, email, whatsapp, pix_key, parent_id || null, is_active ?? true, req.params.id]
      );
      await registrarTrocaPix(cx, Number(req.params.id), antes.pix_key, pix_key, req.user);
      return result.rows[0];
    });
    if (!linha) return res.status(404).json({ error: 'Parceiro não encontrado' });
    return res.json(linha);
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
    if (await protegerOutroAdmin(req, res, { soDono: true })) return;
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
