const { nanoid } = require('nanoid');
const db = require('../config/database');

const VALIDADE_MESES = 6;
const HASH_LENGTH = 12;

function pad2(n) { return String(n).padStart(2, '0'); }

// new Date(y, m).setMonth() estoura pro mês seguinte quando o dia atual não
// existe no mês de destino (ex.: 31/ago + 6 meses vira 03/mar, não 28/fev).
// Calcula em componentes locais (evita timezone-shift do toISOString também).
function calcularValidoAte() {
  const now = new Date();
  const targetIndex = now.getMonth() + VALIDADE_MESES;
  const year = now.getFullYear() + Math.floor(targetIndex / 12);
  const month = ((targetIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(now.getDate(), lastDayOfTargetMonth);
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

async function gerarHashUnico(tabela) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const hash = nanoid(HASH_LENGTH);
    const existe = await db.query(`SELECT 1 FROM ${tabela} WHERE carteirinha_hash = $1`, [hash]);
    if (!existe.rows[0]) return hash;
  }
  throw new Error('Não foi possível gerar um hash único para a carteirinha');
}

async function gerarParaDependentes(associadoId, { manterHashExistente }) {
  const deps = await db.query(
    'SELECT id, carteirinha_hash FROM sindicato_associados_dependentes WHERE associado_id = $1',
    [associadoId]
  );
  for (const dep of deps.rows) {
    const validaAte = calcularValidoAte();
    if (manterHashExistente && dep.carteirinha_hash) {
      await db.query(
        `UPDATE sindicato_associados_dependentes
         SET carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $1 WHERE id = $2`,
        [validaAte, dep.id]
      );
    } else {
      const hash = await gerarHashUnico('sindicato_associados_dependentes');
      await db.query(
        `UPDATE sindicato_associados_dependentes
         SET carteirinha_hash = $1, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $2 WHERE id = $3`,
        [hash, validaAte, dep.id]
      );
    }
  }
}

async function buscarAssociado(id) {
  const result = await db.query('SELECT * FROM sindicato_associados WHERE id = $1 AND ativo = true', [id]);
  return result.rows[0] || null;
}

// Regera do zero: hash novo + validade nova. Usado na primeira geração e
// caso Renan queira reemitir a carteirinha (ex.: dado errado corrigido).
async function gerar(req, res) {
  try {
    const { associado_id } = req.params;
    const associado = await buscarAssociado(associado_id);
    if (!associado) return res.status(404).json({ error: 'Associado não encontrado' });

    const hash = await gerarHashUnico('sindicato_associados');
    const validaAte = calcularValidoAte();

    const result = await db.query(
      `UPDATE sindicato_associados
       SET carteirinha_hash = $1, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [hash, validaAte, associado_id]
    );

    if (associado.dependentes_gerar_carteirinha) {
      await gerarParaDependentes(associado_id, { manterHashExistente: false });
    }

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar carteirinha' });
  }
}

// Mantém o hash (QR já compartilhado/impresso continua válido) e só estende
// a validade por mais 6 meses.
async function renovar(req, res) {
  try {
    const { associado_id } = req.params;
    const associado = await buscarAssociado(associado_id);
    if (!associado) return res.status(404).json({ error: 'Associado não encontrado' });
    if (!associado.carteirinha_hash) {
      return res.status(400).json({ error: 'Associado ainda não tem carteirinha gerada' });
    }

    const validaAte = calcularValidoAte();
    const result = await db.query(
      `UPDATE sindicato_associados
       SET carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [validaAte, associado_id]
    );

    if (associado.dependentes_gerar_carteirinha) {
      await gerarParaDependentes(associado_id, { manterHashExistente: true });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao renovar carteirinha' });
  }
}

async function gerarMassa(req, res) {
  try {
    const { associado_ids } = req.body;
    if (!Array.isArray(associado_ids) || associado_ids.length === 0) {
      return res.status(400).json({ error: 'associado_ids (array) é obrigatório' });
    }

    const gerados = [];
    const erros = [];
    for (const id of associado_ids) {
      try {
        const associado = await buscarAssociado(id);
        if (!associado) { erros.push({ id, error: 'não encontrado' }); continue; }

        const hash = await gerarHashUnico('sindicato_associados');
        const validaAte = calcularValidoAte();
        await db.query(
          `UPDATE sindicato_associados
           SET carteirinha_hash = $1, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $2, updated_at = NOW()
           WHERE id = $3`,
          [hash, validaAte, id]
        );
        if (associado.dependentes_gerar_carteirinha) {
          await gerarParaDependentes(id, { manterHashExistente: false });
        }
        gerados.push({ id, carteirinha_hash: hash, carteirinha_valida_ate: validaAte });
      } catch (err) {
        console.error(err);
        erros.push({ id, error: 'erro ao gerar' });
      }
    }

    return res.status(201).json({ gerados, erros });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar carteirinhas em massa' });
  }
}

async function uploadFoto(req, res) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de foto' });

    const check = await db.query('SELECT id FROM sindicato_associados WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Associado não encontrado' });

    const urlArquivo = `/uploads/associados/${req.file.filename}`;
    const uploadedPorId = req.user?.type === 'internal' ? req.user.id : null;

    await db.query('UPDATE sindicato_associados SET foto_url = $1, updated_at = NOW() WHERE id = $2', [urlArquivo, id]);
    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (associado_id, tipo_dono, url_arquivo, uploaded_por_id)
       VALUES ($1, 'associado', $2, $3)`,
      [id, urlArquivo, uploadedPorId]
    );

    return res.json({ foto_url: urlArquivo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar foto' });
  }
}

async function setEmpresa(req, res) {
  try {
    const { id } = req.params;
    const { empresa_id, empresa_nome_livre } = req.body;

    if (empresa_id && empresa_nome_livre) {
      return res.status(400).json({ error: 'Informe empresa_id OU empresa_nome_livre, não os dois' });
    }

    const check = await db.query('SELECT id FROM sindicato_associados WHERE id = $1', [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Associado não encontrado' });

    const result = await db.query(
      `UPDATE sindicato_associados
       SET empresa_id = $1, empresa_nome_livre = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [empresa_id || null, empresa_id ? null : (empresa_nome_livre || null), id]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Últimos 6 meses (mês atual incluso), mais antigo primeiro — mesma lógica
// de componentes locais do calcularValidoAte(), sem depender de Date com
// timezone pra evitar cair no mês errado perto da virada.
function ultimosSeisMeses() {
  const now = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const targetIndex = now.getMonth() - i;
    const year = now.getFullYear() + Math.floor(targetIndex / 12);
    const month = ((targetIndex % 12) + 12) % 12;
    meses.push({ chave: `${year}-${pad2(month + 1)}`, label: `${MESES_ABREV[month]}/${String(year).slice(2)}` });
  }
  return meses;
}

async function stats(req, res) {
  try {
    const geralResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE ativo)::int AS total_associados_ativos,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_hash IS NOT NULL)::int AS emitidas,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_hash IS NOT NULL AND carteirinha_valida_ate >= CURRENT_DATE)::int AS ativas,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_hash IS NOT NULL AND carteirinha_valida_ate >= CURRENT_DATE AND carteirinha_valida_ate < CURRENT_DATE + INTERVAL '15 days')::int AS vencendo_15,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_hash IS NOT NULL AND carteirinha_valida_ate < CURRENT_DATE)::int AS vencidas,
         COUNT(*) FILTER (WHERE ativo AND carteirinha_hash IS NULL)::int AS nao_geradas
       FROM sindicato_associados`
    );
    const geral = geralResult.rows[0];
    const coberturaPct = geral.total_associados_ativos > 0
      ? Math.round((geral.emitidas / geral.total_associados_ativos) * 1000) / 10
      : 0;

    const porMesResult = await db.query(
      `SELECT to_char(date_trunc('month', carteirinha_gerada_em), 'YYYY-MM') AS chave, COUNT(*)::int AS total
       FROM sindicato_associados
       WHERE carteirinha_gerada_em >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
       GROUP BY 1`
    );
    const porMesMap = Object.fromEntries(porMesResult.rows.map(r => [r.chave, r.total]));
    const emissoesPorMes = ultimosSeisMeses().map(m => ({ mes: m.chave, label: m.label, total: porMesMap[m.chave] || 0 }));

    const categoriasResult = await db.query(
      `SELECT categoria_profissional AS categoria, COUNT(*)::int AS total
       FROM sindicato_associados
       WHERE ativo AND carteirinha_hash IS NOT NULL AND categoria_profissional IS NOT NULL
       GROUP BY categoria_profissional
       ORDER BY total DESC
       LIMIT 3`
    );
    const topCategorias = categoriasResult.rows.map(r => ({
      categoria: r.categoria,
      total: r.total,
      percentual: geral.emitidas > 0 ? Math.round((r.total / geral.emitidas) * 1000) / 10 : 0,
    }));

    const dependentesResult = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE d.carteirinha_hash IS NOT NULL)::int AS com_carteirinha
       FROM sindicato_associados_dependentes d
       JOIN sindicato_associados a ON a.id = d.associado_id
       WHERE a.ativo = true`
    );
    const dep = dependentesResult.rows[0];
    const depCoberturaPct = dep.total > 0 ? Math.round((dep.com_carteirinha / dep.total) * 1000) / 10 : 0;

    return res.json({
      emitidas: geral.emitidas,
      ativas: geral.ativas,
      vencendo_15: geral.vencendo_15,
      vencidas: geral.vencidas,
      nao_geradas: geral.nao_geradas,
      total_associados_ativos: geral.total_associados_ativos,
      cobertura_pct: coberturaPct,
      emissoes_por_mes: emissoesPorMes,
      top_categorias: topCategorias,
      dependentes: {
        total: dep.total,
        com_carteirinha: dep.com_carteirinha,
        sem_carteirinha: dep.total - dep.com_carteirinha,
        cobertura_pct: depCoberturaPct,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao calcular estatísticas' });
  }
}

module.exports = { gerar, renovar, gerarMassa, uploadFoto, setEmpresa, stats };
