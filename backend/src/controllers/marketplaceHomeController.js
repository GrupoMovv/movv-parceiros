const db = require('../config/database');
const { obterVitrineRotativa } = require('../services/vitrineRotativaService');
const { PLANOS, PIONEIRO_VAGAS_TOTAL, planoEfetivo, sqlPlanoVigente } = require('../config/planos');
const { normalizarCategoria, ehRestaurante } = require('../utils/categorias');

const PLANOS_COM_DESTAQUE = Object.entries(PLANOS).filter(([, cfg]) => cfg.aparece_destaques_parceiros).map(([plano]) => plano);

// CASE SQL que aplica o boost_busca de cada plano (config/planos.js). Os
// nomes de plano vêm do nosso próprio código (não de input do usuário), por
// isso entram como literal na query. Plano pago VENCIDO (fim do período da
// assinatura, ver sqlPlanoVigente) não ganha boost — mesma regra de
// planoEfetivo(). `alias` = prefixo de sindicato_parceiros ('pa.' ou '').
function sqlBoostBusca(alias = 'pa.') {
  const casos = Object.entries(PLANOS).map(([plano, cfg]) => `WHEN ${alias}plano = '${plano}' THEN ${cfg.boost_busca}`).join(' ');
  return `(CASE WHEN NOT ${sqlPlanoVigente(alias)} THEN 0 ${casos} ELSE 0 END)`;
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
// "Alimentação" saiu daqui de propósito: virou área própria (IUB Food,
// ver getFood/getFoodPorSlug) em vez de mais uma categoria genérica —
// restaurante não deve aparecer duplicado em /marketplace/categoria/:slug.
const CATEGORIAS_HOME = [
  { slug: 'saude', label: 'Saúde', emoji: '🏥' },
  { slug: 'beleza', label: 'Beleza', emoji: '💄' },
  { slug: 'servicos', label: 'Serviços', emoji: '🔧' },
  { slug: 'fitness', label: 'Fitness', emoji: '💪' },
  { slug: 'casa', label: 'Casa', emoji: '🏠' },
  { slug: 'moda', label: 'Moda', emoji: '👕' },
  { slug: 'tecnologia', label: 'Tecnologia', emoji: '💻' },
  { slug: 'pet', label: 'Pet', emoji: '🐾' },
];


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
      `SELECT id, slug, nome, icone, cor_icone, logo_url, categoria_principal, categorias, plano, e_pioneiro
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
// ver config/planos.js) e com o plano vigente (não vencido).
async function getParceirosDestaques(req, res) {
  try {
    const planosLiteral = PLANOS_COM_DESTAQUE.map(p => `'${p}'`).join(',') || `''`;
    const result = await db.query(
      `SELECT id, slug, nome, icone, cor_icone, logo_url, categoria_principal, categorias, plano, e_pioneiro,
              plano_expira_em, cortesia_interna
       FROM sindicato_parceiros
       WHERE status = 'ativo' AND plano IN (${planosLiteral}) AND ${sqlPlanoVigente()}
       ORDER BY ${sqlBoostBusca('')} DESC, nome ASC
       LIMIT 12`
    );
    return res.json({ parceiros: result.rows.map(p => ({ ...p, plano: planoEfetivo(p) })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar parceiros em destaque' });
  }
}

// Contador público de "vagas restantes" da promoção Pioneiro — usado nas
// páginas de venda (/vender, /parceiro/painel/planos) pra urgência real,
// nunca inventada (vem direto da contagem de e_pioneiro=true).
async function getPioneiroVagas(req, res) {
  try {
    const result = await db.query(`SELECT COUNT(*)::int AS n FROM sindicato_parceiros WHERE e_pioneiro = true`);
    const preenchidas = result.rows[0].n;
    return res.json({ total: PIONEIRO_VAGAS_TOTAL, preenchidas, vagas_restantes: Math.max(0, PIONEIRO_VAGAS_TOTAL - preenchidas) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar vagas de pioneiro' });
  }
}

// "Muro da Fama" — todo parceiro Pioneiro, pra mostrar como prova social
// nas páginas de venda.
async function getPioneiros(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, icone, cor_icone, logo_url, categoria_principal, categorias, plano, e_pioneiro
       FROM sindicato_parceiros WHERE status = 'ativo' AND e_pioneiro = true ORDER BY plano_ativo_desde ASC`
    );
    return res.json({ parceiros: result.rows.map(p => ({ ...p, plano: planoEfetivo(p) })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar pioneiros' });
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
      `SELECT slug, plano, e_pioneiro, banner_personalizado_url, instagram_username
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

// Categorias do slide "Lojas Oficiais" do banner hero — só as 3 que têm
// slide dedicado hoje (Beleza/Saúde/Fitness). `label` é o que compara
// contra `categorias[]` do parceiro (mesmo critério de getCategorias:
// normalizarCategoria, sem acento/maiúscula) — `slug` é só o que o front
// usa pra rota /marketplace/categoria/:slug do botão "Ver todas".
const CATEGORIAS_OFICIAIS = [
  { slug: 'beleza', label: 'Beleza' },
  { slug: 'saude', label: 'Saúde' },
  { slug: 'fitness', label: 'Fitness' },
];

// Até 3 parceiros Master por categoria, pros slides 3/4/5 do banner hero
// ("Lojas Oficiais") — cada slide só aparece no carrossel (ver front,
// HeroBannerCarousel) se o array daquela categoria não vier vazio. Usa
// planoEfetivo (não a coluna `plano` crua) pra ficar consistente com todo
// resto desse arquivo — hoje nenhum parceiro é Master de verdade (fase
// paga ainda desligada, ver config/planos.js), então as 3 listas vêm
// vazias até existir um Master real ou o seed de demonstração passar a
// mapear pra 'master' em vez de 'premium'.
async function getMasterPorCategoria(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, logo_url, categorias, plano
       FROM sindicato_parceiros WHERE status = 'ativo'`
    );
    const masters = result.rows.filter(p => planoEfetivo(p) === 'master');

    const porCategoria = {};
    for (const { slug, label } of CATEGORIAS_OFICIAIS) {
      porCategoria[slug] = masters
        .filter(p => (p.categorias || []).some(c => normalizarCategoria(c) === normalizarCategoria(label)))
        .slice(0, 3)
        .map(p => ({ id: p.id, nome: p.nome, logo_url: p.logo_url, slug: p.slug }));
    }

    return res.json(porCategoria);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar lojas oficiais por categoria' });
  }
}

// Cupons ativos (ainda não usados, ainda não vencidos) da Roleta, pro
// slide "Cupons Disponíveis" do banner hero — só flavor/prova social
// (parceiro + %), nunca o código do cupom nem quem ganhou, então não tem
// problema de privacidade em expor sem login (mesmo raciocínio de
// anonimizarNome no ranking da Memória, aqui nem precisa porque não tem
// nome nenhum no retorno).
async function getCuponsDisponiveis(req, res) {
  try {
    const totalResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM sindicato_cupons_roleta WHERE status = 'ativo' AND valido_ate > NOW()`
    );
    const amostraResult = await db.query(
      `SELECT p.nome AS parceiro_nome, p.logo_url AS parceiro_logo, c.desconto_percentual
       FROM sindicato_cupons_roleta c
       JOIN sindicato_parceiros p ON p.id = c.parceiro_id
       WHERE c.status = 'ativo' AND c.valido_ate > NOW()
       ORDER BY c.jogado_em DESC
       LIMIT 15`
    );
    return res.json({ total: totalResult.rows[0].total, amostra: amostraResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar cupons disponíveis' });
  }
}

// Listagem de prestadores de serviço (tipo_negocio servico OU hibrido) —
// híbrido aparece aqui E na listagem de produtos (fora do escopo desta
// rodada), igual o pedido original descreve. Ordena por plano (Master
// primeiro) com o mesmo boost_busca usado em getParceirosDestaques.
// Exclui categoria Alimentação (ver getFood) — restaurante hibrido que
// também vende por encomenda como "serviço" tem espaço dedicado no IUB
// Food, não deve duplicar na listagem de Serviços.
async function getServicos(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, logo_url, categorias, categoria_principal, plano, tipo_negocio,
              preco_medio, duracao_media, modalidades
       FROM sindicato_parceiros
       WHERE status = 'ativo' AND tipo_negocio IN ('servico', 'hibrido')
       ORDER BY ${sqlBoostBusca('')} DESC, nome ASC`
    );
    const servicos = result.rows
      .filter(p => !ehRestaurante(p.categorias))
      .map(p => ({ ...p, plano: planoEfetivo(p) }));
    return res.json({ servicos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
}

// Página individual de um serviço (/servicos/:slug no front) — 404 tanto
// pra slug inexistente quanto pra parceiro que existe mas é só 'produto'
// (não vaza a página de quem não presta serviço). "Serviços oferecidos"
// reusa sindicato_parceiro_produtos (o catálogo já existente) em vez de
// criar tabela nova — hoje a maioria dos prestadores não tem nenhum item
// cadastrado ali, então a lista vem vazia até alguém cadastrar pelo
// painel (nada quebra, só fica sem essa seção).
async function getServicoPorSlug(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, logo_url, categorias, categoria_principal, plano, tipo_negocio,
              descricao, descricao_completa, endereco, bairro, cidade, whatsapp,
              preco_medio, duracao_media, modalidades, horario_atendimento, fotos_estabelecimento,
              pet_servicos, pet_portes, pet_racas
       FROM sindicato_parceiros
       WHERE slug = $1 AND status = 'ativo'
         AND (tipo_negocio IN ('servico', 'hibrido') OR pet_servicos <> '{}')`,
      [req.params.slug]
    );
    const parceiro = result.rows[0];
    if (!parceiro) return res.status(404).json({ error: 'Serviço não encontrado' });

    // Pet shop: tabela de preços por serviço/porte (Pet parte 2).
    if (parceiro.pet_servicos?.length) {
      parceiro.pet_precos = (await db.query(
        'SELECT servico, porte, preco FROM pet_precos WHERE parceiro_id = $1 ORDER BY servico, porte', [parceiro.id]
      )).rows.map(x => ({ ...x, preco: Number(x.preco) }));
    }

    const itensResult = await db.query(
      `SELECT id, nome, preco, preco_associado
       FROM sindicato_parceiro_produtos
       WHERE parceiro_id = $1 AND ativo = true AND rascunho = false
       ORDER BY destaque DESC, created_at DESC`,
      [parceiro.id]
    );

    return res.json({ ...parceiro, plano: planoEfetivo(parceiro), servicos_oferecidos: itensResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar serviço' });
  }
}

// Busca de verdade por termo — não existia NENHUM endpoint de busca antes
// disso: a caixa de busca do TopNav só filtrava, no cliente, os ~11
// parceiros estáticos de parceirosData.js (usados na grade "Compre de
// empresas de Itumbiara"), nunca o catálogo real de produtos — bug real:
// "busca sempre mostra a mesma coisa, filtro não funciona". Produtos
// (nome/descrição) e parceiros (nome — cobre loja/serviço/restaurante,
// já que Serviços e IUB Food são só parceiros com tipo_negocio/categoria
// diferentes, não tabelas separadas) num ILIKE simples — sem full-text
// search por enquanto, volume de dados ainda é pequeno pra precisar.
async function getBusca(req, res) {
  try {
    const termo = String(req.query.q || '').trim().slice(0, 100);
    if (!termo) return res.json({ produtos: [], parceiros: [] });

    const like = `%${termo}%`;
    const produtosResult = await db.query(
      `SELECT ${SELECT_PRODUTO}
       ${FROM_PRODUTO_ATIVO}
         AND (pr.nome ILIKE $1 OR pr.descricao ILIKE $1)
       ORDER BY pr.destaque DESC, pr.created_at DESC
       LIMIT 24`,
      [like]
    );
    const parceirosResult = await db.query(
      `SELECT id, slug, nome, logo_url, categoria_principal, categorias, plano, tipo_negocio
       FROM sindicato_parceiros
       WHERE status = 'ativo' AND nome ILIKE $1
       ORDER BY nome ASC
       LIMIT 12`,
      [like]
    );

    return res.json({
      produtos: produtosResult.rows,
      parceiros: parceirosResult.rows.map(p => ({ ...p, plano: planoEfetivo(p) })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar' });
  }
}

// IUB Food — não é um tipo_negocio próprio (migration 049 só tem
// produto/servico/hibrido, e faz sentido continuar assim: uma pizzaria
// vende item de preço fixo igual qualquer produto, não presta "serviço"
// com duração). É a categoria "Alimentação" (já existe na taxonomia real,
// ver categorias[] e CATEGORIAS_HOME acima) que decide quem entra aqui —
// filtro por categoria em JS, mesmo critério de getMasterPorCategoria (sem
// depender de unaccent no Postgres). Não restringe por tipo_negocio de
// propósito: um restaurante que também faz buffet por encomenda como
// "serviço" ainda é Food se tiver a categoria marcada.
// Config de atendimento (migration 051, tela Entrega do painel). Aberto/
// fechado NÃO é calculado aqui: o front calcula a partir de
// horario_funcionamento no fuso de Itumbiara (frontend/src/utils/iubFood.js)
// — assim o badge continua certo mesmo com a página aberta por horas.
const SELECT_ENTREGA = `horario_funcionamento, delivery_disponivel, retirada_disponivel, taxa_entrega,
              entrega_gratis_acima, raio_entrega_km, tempo_preparo_min`;

async function getFood(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, logo_url, categorias, categoria_principal, plano, tipo_negocio,
              preco_medio, duracao_media, horario_atendimento, ${SELECT_ENTREGA}
       FROM sindicato_parceiros
       WHERE status = 'ativo'`
    );
    const restaurantes = result.rows
      .filter(p => ehRestaurante(p.categorias))
      .map(p => ({ ...p, plano: planoEfetivo(p) }));
    return res.json({ restaurantes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar restaurantes' });
  }
}

// Página individual de um restaurante (/food/:slug no front) — mesmo
// critério de acesso do getFood (categoria Alimentação), então 404 pra
// quem não tem essa categoria marcada. "Cardápio" reusa
// sindicato_parceiro_produtos com foto/descrição (diferente de
// getServicoPorSlug, que só devolve nome/preço porque "serviço" não tem
// foto de prato pra mostrar).
async function getFoodPorSlug(req, res) {
  try {
    const result = await db.query(
      `SELECT id, slug, nome, logo_url, categorias, categoria_principal, plano, tipo_negocio,
              descricao, descricao_completa, endereco, bairro, cidade, whatsapp,
              preco_medio, duracao_media, horario_atendimento, fotos_estabelecimento, ${SELECT_ENTREGA}
       FROM sindicato_parceiros
       WHERE slug = $1 AND status = 'ativo'`,
      [req.params.slug]
    );
    const parceiro = result.rows[0];
    if (!parceiro || !ehRestaurante(parceiro.categorias)) {
      return res.status(404).json({ error: 'Restaurante não encontrado' });
    }

    const itensResult = await db.query(
      `SELECT id, nome, descricao, preco, preco_associado, fotos, estoque_disponivel, tempo_preparo_min
       FROM sindicato_parceiro_produtos
       WHERE parceiro_id = $1 AND ativo = true AND rascunho = false
       ORDER BY destaque DESC, created_at DESC`,
      [parceiro.id]
    );

    return res.json({ ...parceiro, plano: planoEfetivo(parceiro), cardapio: itensResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar restaurante' });
  }
}

module.exports = {
  // usado também pela busca do /marketplace/pet (petController)
  sqlBoostBusca,
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
  getPioneiroVagas,
  getPioneiros,
  getParceiroPlanoPorSlug,
  getMasterPorCategoria,
  getCuponsDisponiveis,
  getServicos,
  getServicoPorSlug,
  getBusca,
  getFood,
  getFoodPorSlug,
};
