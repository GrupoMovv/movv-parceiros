const db = require('../config/database');

// Lista todas as contabilidades (partners type='accounting'), com preço se já cadastrado
async function listPrecos(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id AS partner_id, p.code, p.name,
              cp.id, cp.preco_certificado, cp.ativo, cp.observacoes,
              cp.created_at, cp.updated_at
       FROM partners p
       LEFT JOIN contabilidades_precos cp ON cp.partner_id = p.id
       WHERE p.type = 'accounting'
       ORDER BY p.name`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar preços de contabilidades' });
  }
}

async function getPreco(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT cp.*, p.name AS partner_name, p.code AS partner_code
       FROM contabilidades_precos cp
       JOIN partners p ON p.id = cp.partner_id
       WHERE cp.id = $1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Preço não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar preço' });
  }
}

async function createPreco(req, res) {
  try {
    const { partner_id, preco_certificado, observacoes } = req.body;
    if (!partner_id || preco_certificado === undefined) {
      return res.status(400).json({ error: 'partner_id e preco_certificado são obrigatórios' });
    }

    const partner = await db.query(
      `SELECT id FROM partners WHERE id = $1 AND type = 'accounting'`,
      [partner_id]
    );
    if (!partner.rows[0]) return res.status(404).json({ error: 'Contabilidade não encontrada' });

    const existing = await db.query(
      'SELECT id FROM contabilidades_precos WHERE partner_id = $1',
      [partner_id]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Esta contabilidade já tem preço cadastrado. Edite o preço existente.' });
    }

    const result = await db.query(
      `INSERT INTO contabilidades_precos (partner_id, preco_certificado, observacoes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [partner_id, preco_certificado, observacoes || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cadastrar preço' });
  }
}

async function updatePreco(req, res) {
  try {
    const { id } = req.params;
    const { preco_certificado, ativo, observacoes } = req.body;

    const check = await db.query('SELECT * FROM contabilidades_precos WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Preço não encontrado' });

    const result = await db.query(
      `UPDATE contabilidades_precos SET
         preco_certificado = $1,
         ativo             = $2,
         observacoes        = $3,
         updated_at         = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        preco_certificado !== undefined ? preco_certificado : check.rows[0].preco_certificado,
        ativo !== undefined ? ativo : check.rows[0].ativo,
        observacoes !== undefined ? observacoes : check.rows[0].observacoes,
        id,
      ]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar preço' });
  }
}

async function deletePreco(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT * FROM contabilidades_precos WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Preço não encontrado' });

    await db.query('DELETE FROM contabilidades_precos WHERE id = $1', [id]);
    return res.json({ message: 'Preço excluído com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir preço' });
  }
}

module.exports = {
  listPrecos,
  getPreco,
  createPreco,
  updatePreco,
  deletePreco,
};
