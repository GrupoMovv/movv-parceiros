const db = require('../config/database');

function generateExternalId() {
  return `MANUAL-${Date.now()}`;
}

function formatValor(valor) {
  return parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatData(dataVencimento) {
  const [ano, mes, dia] = String(dataVencimento).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function montarMensagem(numeroGuia, valor, dataVencimento) {
  return `Olá! Passando para lembrar da Guia Assistencial em aberto:

📋 Guia: ${numeroGuia}
💰 Valor: R$ ${formatValor(valor)}
📅 Vencimento: ${formatData(dataVencimento)}

Qualquer dúvida, estamos à disposição.

Sindicato — Itumbiara/GO`;
}

function montarLinkWhatsapp(telefone, mensagem) {
  const digits = String(telefone || '').replace(/\D/g, '');
  return `https://wa.me/55${digits}?text=${encodeURIComponent(mensagem)}`;
}

// ─── Contabilidades ──────────────────────────────────────────────────────────

async function listContabilidades(req, res) {
  try {
    const result = await db.query(
      `SELECT c.*, COUNT(e.id)::int AS total_empresas
       FROM sindicato_contabilidades c
       LEFT JOIN sindicato_empresas e ON e.contabilidade_id = c.id
       GROUP BY c.id
       ORDER BY total_empresas DESC, c.nome_fantasia ASC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar contabilidades' });
  }
}

async function listEmpresasDaContabilidade(req, res) {
  try {
    const { id } = req.params;
    const { search } = req.query;
    const params = [id];
    let where = 'WHERE e.contabilidade_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (e.nome_fantasia ILIKE $2 OR e.razao_social ILIKE $2)`;
    }
    const result = await db.query(
      `SELECT e.* FROM sindicato_empresas e ${where} ORDER BY e.nome_fantasia ASC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar empresas da contabilidade' });
  }
}

async function createContabilidade(req, res) {
  try {
    const { razao_social, nome_fantasia, cnpj, endereco, bairro, cidade, estado, cep, telefone, celular, email, status } = req.body;
    if (!razao_social) {
      return res.status(400).json({ error: 'razao_social é obrigatório' });
    }
    const result = await db.query(
      `INSERT INTO sindicato_contabilidades
         (external_id, razao_social, nome_fantasia, cnpj, endereco, bairro, cidade, estado, cep, telefone, celular, email, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [generateExternalId(), razao_social, nome_fantasia || null, cnpj || null, endereco || null, bairro || null,
       cidade || null, estado || null, cep || null, telefone || null, celular || null, email || null, status || 'Ativo']
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar contabilidade' });
  }
}

// ─── Empresas ────────────────────────────────────────────────────────────────

async function getEmpresa(req, res) {
  try {
    const { id } = req.params;
    const empresaResult = await db.query(
      `SELECT e.*, c.nome_fantasia AS contabilidade_nome, c.razao_social AS contabilidade_razao_social
       FROM sindicato_empresas e
       LEFT JOIN sindicato_contabilidades c ON c.id = e.contabilidade_id
       WHERE e.id = $1`,
      [id]
    );
    if (!empresaResult.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada' });

    const cobrancasResult = await db.query(
      `SELECT * FROM sindicato_cobrancas WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    return res.json({ ...empresaResult.rows[0], cobrancas: cobrancasResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar empresa' });
  }
}

async function createEmpresa(req, res) {
  try {
    const {
      razao_social, nome_fantasia, cnpj, cnae, endereco, complemento, bairro, cidade, estado, cep,
      telefone, celular, email, whatsapp, status, porte, categoria, contabilidade_id,
    } = req.body;
    if (!razao_social) {
      return res.status(400).json({ error: 'razao_social é obrigatório' });
    }
    const result = await db.query(
      `INSERT INTO sindicato_empresas
         (external_id, razao_social, nome_fantasia, cnpj, cnae, endereco, complemento, bairro, cidade, estado, cep,
          telefone, celular, email, whatsapp, status, porte, categoria, contabilidade_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [generateExternalId(), razao_social, nome_fantasia || null, cnpj || null, cnae || null, endereco || null,
       complemento || null, bairro || null, cidade || null, estado || null, cep || null, telefone || null,
       celular || null, email || null, whatsapp || null, status || 'Ativo', porte || null, categoria || null,
       contabilidade_id || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar empresa' });
  }
}

async function updateEmpresa(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query('SELECT id FROM sindicato_empresas WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada' });

    const {
      razao_social, nome_fantasia, cnpj, cnae, endereco, complemento, bairro, cidade, estado, cep,
      telefone, celular, email, whatsapp, status, porte, categoria, contabilidade_id,
    } = req.body;

    const result = await db.query(
      `UPDATE sindicato_empresas SET
         razao_social     = COALESCE($1, razao_social),
         nome_fantasia    = COALESCE($2, nome_fantasia),
         cnpj             = COALESCE($3, cnpj),
         cnae             = COALESCE($4, cnae),
         endereco         = COALESCE($5, endereco),
         complemento      = COALESCE($6, complemento),
         bairro           = COALESCE($7, bairro),
         cidade           = COALESCE($8, cidade),
         estado           = COALESCE($9, estado),
         cep              = COALESCE($10, cep),
         telefone         = COALESCE($11, telefone),
         celular          = COALESCE($12, celular),
         email            = COALESCE($13, email),
         whatsapp         = COALESCE($14, whatsapp),
         status           = COALESCE($15, status),
         porte            = COALESCE($16, porte),
         categoria        = COALESCE($17, categoria),
         contabilidade_id = COALESCE($18, contabilidade_id),
         updated_at       = NOW()
       WHERE id = $19
       RETURNING *`,
      [razao_social, nome_fantasia, cnpj, cnae, endereco, complemento, bairro, cidade, estado, cep,
       telefone, celular, email, whatsapp, status, porte, categoria, contabilidade_id, id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
}

async function updateWhatsapp(req, res) {
  try {
    const { id } = req.params;
    const { whatsapp } = req.body;
    if (!whatsapp) return res.status(400).json({ error: 'whatsapp é obrigatório' });

    const result = await db.query(
      `UPDATE sindicato_empresas SET whatsapp = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [whatsapp, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar WhatsApp' });
  }
}

// ─── Cobranças ───────────────────────────────────────────────────────────────

async function registrarCobranca(req, res) {
  try {
    const { empresa_id, numero_guia, valor, data_vencimento } = req.body;
    if (!empresa_id || !numero_guia || valor === undefined || !data_vencimento) {
      return res.status(400).json({ error: 'empresa_id, numero_guia, valor e data_vencimento são obrigatórios' });
    }

    const empresaResult = await db.query('SELECT * FROM sindicato_empresas WHERE id = $1', [empresa_id]);
    const empresa = empresaResult.rows[0];
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!empresa.whatsapp) {
      return res.status(400).json({ error: 'Cadastre o WhatsApp da empresa antes de gerar a cobrança' });
    }

    const mensagem = montarMensagem(numero_guia, valor, data_vencimento);
    const enviadoPorId = req.user?.type === 'internal' ? req.user.id : null;

    const result = await db.query(
      `INSERT INTO sindicato_cobrancas (empresa_id, enviado_por_id, numero_guia, valor, data_vencimento, mensagem_gerada, telefone_usado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [empresa_id, enviadoPorId, numero_guia, valor, data_vencimento, mensagem, empresa.whatsapp]
    );

    return res.status(201).json({
      cobranca: result.rows[0],
      whatsapp_link: montarLinkWhatsapp(empresa.whatsapp, mensagem),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar cobrança' });
  }
}

module.exports = {
  listContabilidades,
  listEmpresasDaContabilidade,
  createContabilidade,
  getEmpresa,
  createEmpresa,
  updateEmpresa,
  updateWhatsapp,
  registrarCobranca,
};
