const db = require('../config/database');
const { generateProtocol, getExpirationDate } = require('../services/protocolService');
const { sendWhatsAppMessage, buildProtocolMessage } = require('../services/zapApiService');
const { calculateCommissions } = require('../services/commissionService');

async function listReferrals(req, res) {
  try {
    const { month, status } = req.query;
    let query = `
      SELECT r.*, p.name AS partner_name, p.code AS partner_code,
             pr.name AS product_name, pr.type AS product_type
      FROM referrals r
      JOIN partners p ON p.id = r.partner_id
      JOIN products pr ON pr.id = r.product_id
      WHERE 1=1
    `;
    const params = [];

    if (!req.user.is_admin) {
      params.push(req.user.id);
      query += ` AND r.partner_id = $${params.length}`;
    }
    if (month) {
      params.push(month);
      query += ` AND TO_CHAR(r.created_at,'YYYY-MM') = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    query += ' ORDER BY r.created_at DESC';

    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createReferral(req, res) {
  const { client_name, client_whatsapp, product_id } = req.body;
  if (!client_name || !client_whatsapp || !product_id) {
    return res.status(400).json({ error: 'Nome, WhatsApp e produto são obrigatórios' });
  }

  try {
    const productResult = await db.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [product_id]);
    if (!productResult.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    const product = productResult.rows[0];

    const protocol = await generateProtocol();
    const expiresAt = getExpirationDate();

    const result = await db.query(
      `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [protocol, req.user.id, client_name, client_whatsapp, product_id, expiresAt]
    );
    const referral = result.rows[0];

    const message = buildProtocolMessage(
      client_name, protocol, product.name, req.user.name, expiresAt
    );
    sendWhatsAppMessage(client_whatsapp, message).catch(() => {});

    return res.status(201).json({ ...referral, product_name: product.name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function confirmSale(req, res) {
  const { operated_value, bpo_month_count } = req.body;
  if (!operated_value || operated_value <= 0) {
    return res.status(400).json({ error: 'Valor operado inválido' });
  }

  try {
    const refResult = await db.query(
      `SELECT r.*, pr.type AS product_type, pr.name AS product_name,
              pr.percentual_repasse, pr.commission_rate,
              p.type AS partner_type, p.parent_id
       FROM referrals r
       JOIN products pr ON pr.id = r.product_id
       JOIN partners p ON p.id = r.partner_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!refResult.rows[0]) return res.status(404).json({ error: 'Indicação não encontrada' });
    const referral = refResult.rows[0];

    if (referral.status === 'converted') {
      return res.status(409).json({ error: 'Venda já confirmada' });
    }

    let parentPartner = null;
    if (referral.parent_id) {
      const parentResult = await db.query('SELECT * FROM partners WHERE id = $1', [referral.parent_id]);
      parentPartner = parentResult.rows[0];
    }

    const partner = { id: referral.partner_id, type: referral.partner_type, parent_id: referral.parent_id };
    const product = { type: referral.product_type, percentual_repasse: referral.percentual_repasse, commission_rate: referral.commission_rate };
    const commissions = calculateCommissions(product, operated_value, partner, parentPartner, bpo_month_count || 1);

    const currentMonth = new Date().toISOString().slice(0, 7);

    await db.query('BEGIN');
    await db.query(
      'UPDATE referrals SET status=$1, operated_value=$2 WHERE id=$3',
      ['converted', operated_value, referral.id]
    );
    for (const comm of commissions) {
      await db.query(
        `INSERT INTO commissions (referral_id, partner_id, amount, type, reference_month)
         VALUES ($1,$2,$3,$4,$5)`,
        [referral.id, comm.partner_id, comm.amount, comm.type, currentMonth]
      );
    }
    await db.query('COMMIT');

    return res.json({ message: 'Venda confirmada e comissões calculadas', commissions });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function expireOldReferrals(req, res) {
  try {
    const result = await db.query(
      `UPDATE referrals SET status='expired'
       WHERE status='pending' AND expires_at < NOW()
       RETURNING id, protocol`
    );
    return res.json({ expired: result.rows.length, protocols: result.rows.map(r => r.protocol) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { listReferrals, createReferral, confirmSale, expireOldReferrals };
