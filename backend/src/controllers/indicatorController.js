const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');

const AZUL_PRODUCTS = [
  { name: 'Cartão Benefício INSS',     category: 'alta',  pct: 0.01  },
  { name: 'Antecipação FGTS',          category: 'alta',  pct: 0.01  },
  { name: 'Seguros',                   category: 'alta',  pct: 0.01  },
  { name: 'Consignado INSS Novo',      category: 'alta',  pct: 0.01  },
  { name: 'Crédito Pessoal',           category: 'alta',  pct: 0.01  },
  { name: 'Empr. Cartão de Crédito',   category: 'alta',  pct: 0.01  },
  { name: 'Consignado Servidor',       category: 'media', pct: 0.007 },
  { name: 'Consignado CLT',            category: 'media', pct: 0.007 },
  { name: 'Empresas Privadas',         category: 'media', pct: 0.007 },
  { name: 'Energia',                   category: 'media', pct: 0.007 },
  { name: 'Energia Solar',             category: 'media', pct: 0.007 },
  { name: 'Crédito Salário BB',        category: 'media', pct: 0.007 },
  { name: 'Portabilidade INSS',        category: 'baixa', pct: 0.002 },
  { name: 'Refinanciamento INSS',      category: 'baixa', pct: 0.002 },
  { name: 'Forças Armadas',            category: 'baixa', pct: 0.002 },
  { name: 'Consórcio',                 category: 'baixa', pct: 0.002 },
  { name: 'Financiamento Veículo',     category: 'baixa', pct: 0.002 },
  { name: 'Financiamento Imobiliário', category: 'baixa', pct: 0.002 },
  { name: 'Refi Imóvel/Veículo',       category: 'baixa', pct: 0.002 },
  { name: 'Crédito PJ',               category: 'baixa', pct: 0.002 },
];

// POST /api/indicators/register — público
async function register(req, res) {
  const { name, cpf, email, whatsapp, pix_key, pix_key_type, password } = req.body;
  const cleanCpf = (cpf || '').replace(/\D/g, '');

  if (!name || !cleanCpf || !whatsapp || !pix_key || !pix_key_type || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, CPF, WhatsApp, chave PIX, tipo da chave e senha.' });
  }

  try {
    const existing = await db.query('SELECT id FROM indicators WHERE cpf = $1', [cleanCpf]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Já existe um cadastro com este CPF.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO indicators (name, cpf, email, whatsapp, pix_key, pix_key_type, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [name, cleanCpf, email || null, whatsapp, pix_key, pix_key_type, password_hash]
    );

    try {
      await emailService.enviarNovoIndicadorAdmin({ nome: name, cpf: cleanCpf, whatsapp, email: email || '' });
    } catch (e) {
      console.error('[EMAIL] Falha ao notificar admin:', e.message);
    }

    return res.status(201).json({ message: 'Cadastro enviado! Aguarde aprovação.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators — admin
async function listIndicators(req, res) {
  const { status } = req.query;
  try {
    let sql = 'SELECT id, name, cpf, email, whatsapp, pix_key, pix_key_type, status, approved_at, rejection_reason, total_indications, total_commissions, total_paid, pending_amount, created_at FROM indicators';
    const params = [];
    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await db.query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/:id — admin
async function getIndicatorById(req, res) {
  try {
    const result = await db.query(
      'SELECT id, name, cpf, email, whatsapp, pix_key, pix_key_type, status, approved_at, approved_by, rejection_reason, total_indications, total_commissions, total_paid, pending_amount, created_at FROM indicators WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Indicador não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/:id/approve — admin
async function approveIndicator(req, res) {
  try {
    const result = await db.query(
      `UPDATE indicators SET status = 'approved', approved_at = NOW(), approved_by = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Indicador não encontrado' });
    const ind = result.rows[0];

    if (ind.email) {
      try {
        await emailService.enviarAprovacaoIndicador({ nome: ind.name, email: ind.email });
      } catch (e) {
        console.error('[EMAIL] Falha ao enviar aprovação:', e.message);
      }
    }

    const { password_hash, ...safe } = ind;
    return res.json(safe);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/:id/reject — admin
async function rejectIndicator(req, res) {
  const { rejection_reason } = req.body;
  try {
    const result = await db.query(
      `UPDATE indicators SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, name, cpf, email, whatsapp, status, rejection_reason, created_at`,
      [rejection_reason || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Indicador não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/:id/suspend — admin
async function suspendIndicator(req, res) {
  try {
    const result = await db.query(
      `UPDATE indicators SET status = 'suspended', updated_at = NOW()
       WHERE id = $1 RETURNING id, name, cpf, email, whatsapp, status, created_at`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Indicador não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/me — indicator auth
async function getMe(req, res) {
  try {
    const result = await db.query(
      'SELECT id, name, cpf, email, whatsapp, pix_key, pix_key_type, status, total_indications, total_commissions, total_paid, pending_amount, created_at FROM indicators WHERE id = $1',
      [req.user.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/me — indicator auth
async function updateMe(req, res) {
  const { name, email, whatsapp, pix_key, pix_key_type } = req.body;
  try {
    const result = await db.query(
      `UPDATE indicators SET name = COALESCE($1, name), email = $2, whatsapp = COALESCE($3, whatsapp),
       pix_key = COALESCE($4, pix_key), pix_key_type = COALESCE($5, pix_key_type), updated_at = NOW()
       WHERE id = $6 RETURNING id, name, cpf, email, whatsapp, pix_key, pix_key_type, status`,
      [name, email || null, whatsapp, pix_key, pix_key_type, req.user.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/me/password — indicator auth
async function changeMyPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Dados inválidos. A nova senha deve ter no mínimo 6 caracteres.' });
  }
  try {
    const result = await db.query('SELECT password_hash FROM indicators WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE indicators SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    return res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/dashboard — indicator auth
async function getDashboard(req, res) {
  try {
    const statsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('pending','in_progress')) AS active_count,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COALESCE(SUM(commission_value) FILTER (WHERE status = 'approved'), 0) AS commission_approved
       FROM indicator_referrals WHERE indicator_id = $1`,
      [req.user.id]
    );
    const indResult = await db.query(
      'SELECT total_indications, total_commissions, total_paid, pending_amount FROM indicators WHERE id = $1',
      [req.user.id]
    );
    const recentResult = await db.query(
      `SELECT id, client_name, client_cpf, product_name, status, commission_value, estimated_value, created_at, expires_at
       FROM indicator_referrals WHERE indicator_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [req.user.id]
    );

    const stats = statsResult.rows[0];
    const ind = indResult.rows[0];

    return res.json({
      total_indications: ind.total_indications,
      pending_count: parseInt(stats.pending_count) || 0,
      active_count: parseInt(stats.active_count) || 0,
      approved_count: parseInt(stats.approved_count) || 0,
      commission_pending: parseFloat(ind.pending_amount) || 0,
      commission_received: parseFloat(ind.total_paid) || 0,
      recent_referrals: recentResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// POST /api/indicators/referrals — indicator auth
async function createReferral(req, res) {
  const { client_name, client_cpf, client_whatsapp, client_email, product_name, product_category, estimated_value, notes } = req.body;
  const cleanCpf = (client_cpf || '').replace(/\D/g, '');

  if (!client_name || !cleanCpf || !client_whatsapp || !product_name) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome do cliente, CPF, WhatsApp e produto.' });
  }

  try {
    const dupResult = await db.query(
      `SELECT id FROM indicator_referrals
       WHERE client_cpf = $1 AND product_name = $2 AND status IN ('pending','in_progress')`,
      [cleanCpf, product_name]
    );
    if (dupResult.rows[0]) {
      return res.status(409).json({ error: 'Este cliente já tem indicação ativa para este produto.' });
    }

    const product = AZUL_PRODUCTS.find(p => p.name === product_name);
    const pct = product ? product.pct : null;
    const commissionValue = (estimated_value && pct) ? parseFloat(estimated_value) * pct : null;

    const result = await db.query(
      `INSERT INTO indicator_referrals
       (indicator_id, client_name, client_cpf, client_whatsapp, client_email, product_name, product_category,
        estimated_value, commission_pct, commission_value, notes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '10 days')
       RETURNING *`,
      [req.user.id, client_name, cleanCpf, client_whatsapp, client_email || null,
       product_name, product_category || null, estimated_value || null, pct, commissionValue, notes || null]
    );

    await db.query(
      'UPDATE indicators SET total_indications = total_indications + 1, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/referrals — indicator auth
async function listMyReferrals(req, res) {
  const { status } = req.query;
  try {
    let sql = 'SELECT * FROM indicator_referrals WHERE indicator_id = $1';
    const params = [req.user.id];
    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await db.query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/referrals/:id/renew — indicator auth
async function renewReferral(req, res) {
  try {
    const result = await db.query(
      `UPDATE indicator_referrals
       SET expires_at = NOW() + INTERVAL '10 days', renewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND indicator_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Indicação não encontrada ou não pode ser renovada.' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/products — público ou indicator auth
async function getProducts(req, res) {
  return res.json(AZUL_PRODUCTS);
}

// GET /api/indicators/payments — admin
async function listAdminPayments(req, res) {
  try {
    const result = await db.query(
      `SELECT ip.*, i.name AS indicator_name, i.cpf AS indicator_cpf, i.email AS indicator_email
       FROM indicator_payments ip
       JOIN indicators i ON i.id = ip.indicator_id
       ORDER BY ip.created_at DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// POST /api/indicators/payments — admin
async function createPayment(req, res) {
  const { indicator_id, referral_ids, total_amount, pix_key, pix_key_type, notes } = req.body;
  if (!indicator_id || !total_amount || !pix_key) {
    return res.status(400).json({ error: 'Campos obrigatórios: indicator_id, total_amount, pix_key.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO indicator_payments (indicator_id, referral_ids, total_amount, pix_key, pix_key_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [indicator_id, referral_ids || [], total_amount, pix_key, pix_key_type || null, notes || null]
    );
    await db.query(
      'UPDATE indicators SET pending_amount = GREATEST(0, pending_amount - $1), updated_at = NOW() WHERE id = $2',
      [total_amount, indicator_id]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// PUT /api/indicators/payments/:id/pay — admin
async function markPaymentPaid(req, res) {
  try {
    const result = await db.query(
      `UPDATE indicator_payments SET status = 'paid', paid_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pagamento não encontrado' });
    const payment = result.rows[0];
    await db.query(
      'UPDATE indicators SET total_paid = total_paid + $1, updated_at = NOW() WHERE id = $2',
      [payment.total_amount, payment.indicator_id]
    );
    return res.json(payment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/payments/pending — admin
async function getPendingPayments(req, res) {
  try {
    const result = await db.query(
      `SELECT i.id, i.name, i.cpf, i.email, i.whatsapp, i.pix_key, i.pix_key_type, i.pending_amount,
              JSON_AGG(ir.*) FILTER (WHERE ir.id IS NOT NULL) AS referrals
       FROM indicators i
       LEFT JOIN indicator_referrals ir ON ir.indicator_id = i.id AND ir.status = 'approved'
         AND NOT EXISTS (
           SELECT 1 FROM indicator_payments ip
           WHERE ir.id = ANY(ip.referral_ids) AND ip.status = 'paid'
         )
       WHERE i.pending_amount >= 50 AND i.status = 'approved'
       GROUP BY i.id ORDER BY i.pending_amount DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// GET /api/indicators/my-payments — indicator auth
async function getMyPayments(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM indicator_payments WHERE indicator_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = {
  register,
  listIndicators,
  getIndicatorById,
  approveIndicator,
  rejectIndicator,
  suspendIndicator,
  getMe,
  updateMe,
  changeMyPassword,
  getDashboard,
  createReferral,
  listMyReferrals,
  renewReferral,
  getProducts,
  listAdminPayments,
  createPayment,
  markPaymentPaid,
  getPendingPayments,
  getMyPayments,
};
