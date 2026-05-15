const db = require('../config/database');

async function registerInterest(req, res) {
  const { service } = req.body;
  if (!service || !['office', 'collections'].includes(service)) {
    return res.status(400).json({ error: 'Serviço inválido. Use "office" ou "collections".' });
  }
  try {
    const result = await db.query(
      `INSERT INTO interest_submissions (partner_id, service)
       VALUES ($1, $2)
       ON CONFLICT (partner_id, service) DO NOTHING
       RETURNING *`,
      [req.user.id, service]
    );
    if (!result.rows[0]) {
      return res.status(409).json({ error: 'Interesse já registrado para este serviço.' });
    }
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function listInterest(req, res) {
  const { status, service } = req.query;
  let query = `
    SELECT i.*, p.name AS partner_name, p.code AS partner_code,
           p.whatsapp AS partner_whatsapp, p.email AS partner_email
    FROM interest_submissions i
    JOIN partners p ON p.id = i.partner_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    params.push(status);
    query += ` AND i.status = $${params.length}`;
  }
  if (service) {
    params.push(service);
    query += ` AND i.service = $${params.length}`;
  }
  query += ' ORDER BY i.created_at DESC';

  try {
    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function updateInterest(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['novo', 'contactado', 'em_conversa', 'convertido', 'descartado'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const result = await db.query(
      `UPDATE interest_submissions
       SET status = $1,
           notes = COALESCE($2, notes),
           contacted_at = CASE WHEN $1 = 'contactado' AND contacted_at IS NULL THEN NOW() ELSE contacted_at END
       WHERE id = $3
       RETURNING *`,
      [status, notes ?? null, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Manifestação não encontrada.' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { registerInterest, listInterest, updateInterest };
