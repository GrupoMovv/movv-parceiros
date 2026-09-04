const XLSX = require('xlsx');
const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');

const VALOR_PADRAO = 10.70;

// ─── Empresas (agrupado por razão social — uma empresa como a Reis pode
// espalhar seus colaboradores por várias filiais/CNPJs diferentes; quem
// importa a lista digita o nome uma vez só, então é essa string que
// identifica "a empresa" pro admin, não um CNPJ isolado) ───────────────────

async function listEmpresas(req, res) {
  try {
    const result = await db.query(
      `SELECT
         COALESCE(NULLIF(TRIM(razao_social_empresa), ''), 'Sem nome') AS razao_social_empresa,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'ativado')::int AS ativados,
         COUNT(*) FILTER (WHERE status = 'pendente_ativacao')::int AS pendentes,
         COUNT(*) FILTER (WHERE status = 'cancelado')::int AS cancelados,
         COUNT(DISTINCT cnpj_empresa)::int AS total_filiais,
         MAX(data_importacao) AS ultima_importacao
       FROM sindicato_lista_aprovada
       GROUP BY 1
       ORDER BY total DESC, razao_social_empresa ASC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar empresas' });
  }
}

async function getEmpresa(req, res) {
  try {
    const nome = req.params.nome;
    const { status, cnpj, search } = req.query;

    const params = [nome];
    let where = `WHERE COALESCE(NULLIF(TRIM(razao_social_empresa), ''), 'Sem nome') = $1`;
    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (cnpj) { params.push(cnpj); where += ` AND cnpj_empresa = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (nome_colaborador ILIKE $${params.length} OR cpf_colaborador ILIKE $${params.length})`; }

    const colaboradoresResult = await db.query(
      `SELECT id, cnpj_empresa, cpf_colaborador, nome_colaborador, matricula_interna, valor_mensal,
              status, data_importacao, ativado_em, associado_id, observacoes
       FROM sindicato_lista_aprovada ${where}
       ORDER BY nome_colaborador ASC`,
      params
    );

    const statsResult = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'ativado')::int AS ativados,
         COUNT(*) FILTER (WHERE status = 'pendente_ativacao')::int AS pendentes,
         COUNT(*) FILTER (WHERE status = 'cancelado')::int AS cancelados,
         MAX(data_importacao) AS ultima_importacao
       FROM sindicato_lista_aprovada
       WHERE COALESCE(NULLIF(TRIM(razao_social_empresa), ''), 'Sem nome') = $1`,
      [nome]
    );

    const filiaisResult = await db.query(
      `SELECT cnpj_empresa AS cnpj, COUNT(*)::int AS total
       FROM sindicato_lista_aprovada
       WHERE COALESCE(NULLIF(TRIM(razao_social_empresa), ''), 'Sem nome') = $1
       GROUP BY cnpj_empresa ORDER BY total DESC`,
      [nome]
    );

    const ultimosAtivadosResult = await db.query(
      `SELECT id, nome_colaborador, cnpj_empresa, ativado_em
       FROM sindicato_lista_aprovada
       WHERE COALESCE(NULLIF(TRIM(razao_social_empresa), ''), 'Sem nome') = $1 AND status = 'ativado'
       ORDER BY ativado_em DESC LIMIT 10`,
      [nome]
    );

    const stats = statsResult.rows[0];
    const total = parseInt(stats.total, 10);
    const ativados = parseInt(stats.ativados, 10);

    return res.json({
      razao_social_empresa: nome,
      stats: {
        ...stats,
        taxa_conversao: total > 0 ? Math.round((ativados / total) * 1000) / 10 : 0,
      },
      filiais: filiaisResult.rows,
      ultimos_ativados: ultimosAtivadosResult.rows,
      colaboradores: colaboradoresResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar empresa' });
  }
}

async function cancelarAcesso(req, res) {
  try {
    const result = await db.query(
      `UPDATE sindicato_lista_aprovada SET status = 'cancelado', updated_at = NOW()
       WHERE id = $1 AND status != 'ativado' RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(409).json({ error: 'Não é possível cancelar — colaborador já ativou a carteirinha ou registro não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cancelar acesso' });
  }
}

async function reativarAcesso(req, res) {
  try {
    const result = await db.query(
      `UPDATE sindicato_lista_aprovada SET status = 'pendente_ativacao', updated_at = NOW()
       WHERE id = $1 AND status = 'cancelado' RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(409).json({ error: 'Registro não encontrado ou não está cancelado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reativar acesso' });
  }
}

// ─── Importação ──────────────────────────────────────────────────────────

const PISTAS_COLUNA = {
  cnpj: ['cnpj'],
  nome: ['colaborador', 'nome'],
  cpf: ['cpf'],
  matricula: ['evento', 'matricula', 'matrícula', 'matr.'],
  valor: ['valor'],
};

function normalizaHeader(v) {
  return String(v ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // remove acentos
}

function sugerirMapeamento(headers) {
  const normalizados = headers.map(normalizaHeader);
  const sugestao = {};
  for (const [campo, pistas] of Object.entries(PISTAS_COLUNA)) {
    const idx = normalizados.findIndex(h => pistas.some(p => h.includes(normalizaHeader(p))));
    sugestao[campo] = idx >= 0 ? idx : null;
  }
  return sugestao;
}

// Lê a planilha (XLSX ou CSV — a lib detecta sozinha pelo conteúdo) e devolve
// TODAS as linhas já como array de arrays, pro front mostrar um preview e
// deixar o admin ajustar o mapeamento de colunas antes de confirmar — nada
// é gravado no banco nesse passo.
async function importarPreview(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo CSV ou XLSX' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
      .filter(linha => linha.some(c => c !== null && String(c).trim() !== ''));

    if (linhas.length === 0) return res.status(400).json({ error: 'Planilha vazia' });

    const headers = linhas[0].map(h => String(h ?? '').trim());
    const dados = linhas.slice(1);

    return res.json({
      headers,
      sugestao: sugerirMapeamento(headers),
      total_linhas: dados.length,
      preview: dados.slice(0, 10),
      rows: dados,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Não foi possível ler o arquivo. Confira se é um CSV ou XLSX válido.' });
  }
}

// Processa em lote: cada linha vira um registro novo em sindicato_lista_aprovada,
// ou cai em "duplicado" (mesmo CPF+CNPJ já importado — ON CONFLICT) ou
// "invalido" (CPF/CNPJ que não passam no algoritmo, ou campo obrigatório vazio).
async function importarCommit(req, res) {
  try {
    const { rows, mapeamento, razao_social_empresa, valor_mensal_default } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Nenhuma linha para importar' });
    if (!razao_social_empresa?.trim()) return res.status(400).json({ error: 'Informe o nome da empresa' });

    const idxCnpj = mapeamento?.cnpj;
    const idxNome = mapeamento?.nome;
    const idxCpf = mapeamento?.cpf;
    const idxMatricula = mapeamento?.matricula;
    const idxValor = mapeamento?.valor;
    if ([idxCnpj, idxNome, idxCpf].some(i => i === null || i === undefined)) {
      return res.status(400).json({ error: 'Mapeie as colunas obrigatórias: CNPJ, Nome e CPF' });
    }

    const valorDefault = valor_mensal_default ? parseFloat(valor_mensal_default) : VALOR_PADRAO;
    const nomeEmpresa = razao_social_empresa.trim();

    let importados = 0, duplicados = 0, invalidos = 0;
    const detalhesInvalidos = [];

    for (const [i, linha] of rows.entries()) {
      const nome = String(linha[idxNome] ?? '').trim();
      const cpf = onlyDigits(linha[idxCpf]);
      const cnpj = onlyDigits(linha[idxCnpj]);
      const matricula = idxMatricula != null ? String(linha[idxMatricula] ?? '').trim() || null : null;
      const valorBruto = idxValor != null ? String(linha[idxValor] ?? '').replace(',', '.').trim() : '';
      const valor = valorBruto && !Number.isNaN(parseFloat(valorBruto)) ? parseFloat(valorBruto) : valorDefault;

      if (!nome || !isValidCPF(cpf) || !isValidCNPJ(cnpj)) {
        invalidos++;
        detalhesInvalidos.push({ linha: i + 2, nome: nome || null, motivo: !nome ? 'Nome vazio' : !isValidCPF(cpf) ? 'CPF inválido' : 'CNPJ inválido' });
        continue;
      }

      try {
        const result = await db.query(
          `INSERT INTO sindicato_lista_aprovada
             (cnpj_empresa, razao_social_empresa, cpf_colaborador, nome_colaborador, matricula_interna, valor_mensal)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (cpf_colaborador, cnpj_empresa) DO NOTHING
           RETURNING id`,
          [cnpj, nomeEmpresa, cpf, nome, matricula, valor]
        );
        if (result.rows[0]) importados++; else duplicados++;
      } catch (err) {
        invalidos++;
        detalhesInvalidos.push({ linha: i + 2, nome, motivo: err.message });
      }
    }

    return res.json({ importados, duplicados, invalidos, detalhes_invalidos: detalhesInvalidos.slice(0, 50), total_processado: rows.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao importar lista' });
  }
}

module.exports = {
  listEmpresas, getEmpresa, cancelarAcesso, reativarAcesso, importarPreview, importarCommit,
};
