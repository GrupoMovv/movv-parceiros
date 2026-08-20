const db = require('../config/database');

// Travas de preço no cadastro/edição do preço de certificado por contabilidade.
const PRECO_BLOQUEIO_MINIMO = 30.00; // abaixo disso: rejeita
const PRECO_ALERTA_MAXIMO   = 45.00; // [BLOQUEIO_MINIMO, ALERTA_MAXIMO): exige motivo; acima: livre

function validarPrecoContabilidade(preco) {
  const p = parseFloat(preco);
  if (isNaN(p) || p < PRECO_BLOQUEIO_MINIMO) {
    return { bloqueado: true, precisaMotivo: false, erro: `Preço não pode ser menor que R$ ${PRECO_BLOQUEIO_MINIMO.toFixed(2)}.` };
  }
  if (p < PRECO_ALERTA_MAXIMO) {
    return { bloqueado: false, precisaMotivo: true, erro: null };
  }
  return { bloqueado: false, precisaMotivo: false, erro: null };
}

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
    const { partner_id, preco_certificado, observacoes, motivo_preco_reduzido } = req.body;
    if (!partner_id || preco_certificado === undefined) {
      return res.status(400).json({ error: 'partner_id e preco_certificado são obrigatórios' });
    }

    const { bloqueado, precisaMotivo, erro } = validarPrecoContabilidade(preco_certificado);
    if (bloqueado) return res.status(400).json({ error: erro });
    if (precisaMotivo && !motivo_preco_reduzido?.trim()) {
      return res.status(400).json({
        error: `Motivo do preço reduzido é obrigatório para preços entre R$ ${PRECO_BLOQUEIO_MINIMO.toFixed(2)} e R$ ${PRECO_ALERTA_MAXIMO.toFixed(2)}.`,
      });
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

    const observacoesFinal = precisaMotivo && motivo_preco_reduzido?.trim()
      ? `[Preço reduzido] ${motivo_preco_reduzido.trim()}${observacoes ? '\n' + observacoes : ''}`
      : (observacoes || null);

    const result = await db.query(
      `INSERT INTO contabilidades_precos (partner_id, preco_certificado, observacoes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [partner_id, preco_certificado, observacoesFinal]
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
    const { preco_certificado, ativo, observacoes, motivo_preco_reduzido } = req.body;

    const check = await db.query('SELECT * FROM contabilidades_precos WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Preço não encontrado' });

    let observacoesFinal = observacoes !== undefined ? observacoes : check.rows[0].observacoes;

    // Só re-valida a trava de preço quando o preço está de fato sendo alterado
    // (evita bloquear um simples toggle de ativo/inativo).
    if (preco_certificado !== undefined) {
      const { bloqueado, precisaMotivo, erro } = validarPrecoContabilidade(preco_certificado);
      if (bloqueado) return res.status(400).json({ error: erro });
      if (precisaMotivo && !motivo_preco_reduzido?.trim()) {
        return res.status(400).json({
          error: `Motivo do preço reduzido é obrigatório para preços entre R$ ${PRECO_BLOQUEIO_MINIMO.toFixed(2)} e R$ ${PRECO_ALERTA_MAXIMO.toFixed(2)}.`,
        });
      }
      if (precisaMotivo && motivo_preco_reduzido?.trim()) {
        observacoesFinal = `[Preço reduzido] ${motivo_preco_reduzido.trim()}${observacoes ? '\n' + observacoes : ''}`;
      }
    }

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
        observacoesFinal,
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
