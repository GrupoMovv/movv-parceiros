const db = require('../config/database');

const CAMPOS_UPDATE = [
  'nome_completo', 'cpf', 'data_nascimento', 'sexo', 'categoria_profissional',
  'codigo_filiado', 'celular', 'whatsapp', 'email', 'cidade', 'estado', 'observacoes',
];

async function substituirDependentes(associadoId, dependentes) {
  await db.query('DELETE FROM sindicato_associados_dependentes WHERE associado_id = $1', [associadoId]);
  if (!Array.isArray(dependentes)) return;
  let ordem = 1;
  for (const nome of dependentes) {
    const nomeTrim = String(nome || '').trim();
    if (!nomeTrim) continue;
    if (ordem > 6) break;
    await db.query(
      `INSERT INTO sindicato_associados_dependentes (associado_id, nome, ordem) VALUES ($1, $2, $3)`,
      [associadoId, nomeTrim, ordem]
    );
    ordem++;
  }
}

async function listAssociados(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { search, categoria, status, whatsapp } = req.query;

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(nome_completo ILIKE $${params.length} OR cpf ILIKE $${params.length} OR codigo_filiado ILIKE $${params.length})`);
    }
    if (categoria) {
      params.push(categoria);
      where.push(`categoria_profissional = $${params.length}`);
    }
    if (status === 'ativo') where.push('ativo = true');
    else if (status === 'inativo') where.push('ativo = false');

    if (whatsapp === 'com') where.push('whatsapp IS NOT NULL');
    else if (whatsapp === 'sem') where.push('whatsapp IS NULL');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM sindicato_associados ${whereSql}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT * FROM sindicato_associados
       ${whereSql}
       ORDER BY nome_completo ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar associados' });
  }
}

async function stats(req, res) {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE ativo)::int AS ativos,
         COUNT(*) FILTER (WHERE ativo AND whatsapp IS NOT NULL)::int AS com_wpp,
         COUNT(*) FILTER (WHERE ativo AND whatsapp IS NULL)::int AS sem_wpp
       FROM sindicato_associados`
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

async function getAssociado(req, res) {
  try {
    const { id } = req.params;
    const associadoResult = await db.query('SELECT * FROM sindicato_associados WHERE id = $1', [id]);
    if (!associadoResult.rows[0]) return res.status(404).json({ error: 'Associado não encontrado' });

    const depResult = await db.query(
      'SELECT id, nome, ordem FROM sindicato_associados_dependentes WHERE associado_id = $1 ORDER BY ordem ASC',
      [id]
    );

    return res.json({ ...associadoResult.rows[0], dependentes: depResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar associado' });
  }
}

async function createAssociado(req, res) {
  try {
    const { nome_completo, cpf, dependentes, ...resto } = req.body;
    if (!nome_completo || !cpf) {
      return res.status(400).json({ error: 'nome_completo e cpf são obrigatórios' });
    }

    const cadastradoPorId = req.user?.type === 'internal' ? req.user.id : null;
    const externalId = `MANUAL-${Date.now()}`;

    const result = await db.query(
      `INSERT INTO sindicato_associados
         (external_id, nome_completo, cpf, data_nascimento, sexo, categoria_profissional,
          codigo_filiado, celular, whatsapp, email, cidade, estado, observacoes, cadastrado_por_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        externalId, nome_completo, cpf,
        resto.data_nascimento || null, resto.sexo || null, resto.categoria_profissional || null,
        resto.codigo_filiado || null, resto.celular || null, resto.whatsapp || null,
        resto.email || null, resto.cidade || null, resto.estado || null, resto.observacoes || null,
        cadastradoPorId,
      ]
    );

    const associado = result.rows[0];
    await substituirDependentes(associado.id, dependentes);

    return res.status(201).json(associado);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um associado com esse CPF' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cadastrar associado' });
  }
}

async function updateAssociado(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM sindicato_associados WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Associado não encontrado' });

    const { dependentes, ...body } = req.body;
    const sets = [];
    const params = [];
    for (const campo of CAMPOS_UPDATE) {
      if (body[campo] === undefined) continue;
      params.push(body[campo] === '' ? null : body[campo]);
      sets.push(`${campo} = $${params.length}`);
    }
    if (!sets.length && dependentes === undefined) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    let associado;
    if (sets.length) {
      params.push(id);
      const result = await db.query(
        `UPDATE sindicato_associados SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params
      );
      associado = result.rows[0];
    }

    if (dependentes !== undefined) {
      await substituirDependentes(id, dependentes);
    }

    if (!associado) {
      const result = await db.query('SELECT * FROM sindicato_associados WHERE id = $1', [id]);
      associado = result.rows[0];
    }

    return res.json(associado);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um associado com esse CPF' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar associado' });
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ error: 'ativo (boolean) é obrigatório' });
    }
    const result = await db.query(
      'UPDATE sindicato_associados SET ativo = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [ativo, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Associado não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar status' });
  }
}

module.exports = {
  listAssociados,
  stats,
  getAssociado,
  createAssociado,
  updateAssociado,
  updateStatus,
};
