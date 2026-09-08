const db = require('../config/database');
const { parseXlsxBuffer } = require('../services/contribuintesXlsxParser');
const { parseRecebimentosBuffer } = require('../services/contribuintesRecebimentosParser');
const { importarLista, desativarAusentes, normalizarCnpj, classificarStatus } = require('../services/contribuintesImportService');

// O financeiro exporta dois formatos possíveis: o "Relatório de
// Recebimentos" bruto (1 linha por pagamento, com Referência/Exercício —
// o formato real usado hoje) ou uma planilha já agregada (1 linha por
// empresa, coluna "meses pagos" pronta — formato legado). Tenta o formato
// novo primeiro; se a planilha não tiver as colunas esperadas, cai pro
// parser antigo. Só o formato novo aciona a desativação de ausentes
// (a planilha agregada não necessariamente representa "todo mundo".
function parseArquivo(buffer) {
  try {
    const { empresas, tresMesesRecentes, linhasIgnoradasCpf } = parseRecebimentosBuffer(buffer);
    return { empresas, formato: 'recebimentos', tresMesesRecentes, linhasIgnoradasCpf };
  } catch {
    const empresas = parseXlsxBuffer(buffer);
    return { empresas, formato: 'agregado' };
  }
}

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
         COALESCE(SUM(total_pago_periodo) FILTER (WHERE status != 'inativa'), 0) AS contribuicao_total_3m,
         COUNT(*) FILTER (WHERE status != 'inativa' AND meses_pagos = 1)::int AS dist_1_mes,
         COUNT(*) FILTER (WHERE status != 'inativa' AND meses_pagos = 2)::int AS dist_2_meses,
         COUNT(*) FILTER (WHERE status != 'inativa' AND meses_pagos = 3)::int AS dist_3_meses,
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

    const { empresas, formato, tresMesesRecentes, linhasIgnoradasCpf } = parseArquivo(req.file.buffer);
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

    // Só o formato "recebimentos" (relatório bruto) representa o universo
    // inteiro de empresas pagantes — só nesse caso faz sentido prever
    // quantas vão ser desativadas por ausência (planilha agregada pode ser
    // uma lista parcial, não dá pra presumir "quem não está aqui, saiu").
    let desativarPreview = 0;
    if (formato === 'recebimentos') {
      const ausentesResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM sindicato_empresas_contribuintes
         WHERE NOT (cnpj = ANY($1)) AND status != 'inativa'`,
        [cnpjs]
      );
      desativarPreview = ausentesResult.rows[0].total;
    }

    return res.json({
      resumo: { novas, atualizadas, status_mudou: statusMudou, total_linhas: empresas.length, desativar_preview: desativarPreview },
      empresas,
      formato,
      tres_meses_recentes: tresMesesRecentes,
      linhas_ignoradas_cpf: linhasIgnoradasCpf,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Erro ao processar planilha' });
  }
}

async function confirmarImportacao(req, res) {
  try {
    const { empresas, formato } = req.body;
    if (!Array.isArray(empresas) || empresas.length === 0) {
      return res.status(400).json({ error: 'empresas (array) é obrigatório' });
    }

    const resumo = await importarLista(empresas);

    let desativadas = 0;
    if (formato === 'recebimentos') {
      const cnpjsPresentes = empresas.map(e => normalizarCnpj(e.cnpj)).filter(Boolean);
      desativadas = await desativarAusentes(cnpjsPresentes);
    }

    const importadoPorId = req.user?.type === 'internal' ? req.user.id : null;

    await db.query(
      `INSERT INTO sindicato_contribuintes_importacoes
         (importado_por_id, novas, atualizadas, status_mudou, total_linhas, desativadas)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [importadoPorId, resumo.novas, resumo.atualizadas, resumo.status_mudou, resumo.total_linhas, desativadas]
    );

    return res.status(201).json({ ...resumo, desativadas });
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
