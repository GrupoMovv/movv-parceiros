const db = require('../config/database');
const { beneficios, planoEfetivo } = require('../config/planos');

// Metricas reais, nao mockadas — hoje a maioria vem zerada porque nada grava
// em sindicato_parceiro_cliques ainda (o marketplace publico nao emite esses
// eventos, fica pra um bloco futuro) e produtos/promocoes so existem a
// partir do Bloco 3. Quando esses blocos existirem, o dashboard passa a
// mostrar numero real sem precisar mexer aqui de novo.
async function stats(req, res) {
  try {
    const parceiroId = req.parceiro.id;

    const [produtos, promocoes, visitas, cliquesWhatsapp, ultimosProdutos] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1', [parceiroId]),
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
      db.query(
        `SELECT id, nome, preco, ativo, rascunho, fotos, created_at FROM sindicato_parceiro_produtos
         WHERE parceiro_id = $1 ORDER BY created_at DESC LIMIT 3`,
        [parceiroId]
      ),
    ]);

    return res.json({
      produtos_cadastrados: produtos.rows[0].n,
      promocoes_ativas: promocoes.rows[0].n,
      visitas_30d: visitas.rows[0].n,
      cliques_whatsapp_30d: cliquesWhatsapp.rows[0].n,
      ultimos_produtos: ultimosProdutos.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

// Estatísticas detalhadas (aba "Estatísticas" do painel) — só pra quem tem
// analytics_avancado no plano (todo plano pago, ver config/planos.js). Pro
// Grátis, o front usa só /stats (contadores básicos) e mostra banner de
// upgrade em vez do gráfico.
// "Origem tráfego" depende da coluna `origem` em sindicato_parceiro_cliques
// (migration 035) — infraestrutura pronta, mas o marketplace público ainda
// não manda essa dimensão em todo evento, então a maioria cai em
// "não classificado" até isso ser instrumentado ponta a ponta.
async function statsDetalhado(req, res) {
  try {
    const parceiro = req.parceiro;
    const plano = planoEfetivo(parceiro);
    if (!beneficios(plano).analytics_avancado) {
      return res.status(403).json({ error: 'Analytics avançado disponível a partir do plano Oficial.' });
    }

    const parceiroId = parceiro.id;

    const [porDiaVisitas, porDiaCliques, topProdutos, porOrigem] = await Promise.all([
      db.query(
        `SELECT to_char(criado_em::date, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS n
         FROM sindicato_parceiro_cliques
         WHERE parceiro_id = $1 AND tipo = 'visita_perfil' AND criado_em >= NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY 1`,
        [parceiroId]
      ),
      db.query(
        `SELECT to_char(criado_em::date, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS n
         FROM sindicato_parceiro_cliques
         WHERE parceiro_id = $1 AND tipo = 'clique_whatsapp' AND criado_em >= NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY 1`,
        [parceiroId]
      ),
      db.query(
        `SELECT pr.id, pr.nome, pr.fotos, COUNT(c.id)::int AS visualizacoes
         FROM sindicato_parceiro_cliques c
         JOIN sindicato_parceiro_produtos pr ON pr.id = c.produto_id
         WHERE c.parceiro_id = $1 AND c.criado_em >= NOW() - INTERVAL '30 days' AND c.produto_id IS NOT NULL
         GROUP BY pr.id ORDER BY visualizacoes DESC LIMIT 5`,
        [parceiroId]
      ),
      db.query(
        `SELECT COALESCE(origem, 'nao_classificado') AS origem, COUNT(*)::int AS n
         FROM sindicato_parceiro_cliques
         WHERE parceiro_id = $1 AND criado_em >= NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY n DESC`,
        [parceiroId]
      ),
    ]);

    const totalVisitas = porDiaVisitas.rows.reduce((s, r) => s + r.n, 0);
    const totalCliques = porDiaCliques.rows.reduce((s, r) => s + r.n, 0);

    return res.json({
      visitas_por_dia: porDiaVisitas.rows,
      cliques_whatsapp_por_dia: porDiaCliques.rows,
      top_produtos: topProdutos.rows,
      origem_trafego: porOrigem.rows,
      taxa_conversao: totalVisitas > 0 ? Math.round((totalCliques / totalVisitas) * 1000) / 10 : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas detalhadas' });
  }
}

module.exports = { stats, statsDetalhado };
