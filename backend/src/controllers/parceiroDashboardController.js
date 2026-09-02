const db = require('../config/database');

// Metricas reais, nao mockadas — hoje a maioria vem zerada porque nada grava
// em sindicato_parceiro_cliques ainda (o marketplace publico nao emite esses
// eventos, fica pra um bloco futuro) e produtos/promocoes so existem a
// partir do Bloco 3. Quando esses blocos existirem, o dashboard passa a
// mostrar numero real sem precisar mexer aqui de novo.
async function stats(req, res) {
  try {
    const parceiroId = req.parceiro.id;

    const [produtos, promocoes, visitas, cliquesWhatsapp] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1 AND ativo = true', [parceiroId]),
      db.query(
        `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_promocoes
         WHERE parceiro_id = $1 AND ativo = true AND (valido_ate IS NULL OR valido_ate >= CURRENT_DATE)`,
        [parceiroId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_cliques
         WHERE parceiro_id = $1 AND tipo = 'visita_perfil' AND criado_em >= NOW() - INTERVAL '30 days'`,
        [parceiroId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_cliques
         WHERE parceiro_id = $1 AND tipo = 'clique_whatsapp' AND criado_em >= NOW() - INTERVAL '30 days'`,
        [parceiroId]
      ),
    ]);

    return res.json({
      produtos_cadastrados: produtos.rows[0].n,
      promocoes_ativas: promocoes.rows[0].n,
      visitas_30d: visitas.rows[0].n,
      cliques_whatsapp_30d: cliquesWhatsapp.rows[0].n,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

module.exports = { stats };
