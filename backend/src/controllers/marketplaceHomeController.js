const db = require('../config/database');
const { obterVitrineRotativa } = require('../services/vitrineRotativaService');
const { PLANOS, PARCEIROS_SEED_DEMONSTRACAO, PLANO_SEED_DEMONSTRACAO, planoEfetivo } = require('../config/planos');

const PLANOS_COM_DESTAQUE = Object.entries(PLANOS).filter(([, cfg]) => cfg.aparece_destaques_parceiros).map(([plano]) => plano);

// CASE SQL que aplica o boost_busca de cada plano (config/planos.js) — os
// slugs do seed de demonstração vêm de uma constante do nosso próprio
// código (não de input do usuário), por isso entram como literal na query
// em vez de bind param. Calculado uma vez só no boot, não por request.
function sqlBoostBusca(aliasPlano = 'pa.plano', aliasSlug = 'pa.slug') {
  const casos = Object.entries(PLANOS).map(([plano, cfg]) => `WHEN ${aliasPlano} = '${plano}' THEN ${cfg.boost_busca}`).join(' ');
  const seedArray = PARCEIROS_SEED_DEMONSTRACAO.map(s => `'${s}'`).join(',') || `''`;
  const seedBoost = PLANOS[PLANO_SEED_DEMONSTRACAO].boost_busca;
  return `(CASE WHEN ${aliasSlug} IN (${seedArray}) THEN ${seedBoost} ${casos} ELSE 0 END)`;
}

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

// Bloco 10: "Ofertas da semana" passou a ser 100% movida a promoção de
// verdade (sindicato_parceiro_promocoes), não mais qualquer produto com
// preco_associado — precisa estar dentro da vigência (data_inicio/data_fim)
// e, se tiver limite de usos, ainda ter vaga sobrando.
async function getOfertasSemana(req, res) {
  try {
    const result = await db.query(
      `SELECT pm.id, pm.titulo, pm.preco_de, pm.preco_por, pm.preco_associado,
              pm.exclusivo_associado, pm.limite_usos, pm.usos_atuais, pm.data_fim,
              COALESCE(pm.foto_url, pr.fotos->0->>'url') AS foto_url,
              pa.nome AS parceiro_nome, pa.slug AS parceiro_slug,
              ROUND(((pm.preco_de - pm.preco_por) / pm.preco_de) * 100) AS desconto_pct
       FROM sindicato_parceiro_promocoes pm
       JOIN sindicato_parceiros pa ON pa.id = pm.parceiro_id
       LEFT JOIN sindicato_parceiro_produtos pr ON pr.id = pm.produto_id
       WHERE pm.ativo = true AND pm.rascunho = false AND pa.status = 'ativo'
         AND pm.data_inicio <= NOW() AND pm.data_fim >= NOW()
         AND (pm.limite_usos IS NULL OR pm.usos_atuais < pm.limite_usos)
       ORDER BY pm.destaque DESC, desconto_pct DESC, pm.data_fim ASC
       LIMIT 8`
    );
    return res.json({ promocoes: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar ofertas da semana' });
  }
}

// Vitrine "Exclusivos pra Associados" na home — TODOS os parceiros com
// produto de preço associado entram, maior desconto primeiro. LIMIT 24
// porque a home agora pagina 2 fileiras (6x2) por vez.
async function getExclusivosAssociados(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO},
              ROUND(((pr.preco - pr.preco_associado) / NULLIF(pr.preco, 0)) * 100) AS desconto_pct
       ${FROM_PRODUTO_ATIVO}
         AND pr.preco_associado IS NOT NULL
       ORDER BY desconto_pct DESC NULLS LAST, pr.destaque DESC, pr.created_at DESC
       LIMIT 24`
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar exclusivos para associados' });
  }
}

// Só pro slide 2 do banner hero (poucos cards, bem grandes) — aqui sim
// precisa de foto Cloudinary de verdade, senão o card fica feio/quebrado
// no carrossel maior. Separado da vitrine normal acima de propósito: a
// vitrine da home mostra qualquer exclusivo (com ImageOff de fallback),
// o banner não pode.
async function getBannerExclusivos(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO},
              ROUND(((pr.preco - pr.preco_associado) / NULLIF(pr.preco, 0)) * 100) AS desconto_pct
       ${FROM_PRODUTO_ATIVO}
         AND pr.preco_associado IS NOT NULL
         AND pr.fotos IS NOT NULL AND jsonb_array_length(pr.fotos) > 0
         AND pr.fotos->0->>'url' ILIKE '%cloudinary%'
       ORDER BY desconto_pct DESC NULLS LAST, pr.destaque DESC, pr.created_at DESC
       LIMIT 8`
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar exclusivos do banner' });
  }
}

async function getNovidades(req, res) {
  try {
    const result = await db.query(
      `SELECT ${SELECT_PRODUTO}
       ${FROM_PRODUTO_ATIVO}
       ORDER BY pr.created_at DESC
       LIMIT 24`
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
       LIMIT 24`
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

// "relevancia" prioriza plano (boost_busca: Master > Premium > Oficial >
// Grátis) antes de destaque/data — os outros critérios são escolha
// explícita do usuário, não fazem sentido misturados com boost de plano.
const ORDENACOES = {
  relevancia: `${sqlBoostBusca()} DESC, pr.destaque DESC, pr.created_at DESC`,
  menor_preco: 'COALESCE(pr.preco_associado, pr.preco) ASC',
  maior_preco: 'COALESCE(pr.preco_associado, pr.preco) DESC',
  recente: 'pr.created_at DESC',
};

// Página de categoria (/marketplace/categoria/:slug) — produtos filtrados
// por bairro/preço/associado/desconto/subcategoria, com paginação. A
// categoria em si não existe como coluna própria: um produto "pertence" a
// uma categoria porque o PARCEIRO dono dele está marcado nela (mesmo
// critério de getCategorias) — por isso resolve a lista de parceiros da
// categoria em JS (sem depender de unaccent no Postgres) e só then filtra
// produtos por parceiro_id.
async function getProdutosPorCategoria(req, res) {
  try {
    const { slug } = req.params;
    const {
      bairro, preco_min, preco_max, ordenar, somente_associado, somente_desconto, subcategoria,
      pagina = '1', limite = '24',
    } = req.query;

    const categoriaHome = CATEGORIAS_HOME.find(c => c.slug === slug);
    if (slug !== 'todas' && !categoriaHome) return res.status(404).json({ error: 'Categoria não encontrada' });

    const parceirosResult = await db.query(`SELECT id, bairro, categorias FROM sindicato_parceiros WHERE status = 'ativo'`);
    let parceiros = parceirosResult.rows;
    if (categoriaHome) {
      const alvo = normalizarCategoria(categoriaHome.label);
      parceiros = parceiros.filter(p => (p.categorias || []).some(c => normalizarCategoria(c) === alvo));
    }
    if (bairro) parceiros = parceiros.filter(p => normalizarCategoria(p.bairro) === normalizarCategoria(bairro));

    const bairrosDisponiveis = [...new Set(parceirosResult.rows.map(p => p.bairro).filter(Boolean))].sort();
    const parceiroIds = parceiros.map(p => p.id);

    if (parceiroIds.length === 0) {
      return res.json({
        categoria: categoriaHome || { slug: 'todas', label: 'Todas as categorias' },
        produtos: [], total: 0, pagina: 1, total_paginas: 0, subcategorias: [], bairros: bairrosDisponiveis,
      });
    }

    const params = [parceiroIds];
    let where = `WHERE pr.parceiro_id = ANY($1) AND pr.ativo = true AND pr.rascunho = false`;

    if (preco_min) { params.push(parseFloat(preco_min)); where += ` AND pr.preco >= $${params.length}`; }
    if (preco_max) { params.push(parseFloat(preco_max)); where += ` AND pr.preco <= $${params.length}`; }
    if (somente_associado === 'true' || somente_desconto === 'true') { where += ` AND pr.preco_associado IS NOT NULL`; }
    if (subcategoria) { params.push(subcategoria); where += ` AND pr.categoria = $${params.length}`; }

    const subcategoriasResult = await db.query(
      `SELECT DISTINCT pr.categoria FROM sindicato_parceiro_produtos pr
       WHERE pr.parceiro_id = ANY($1) AND pr.ativo = true AND pr.rascunho = false AND pr.categoria IS NOT NULL
       ORDER BY pr.categoria ASC`,
      [parceiroIds]
    );

    const totalResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_parceiro_produtos pr ${where}`, params);
    const total = totalResult.rows[0].total;

    const limiteNum = Math.min(60, Math.max(1, parseInt(limite, 10) || 24));
    const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
    const orderBy = ORDENACOES[ordenar] || ORDENACOES.relevancia;
    params.push(limiteNum, (paginaNum - 1) * limiteNum);

    const produtosResult = await db.query(
      `SELECT pr.id, pr.nome, pr.preco, pr.preco_associado, pr.categoria, pr.fotos, pr.created_at,
              pa.nome AS parceiro_nome, pa.slug AS parceiro_slug, pa.bairro AS parceiro_bairro
       FROM sindicato_parceiro_produtos pr
       JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      categoria: categoriaHome || { slug: 'todas', label: 'Todas as categorias' },
      produtos: produtosResult.rows,
      total,
      pagina: paginaNum,
      total_paginas: Math.max(1, Math.ceil(total / limiteNum)),
      subcategorias: subcategoriasResult.rows.map(r => r.categoria),
      bairros: bairrosDisponiveis,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produtos da categoria' });
  }
}

// Vitrine única rotativa: todo parceiro participa, mas quem tem plano maior
// contribui mais produtos pra fila (ver vitrineRotativaService). Não existe
// "destaque premium" separado do "destaque master" — é uma vitrine só.
async function getVitrineRotativa(req, res) {
  try {
    const { geradoEm, produtos } = await obterVitrineRotativa();
    return res.json({ produtos, gerado_em: new Date(geradoEm).toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar vitrine rotativa' });
  }
}

async function getParceiros(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, icone, cor_icone, logo_url, categoria_principal, categorias, plano
       FROM sindicato_parceiros WHERE status = 'ativo' ORDER BY nome ASC`
    );
    return res.json({ parceiros: result.rows.map(p => ({ ...p, plano: planoEfetivo(p) })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar parceiros' });
  }
}

// Vitrine "Parceiros em Destaque" no topo da home (logo após categorias) —
// só quem tem aparece_destaques_parceiros:true no plano (Premium/Master,
// ver config/planos.js) + o seed de demonstração, que entra como se fosse
// Premium.
async function getParceirosDestaques(req, res) {
  try {
    const planosLiteral = PLANOS_COM_DESTAQUE.map(p => `'${p}'`).join(',') || `''`;
    const seedLiteral = PARCEIROS_SEED_DEMONSTRACAO.map(s => `'${s}'`).join(',') || `''`;
    const result = await db.query(
      `SELECT id, slug, nome, icone, cor_icone, logo_url, categoria_principal, categorias, plano
       FROM sindicato_parceiros
       WHERE status = 'ativo' AND (plano IN (${planosLiteral}) OR slug IN (${seedLiteral}))
       ORDER BY ${sqlBoostBusca('plano', 'slug')} DESC, nome ASC
       LIMIT 12`
    );
    return res.json({ parceiros: result.rows.map(p => ({ ...p, plano: planoEfetivo(p) })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar parceiros em destaque' });
  }
}

// A página pública do parceiro (ParceiroDetalhe.jsx) ainda é 100% dado
// estático (parceirosData.js, "Fase 1" — TODO própria dela migrar pra
// banco de verdade, fora do escopo do bloco de planos). Esse endpoint é só
// o mínimo pra ligar o visual de plano (selo grande, banner do Master,
// Instagram) num parceiro que exista de verdade no banco, sem precisar
// migrar a página inteira agora — some graciosamente (parceiro: null)
// pra qualquer slug que só exista no diretório estático.
async function getParceiroPlanoPorSlug(req, res) {
  try {
    const result = await db.query(
      `SELECT slug, plano, banner_personalizado_url, instagram_username
       FROM sindicato_parceiros WHERE slug = $1 AND status = 'ativo'`,
      [req.params.slug]
    );
    if (!result.rows[0]) return res.json({ parceiro: null });
    return res.json({ parceiro: { ...result.rows[0], plano: planoEfetivo(result.rows[0]) } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar plano do parceiro' });
  }
}

module.exports = {
  getOfertasSemana,
  getExclusivosAssociados,
  getBannerExclusivos,
  getNovidades,
  getMaisVendidos,
  getCategorias,
  getProdutosPorCategoria,
  getVitrineRotativa,
  getParceiros,
  getParceirosDestaques,
  getParceiroPlanoPorSlug,
};
