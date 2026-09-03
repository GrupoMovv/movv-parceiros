const db = require('../config/database');

const PLANOS_VALIDOS = ['oficial', 'premium', 'master'];

// GET /api/parceiro/interessados — parceiro auth. Lista os planos que ESSE
// parceiro já marcou interesse, pra pintar os botões certos ao carregar a
// página (evita deixar clicar "notificar-me" de novo em quem já confirmou).
async function listarMeuInteresse(req, res) {
  try {
    const result = await db.query(
      'SELECT plano_interesse FROM sindicato_parceiro_interessados WHERE parceiro_id = $1',
      [req.parceiro.id]
    );
    return res.json({ planos: result.rows.map(r => r.plano_interesse) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar interesse' });
  }
}

// POST /api/parceiro/interessados — parceiro auth. Idempotente: se já tinha
// marcado interesse nesse plano, só atualiza a data em vez de duplicar
// (a UNIQUE(parceiro_id, plano_interesse) da tabela é quem garante isso).
async function marcarInteresse(req, res) {
  const plano = String(req.body.plano_interesse || '');
  if (!PLANOS_VALIDOS.includes(plano)) {
    return res.status(400).json({ error: 'Plano inválido' });
  }
  try {
    await db.query(
      `INSERT INTO sindicato_parceiro_interessados (parceiro_id, plano_interesse)
       VALUES ($1, $2)
       ON CONFLICT (parceiro_id, plano_interesse) DO UPDATE SET created_at = NOW()`,
      [req.parceiro.id, plano]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar interesse' });
  }
}

// GET /api/sindicato-parceiro-interessados — admin/sindicato_aprendiz
async function listarTodos(req, res) {
  try {
    const { plano } = req.query;
    const condicoes = [];
    const params = [];
    if (plano && PLANOS_VALIDOS.includes(plano)) {
      params.push(plano);
      condicoes.push(`i.plano_interesse = $${params.length}`);
    }
    const whereSql = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT i.id, i.plano_interesse, i.created_at,
              p.id AS parceiro_id, p.nome AS parceiro_nome, p.slug AS parceiro_slug
       FROM sindicato_parceiro_interessados i
       JOIN sindicato_parceiros p ON p.id = i.parceiro_id
       ${whereSql}
       ORDER BY i.created_at DESC`,
      params
    );

    const totalPorPlano = await db.query(
      `SELECT plano_interesse, COUNT(*)::int AS total FROM sindicato_parceiro_interessados GROUP BY plano_interesse`
    );

    return res.json({
      interessados: result.rows,
      total: result.rows.length,
      total_por_plano: Object.fromEntries(totalPorPlano.rows.map(r => [r.plano_interesse, r.total])),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar interessados' });
  }
}

module.exports = { listarMeuInteresse, marcarInteresse, listarTodos };
