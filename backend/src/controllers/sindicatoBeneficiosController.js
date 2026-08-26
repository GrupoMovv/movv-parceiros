const db = require('../config/database');
const { montarLinkWhatsapp } = require('../utils/whatsapp');

// ─── Colaboradores ───────────────────────────────────────────────────────────

async function listColaboradores(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { search } = req.query;

    const where = ['c.ativo = true'];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.nome ILIKE $${params.length} OR c.whatsapp ILIKE $${params.length} OR e.nome_fantasia ILIKE $${params.length} OR e.razao_social ILIKE $${params.length})`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM sindicato_colaboradores c
       LEFT JOIN sindicato_empresas e ON e.id = c.empresa_id
       ${whereSql}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT c.*, e.nome_fantasia AS empresa_nome,
              (SELECT MAX(created_at) FROM sindicato_envios se WHERE se.colaborador_id = c.id) AS ultima_mensagem
       FROM sindicato_colaboradores c
       LEFT JOIN sindicato_empresas e ON e.id = c.empresa_id
       ${whereSql}
       ORDER BY c.nome ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar colaboradores' });
  }
}

async function createColaborador(req, res) {
  try {
    const { nome, whatsapp, empresa_id, observacoes } = req.body;
    if (!nome || !whatsapp) {
      return res.status(400).json({ error: 'nome e whatsapp são obrigatórios' });
    }
    const cadastradoPorId = req.user?.type === 'internal' ? req.user.id : null;
    const result = await db.query(
      `INSERT INTO sindicato_colaboradores (nome, whatsapp, empresa_id, observacoes, cadastrado_por_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nome, whatsapp, empresa_id || null, observacoes || null, cadastradoPorId]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cadastrar colaborador' });
  }
}

async function updateColaborador(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM sindicato_colaboradores WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado' });

    const { nome, whatsapp, empresa_id, observacoes } = req.body;
    const result = await db.query(
      `UPDATE sindicato_colaboradores SET
         nome        = COALESCE($1, nome),
         whatsapp    = COALESCE($2, whatsapp),
         empresa_id  = $3,
         observacoes = COALESCE($4, observacoes),
         updated_at  = NOW()
       WHERE id = $5
       RETURNING *`,
      [nome, whatsapp, empresa_id !== undefined ? empresa_id : null, observacoes, id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar colaborador' });
  }
}

async function deleteColaborador(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE sindicato_colaboradores SET ativo = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado' });
    return res.json({ message: 'Colaborador removido com sucesso' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover colaborador' });
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

async function listTemplates(req, res) {
  try {
    const isAdmin = !!req.user?.is_admin;
    const result = await db.query(
      isAdmin
        ? 'SELECT * FROM sindicato_mensagens_template ORDER BY titulo ASC'
        : 'SELECT * FROM sindicato_mensagens_template WHERE ativo = true ORDER BY titulo ASC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar templates' });
  }
}

async function createTemplate(req, res) {
  try {
    const { tipo, titulo, conteudo, ativo } = req.body;
    if (!tipo || !titulo || !conteudo) {
      return res.status(400).json({ error: 'tipo, titulo e conteudo são obrigatórios' });
    }
    const result = await db.query(
      `INSERT INTO sindicato_mensagens_template (tipo, titulo, conteudo, ativo)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tipo, titulo, conteudo, ativo !== undefined ? ativo : true]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar template' });
  }
}

async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM sindicato_mensagens_template WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Template não encontrado' });

    const { tipo, titulo, conteudo, ativo } = req.body;
    const result = await db.query(
      `UPDATE sindicato_mensagens_template SET
         tipo       = COALESCE($1, tipo),
         titulo     = COALESCE($2, titulo),
         conteudo   = COALESCE($3, conteudo),
         ativo      = COALESCE($4, ativo),
         updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [tipo, titulo, conteudo, ativo, id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar template' });
  }
}

// ─── Envio ───────────────────────────────────────────────────────────────────

async function buscarColaboradorAtivo(id) {
  const result = await db.query('SELECT * FROM sindicato_colaboradores WHERE id = $1 AND ativo = true', [id]);
  return result.rows[0] || null;
}

async function buscarTemplate(id) {
  const result = await db.query('SELECT * FROM sindicato_mensagens_template WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function registrarEnvio({ colaborador, template, mensagem, enviadoPorId }) {
  const result = await db.query(
    `INSERT INTO sindicato_envios (colaborador_id, template_id, enviado_por_id, telefone_usado, mensagem_enviada)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [colaborador.id, template ? template.id : null, enviadoPorId, colaborador.whatsapp, mensagem]
  );
  return result.rows[0];
}

async function enviar(req, res) {
  try {
    const { colaborador_id, template_id, mensagem_custom } = req.body;
    if (!colaborador_id || (!template_id && !mensagem_custom)) {
      return res.status(400).json({ error: 'colaborador_id e (template_id ou mensagem_custom) são obrigatórios' });
    }

    const colaborador = await buscarColaboradorAtivo(colaborador_id);
    if (!colaborador) return res.status(404).json({ error: 'Colaborador não encontrado' });

    let template = null;
    if (template_id) {
      template = await buscarTemplate(template_id);
      if (!template) return res.status(404).json({ error: 'Template não encontrado' });
    }
    const mensagem = mensagem_custom || template.conteudo;
    const enviadoPorId = req.user?.type === 'internal' ? req.user.id : null;

    const envio = await registrarEnvio({ colaborador, template, mensagem, enviadoPorId });

    return res.status(201).json({ envio, whatsapp_link: montarLinkWhatsapp(colaborador.whatsapp, mensagem) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}

async function enviarMassa(req, res) {
  try {
    const { colaborador_ids, template_id } = req.body;
    if (!Array.isArray(colaborador_ids) || colaborador_ids.length === 0 || !template_id) {
      return res.status(400).json({ error: 'colaborador_ids (array) e template_id são obrigatórios' });
    }

    const template = await buscarTemplate(template_id);
    if (!template) return res.status(404).json({ error: 'Template não encontrado' });

    const enviadoPorId = req.user?.type === 'internal' ? req.user.id : null;
    const links = [];
    const erros = [];

    for (const colaboradorId of colaborador_ids) {
      const colaborador = await buscarColaboradorAtivo(colaboradorId);
      if (!colaborador) { erros.push({ colaborador_id: colaboradorId, error: 'não encontrado' }); continue; }

      const envio = await registrarEnvio({ colaborador, template, mensagem: template.conteudo, enviadoPorId });
      links.push({
        colaborador_id: colaborador.id,
        nome: colaborador.nome,
        telefone: colaborador.whatsapp,
        envio_id: envio.id,
        whatsapp_link: montarLinkWhatsapp(colaborador.whatsapp, template.conteudo),
      });
    }

    return res.status(201).json({ links, erros });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar em massa' });
  }
}

module.exports = {
  listColaboradores,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  listTemplates,
  createTemplate,
  updateTemplate,
  enviar,
  enviarMassa,
};
