const db = require('../config/database');

async function listProducts(req, res) {
  try {
    const result = await db.query(
      `SELECT * FROM products
       ORDER BY
         CASE faixa WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baixa' THEN 3 WHEN 'especial' THEN 4 ELSE 5 END,
         name ASC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createProduct(req, res) {
  const { name, type, description, commission_rate, faixa, percentual_repasse } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  try {
    const result = await db.query(
      `INSERT INTO products (name, type, description, commission_rate, faixa, percentual_repasse)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, type, description, commission_rate || 0.01, faixa || 'media', percentual_repasse ?? commission_rate ?? 0.01]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function updateProduct(req, res) {
  const { name, type, description, commission_rate, faixa, percentual_repasse, is_active } = req.body;
  try {
    const result = await db.query(
      `UPDATE products
       SET name=$1, type=$2, description=$3, commission_rate=$4, faixa=$5, percentual_repasse=$6, is_active=$7
       WHERE id=$8 RETURNING *`,
      [name, type, description, commission_rate, faixa || 'media', percentual_repasse ?? commission_rate ?? 0.01, is_active ?? true, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function deleteProduct(req, res) {
  try {
    await db.query('UPDATE products SET is_active=false WHERE id=$1', [req.params.id]);
    return res.json({ message: 'Produto desativado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
