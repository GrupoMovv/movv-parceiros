const db = require('../config/database');
const { parseXlsxBuffer } = require('../services/contribuintesXlsxParser');
const { importarLista, normalizarCnpj, classificarStatus } = require('../services/contribuintesImportService');

async function listContribuintes(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { search, status } = req.query;

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(razao_social ILIKE $${params.length} OR nome_fantasia ILIKE $${params.length} OR cnpj ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_empresas_contribuintes ${whereSql}`, params);

    params.push(limit, offset);
    const dataResult = await db.query(
      `SELECT * FROM sindicato_empresas_contribuintes ${whereSql}
       ORDER BY razao_social ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar contribuintes' });
  }
}

async function stats(req, res) {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'adimplente')::int AS adimplentes,
         COUNT(*) FILTER (WHERE status = 'atrasada')::int AS atrasadas,
         COUNT(*) FILTER (WHERE status = 'inativa')::int AS inativas,
         MAX(ultima_atualizacao) AS ultima_atualizacao
       FROM sindicato_empresas_contribuintes`
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

// Preview: parseia a planilha e devolve o resumo (X novas, Y atualizadas, Z
// status mudou) SEM gravar nada — a lista parseada volta pro front, que a
// reenvia intacta em /confirmar (evita reprocessar upload duplicado).
async function uploadPreview(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo .xlsx' });

    const empresas = parseXlsxBuffer(req.file.buffer);
    if (empresas.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha válida encontrada na planilha' });
    }

    const cnpjs = empresas.map(e => normalizarCnpj(e.cnpj)).filter(Boolean);
    const existentesResult = await db.query(
      'SELECT cnpj, status FROM sindicato_empresas_contribuintes WHERE cnpj = ANY($1)',
      [cnpjs]
    );
    const statusAtualPorCnpj = Object.fromEntries(existentesResult.rows.map(r => [r.cnpj, r.status]));

    let novas = 0, atualizadas = 0, statusMudou = 0;
    for (const e of empresas) {
      const cnpj = normalizarCnpj(e.cnpj);
      const statusNovo = classificarStatus(e.meses_pagos);
      const statusAtual = statusAtualPorCnpj[cnpj];
      if (statusAtual === undefined) novas++;
      else {
        atualizadas++;
        if (statusAtual !== statusNovo) statusMudou++;
      }
    }

    return res.json({
      resumo: { novas, atualizadas, status_mudou: statusMudou, total_linhas: empresas.length },
      empresas,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Erro ao processar planilha' });
  }
}

async function confirmarImportacao(req, res) {
  try {
    const { empresas } = req.body;
    if (!Array.isArray(empresas) || empresas.length === 0) {
      return res.status(400).json({ error: 'empresas (array) é obrigatório' });
    }

    const resumo = await importarLista(empresas);
    const importadoPorId = req.user?.type === 'internal' ? req.user.id : null;

    await db.query(
      `INSERT INTO sindicato_contribuintes_importacoes
         (importado_por_id, novas, atualizadas, status_mudou, total_linhas)
       VALUES ($1, $2, $3, $4, $5)`,
      [importadoPorId, resumo.novas, resumo.atualizadas, resumo.status_mudou, resumo.total_linhas]
    );

    return res.status(201).json(resumo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao confirmar importação' });
  }
}

async function listImportacoes(req, res) {
  try {
    const result = await db.query(
      `SELECT i.*, c.name AS importado_por_nome
       FROM sindicato_contribuintes_importacoes i
       LEFT JOIN internal_collaborators c ON c.id = i.importado_por_id
       ORDER BY i.created_at DESC LIMIT 30`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar histórico' });
  }
}

module.exports = { listContribuintes, stats, uploadPreview, confirmarImportacao, listImportacoes };
