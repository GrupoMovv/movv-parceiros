const db = require('../config/database');

// Colunas comuns de produto pra qualquer vitrine da home — sempre junto do
// parceiro (nome/slug), porque todo CardProduto mostra "vendido por X".
const SELECT_PRODUTO = `
  pr.id, pr.nome, pr.preco, pr.preco_associado, pr.fotos, pr.created_at,
  pa.nome AS parceiro_nome, pa.slug AS parceiro_slug
`;
const FROM_PRODUTO_ATIVO = `
  FROM sindicato_parceiro_produtos pr
  JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
  WHERE pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'
`;

// "Maior desconto" = maior diferença percentual entre preço normal e preço
// associado. Só entra quem tem desconto > 20% (combinado no Bloco 8).
async function getOfertasSemana(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO}, ROUND(((pr.preco - pr.preco_associado) / pr.preco) * 100) AS desconto_pct
       ${FROM_PRODUTO_ATIVO}
         AND pr.preco_associado IS NOT NULL AND pr.preco > 0
         AND (pr.preco - pr.preco_associado) / pr.preco > 0.20
       ORDER BY desconto_pct DESC, pr.created_at DESC
       LIMIT 8`
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar ofertas da semana' });
  }
}

async function getExclusivosAssociados(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO}
       ${FROM_PRODUTO_ATIVO} AND pr.preco_associado IS NOT NULL
       ORDER BY pr.destaque DESC, pr.created_at DESC
       LIMIT 8`
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar exclusivos para associados' });
  }
}

async function getNovidades(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO}
       ${FROM_PRODUTO_ATIVO}
       ORDER BY pr.created_at DESC
       LIMIT 8`
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar novidades' });
  }
}

// Ranking por cliques no WhatsApp nos últimos 7 dias — se ninguém clicou
// em nada no período, devolve lista vazia (o front simplesmente não
// mostra a seção, não tem "mínimo de dados" arbitrário além disso).
async function getMaisVendidos(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO}, COUNT(c.id)::int AS cliques
       FROM sindicato_parceiro_cliques c
       JOIN sindicato_parceiro_produtos pr ON pr.id = c.produto_id
       JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
       WHERE c.tipo = 'clique_whatsapp' AND c.criado_em >= NOW() - INTERVAL '7 days'
         AND pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'
       GROUP BY pr.id, pa.nome, pa.slug
       ORDER BY cliques DESC, pr.created_at DESC
       LIMIT 8`
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar mais vendidos' });
  }
}

// Categorias fixas da vitrine "Explore por categoria" (combinado no
// Bloco 8) — contagem por parceiro ativo cujo array `categorias` contenha
// a categoria (comparação sem acento/maiúscula, mesmo criterio do front
// em parceirosData.js normalizarCategoria).
const CATEGORIAS_HOME = [
  { slug: 'saude', label: 'Saúde', emoji: '🏥' },
  { slug: 'beleza', label: 'Beleza', emoji: '💄' },
  { slug: 'alimentacao', label: 'Alimentação', emoji: '🍔' },
  { slug: 'servicos', label: 'Serviços', emoji: '🔧' },
  { slug: 'fitness', label: 'Fitness', emoji: '💪' },
  { slug: 'casa', label: 'Casa', emoji: '🏠' },
  { slug: 'moda', label: 'Moda', emoji: '👕' },
  { slug: 'tecnologia', label: 'Tecnologia', emoji: '💻' },
];

function normalizarCategoria(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function getCategorias(req, res) {
  try {
    const result = await db.query(`SELECT categorias FROM sindicato_parceiros WHERE status = 'ativo'`);
    const todasCategorias = result.rows.flatMap(r => (r.categorias || []).map(normalizarCategoria));

    const categorias = CATEGORIAS_HOME.map(c => ({
      ...c,
      count: todasCategorias.filter(cat => cat === normalizarCategoria(c.label)).length,
    }));

    return res.json({ categorias });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
}

async function getParceiros(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, icone, cor_icone, logo_url, categoria_principal, categorias
       FROM sindicato_parceiros WHERE status = 'ativo' ORDER BY nome ASC`
    );
    return res.json({ parceiros: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar parceiros' });
  }
}

module.exports = {
  getOfertasSemana,
  getExclusivosAssociados,
  getNovidades,
  getMaisVendidos,
  getCategorias,
  getParceiros,
};
