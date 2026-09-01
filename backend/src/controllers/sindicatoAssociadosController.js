const db = require('../config/database');

const CAMPOS_UPDATE = [
  'nome_completo', 'cpf', 'data_nascimento', 'sexo', 'categoria_profissional',
  'codigo_filiado', 'celular', 'whatsapp', 'email', 'cidade', 'estado', 'observacoes',
  'dependentes_gerar_carteirinha',
];

const GRAUS_VALIDOS = ['conjuge', 'filho', 'filha'];

// Aceita tanto string simples (nome) quanto objeto { nome, grau, data_nascimento }
// pra manter compatibilidade com o formato antigo (Portal de Associados, fase A).
//
// Upsert por (associado_id, ordem) em vez de delete-then-insert: preserva a
// carteirinha_hash já gerada de um dependente quando só o nome/grau/nascimento
// mudou, pra não invalidar um QR que já pode ter sido compartilhado/impresso.
async function substituirDependentes(associadoId, dependentes) {
  if (!Array.isArray(dependentes)) return;

  const linhas = [];
  let ordem = 1;
  for (const dep of dependentes) {
    const obj = typeof dep === 'string' ? { nome: dep } : (dep || {});
    const nomeTrim = String(obj.nome || '').trim();
    if (!nomeTrim) continue;
    if (ordem > 6) break;
    const grau = GRAUS_VALIDOS.includes(obj.grau) ? obj.grau : null;
    linhas.push({ ordem, nome: nomeTrim, grau, data_nascimento: obj.data_nascimento || null });
    ordem++;
  }

  for (const l of linhas) {
    await db.query(
      `INSERT INTO sindicato_associados_dependentes (associado_id, nome, ordem, grau, data_nascimento)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (associado_id, ordem) DO UPDATE SET
         nome = EXCLUDED.nome, grau = EXCLUDED.grau, data_nascimento = EXCLUDED.data_nascimento`,
      [associadoId, l.nome, l.ordem, l.grau, l.data_nascimento]
    );
  }

  // remove slots que sobraram de uma lista anterior maior (dependente removido no formulário)
  await db.query(
    'DELETE FROM sindicato_associados_dependentes WHERE associado_id = $1 AND ordem > $2',
    [associadoId, linhas.length]
  );
}

async function listAssociados(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { search, categoria, status, whatsapp, empresa_id, carteirinha } = req.query;

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(a.nome_completo ILIKE $${params.length} OR a.cpf ILIKE $${params.length} OR a.codigo_filiado ILIKE $${params.length})`);
    }
    if (categoria) {
      params.push(categoria);
      where.push(`a.categoria_profissional = $${params.length}`);
    }
    if (status === 'ativo') where.push('a.ativo = true');
    else if (status === 'inativo') where.push('a.ativo = false');

    if (whatsapp === 'com') where.push('a.whatsapp IS NOT NULL');
    else if (whatsapp === 'sem') where.push('a.whatsapp IS NULL');

    if (empresa_id) {
      params.push(empresa_id);
      where.push(`a.empresa_id = $${params.length}`);
    }

    if (carteirinha === 'nao_gerada') where.push('a.carteirinha_hash IS NULL');
    else if (carteirinha === 'vencendo') where.push(`a.carteirinha_valida_ate IS NOT NULL AND a.carteirinha_valida_ate >= CURRENT_DATE AND a.carteirinha_valida_ate < CURRENT_DATE + INTERVAL '15 days'`);
    else if (carteirinha === 'vencida') where.push('a.carteirinha_valida_ate IS NOT NULL AND a.carteirinha_valida_ate < CURRENT_DATE');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const fromSql = `FROM sindicato_associados a LEFT JOIN sindicato_empresas e ON e.id = a.empresa_id`;

    const totalResult = await db.query(
      `SELECT COUNT(*)::int AS total ${fromSql} ${whereSql}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT a.*, e.nome_fantasia AS empresa_nome
       ${fromSql}
       ${whereSql}
       ORDER BY a.nome_completo ASC
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
         COUNT(*) FILTER (WHERE ativo AND whatsapp IS NULL)::int AS sem_wpp,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_hash IS NULL)::int AS carteirinha_nao_gerada,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_valida_ate >= CURRENT_DATE AND carteirinha_valida_ate < CURRENT_DATE + INTERVAL '15 days')::int AS carteirinha_vencendo,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_valida_ate < CURRENT_DATE)::int AS carteirinha_vencida
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
    const associadoResult = await db.query(
      `SELECT a.*, e.nome_fantasia AS empresa_nome
       FROM sindicato_associados a
       LEFT JOIN sindicato_empresas e ON e.id = a.empresa_id
       WHERE a.id = $1`,
      [id]
    );
    if (!associadoResult.rows[0]) return res.status(404).json({ error: 'Associado não encontrado' });

    const depResult = await db.query(
      `SELECT id, nome, ordem, grau, data_nascimento, foto_url, carteirinha_hash, carteirinha_valida_ate
       FROM sindicato_associados_dependentes WHERE associado_id = $1 ORDER BY ordem ASC`,
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

async function uploadFotoDependente(req, res) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de foto' });

    const check = await db.query('SELECT id FROM sindicato_associados_dependentes WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Dependente não encontrado' });

    const urlArquivo = `/uploads/dependentes/${req.file.filename}`;
    const uploadedPorId = req.user?.type === 'internal' ? req.user.id : null;

    await db.query('UPDATE sindicato_associados_dependentes SET foto_url = $1 WHERE id = $2', [urlArquivo, id]);
    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (dependente_id, tipo_dono, url_arquivo, uploaded_por_id)
       VALUES ($1, 'dependente', $2, $3)`,
      [id, urlArquivo, uploadedPorId]
    );

    return res.json({ foto_url: urlArquivo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar foto' });
  }
}

module.exports = {
  listAssociados,
  stats,
  getAssociado,
  createAssociado,
  updateAssociado,
  updateStatus,
  uploadFotoDependente,
  // exposto pro autocadastro público (publicCadastroController) reaproveitar
  // a mesma lógica de upsert-por-ordem dos dependentes.
  substituirDependentes,
};
