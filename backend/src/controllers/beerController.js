const db = require('../config/database');
const { PLANOS, planoEfetivo, sqlPlanoVigente } = require('../config/planos');
const { IDADE_MINIMA, DIAS, idadeEmAnos, diaDeHoje, normalizarTexto } = require('../config/beer');
const { onlyDigits, isValidCPF } = require('../utils/validators');

// IUB DISK BEBIDAS — rotas públicas (/api/public/beer). Modelo híbrido
// (migration 058): estabelecimento = parceiro ativo COM extensão
// beer_estabelecimentos ativa; catálogo = beer_produtos, que só aparece
// aqui (nunca nas vitrines do marketplace geral, que não têm porta +18).
// Produto só é público com status 'aprovado' + disponivel (moderação).

// Master > Premium > Oficial > Grátis, plano pago vencido vale 0 — mesma
// regra do sqlBoostBusca da home (marketplaceHomeController).
function sqlOrdemPlano() {
  const casos = Object.entries(PLANOS).map(([plano, cfg]) => `WHEN pa.plano = '${plano}' THEN ${cfg.boost_busca}`).join(' ');
  return `(CASE WHEN NOT ${sqlPlanoVigente('pa.')} THEN 0 ${casos} ELSE 0 END)`;
}

const WHERE_ESTABELECIMENTO_VISIVEL = `be.ativo = true AND pa.status = 'ativo'`;
const WHERE_PRODUTO_VISIVEL = `bp.status = 'aprovado' AND bp.disponivel = true AND bc.ativo = true AND ${WHERE_ESTABELECIMENTO_VISIVEL}`;
const FROM_PRODUTO = `
  FROM beer_produtos bp
  JOIN beer_estabelecimentos be ON be.id = bp.estabelecimento_id
  JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
  JOIN beer_categorias bc ON bc.codigo = bp.categoria_codigo
`;

// Colunas do estabelecimento que qualquer card mostra. WhatsApp é público
// de propósito: é pra onde vai o pedido ("Pedir no WhatsApp").
const SELECT_ESTABELECIMENTO = `
  be.id AS estabelecimento_id, pa.slug, pa.nome, pa.logo_url, be.tipo, be.whatsapp,
  be.bairros_entrega, be.horario_funcionamento, be.status_aberto, be.tempo_entrega_min, be.retirada_disponivel,
  pa.plano, pa.plano_expira_em, pa.cortesia_interna
`;

// Tira os campos internos de plano e devolve o plano que vale AGORA.
function publicoEstabelecimento({ plano_expira_em, cortesia_interna, estabelecimento_id, ...e }) {
  return { id: estabelecimento_id, ...e, plano: planoEfetivo({ ...e, plano_expira_em, cortesia_interna }) };
}

function publicoProduto(r) {
  return {
    id: r.produto_id, nome: r.produto_nome, descricao: r.descricao, preco: r.preco, imagem: r.imagem,
    disponivel_agora: r.disponivel_agora, dias_disponiveis: r.dias_disponiveis, destaque: r.destaque,
    categoria: { codigo: r.categoria_codigo, nome: r.categoria_nome, icone: r.categoria_icone, regulamentada: r.regulamentada },
    estabelecimento: publicoEstabelecimento(r),
  };
}

const SELECT_PRODUTO = `
  bp.id AS produto_id, bp.nome AS produto_nome, bp.descricao, bp.preco, bp.imagem, bp.disponivel_agora,
  bp.dias_disponiveis, bp.destaque, bp.categoria_codigo,
  bc.nome_exibicao AS categoria_nome, bc.icone AS categoria_icone, bc.regulamentada,
  ${SELECT_ESTABELECIMENTO}
`;

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
}

// Filtro de categoria que aceita FOLHA ("vodka") ou GRUPO ("destilados").
// Devolve o pedaço de SQL e empurra o parâmetro; null = código inexistente.
async function filtroCategoria(codigo, params) {
  const r = await db.query('SELECT codigo FROM beer_categorias WHERE codigo = $1 AND ativo = true', [codigo]);
  if (!r.rows[0]) return null;
  params.push(codigo);
  return `(bp.categoria_codigo = $${params.length} OR bc.categoria_pai = $${params.length})`;
}

// GET /categorias — árvore completa (grupo -> categorias) com quantos
// produtos visíveis cada uma tem agora (a home mostra, e esconde vazio se
// quiser). Categoria desativada no banco some daqui.
async function getCategorias(req, res) {
  try {
    const cats = await db.query(
      `SELECT codigo, nome_exibicao AS nome, categoria_pai, icone, ordem, regulamentada
       FROM beer_categorias WHERE ativo = true ORDER BY ordem, nome_exibicao`
    );
    const contagem = await db.query(
      `SELECT bp.categoria_codigo, COUNT(*)::int AS total ${FROM_PRODUTO} WHERE ${WHERE_PRODUTO_VISIVEL} GROUP BY 1`
    );
    const totalPor = Object.fromEntries(contagem.rows.map(r => [r.categoria_codigo, r.total]));

    const grupos = cats.rows.filter(c => !c.categoria_pai).map(g => {
      const filhas = cats.rows.filter(c => c.categoria_pai === g.codigo)
        .map(({ categoria_pai, ordem, ...c }) => ({ ...c, total: totalPor[c.codigo] || 0 }));
      const { categoria_pai, ordem, ...grupo } = g;
      return { ...grupo, total: filhas.reduce((s, f) => s + f.total, 0), filhas };
    });
    return res.json({ grupos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
}

// GET /resumo — barra de status da home ("🟢 X abertos agora").
async function getResumo(req, res) {
  try {
    const r = await db.query(
      `SELECT COUNT(*)::int AS estabelecimentos, COUNT(*) FILTER (WHERE be.status_aberto)::int AS abertos
       FROM beer_estabelecimentos be JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
       WHERE ${WHERE_ESTABELECIMENTO_VISIVEL}`
    );
    return res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
}

// GET /estabelecimentos?categoria=cervejas&bairro=centro&aberto=true
// `categoria` = tem pelo menos 1 produto visível daquela folha/grupo.
// `bairro` casa com bairros_entrega (sem acento/maiúscula).
async function getEstabelecimentos(req, res) {
  try {
    const { categoria, bairro, aberto } = req.query;
    const params = [];
    const filtros = [WHERE_ESTABELECIMENTO_VISIVEL];
    if (aberto === 'true') filtros.push('be.status_aberto = true');
    if (categoria) {
      const sqlCat = await filtroCategoria(categoria, params);
      if (!sqlCat) return res.status(400).json({ error: 'Categoria inválida' });
      filtros.push(`EXISTS (SELECT 1 FROM beer_produtos bp JOIN beer_categorias bc ON bc.codigo = bp.categoria_codigo
                            WHERE bp.estabelecimento_id = be.id AND bp.status = 'aprovado' AND bp.disponivel = true AND bc.ativo = true AND ${sqlCat})`);
    }

    const result = await db.query(
      `SELECT ${SELECT_ESTABELECIMENTO},
              (SELECT COUNT(*)::int FROM beer_produtos bp WHERE bp.estabelecimento_id = be.id AND bp.status = 'aprovado' AND bp.disponivel = true) AS total_produtos,
              (SELECT COALESCE(array_agg(DISTINCT COALESCE(bc.categoria_pai, bc.codigo)), '{}')
                 FROM beer_produtos bp JOIN beer_categorias bc ON bc.codigo = bp.categoria_codigo
                WHERE bp.estabelecimento_id = be.id AND bp.status = 'aprovado' AND bp.disponivel = true) AS grupos
       FROM beer_estabelecimentos be JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
       WHERE ${filtros.join(' AND ')}
       ORDER BY ${sqlOrdemPlano()} DESC, be.status_aberto DESC, pa.nome ASC`,
      params
    );

    let lista = result.rows;
    if (bairro) {
      const alvo = normalizarTexto(bairro);
      lista = lista.filter(e => (e.bairros_entrega || []).some(b => normalizarTexto(b) === alvo));
    }
    return res.json({ estabelecimentos: lista.map(publicoEstabelecimento) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estabelecimentos' });
  }
}

async function buscarEstabelecimentoPorSlug(slug) {
  const r = await db.query(
    `SELECT ${SELECT_ESTABELECIMENTO}, pa.descricao, pa.endereco, pa.bairro, pa.cidade, pa.fotos_estabelecimento
     FROM beer_estabelecimentos be JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
     WHERE pa.slug = $1 AND ${WHERE_ESTABELECIMENTO_VISIVEL}`,
    [slug]
  );
  return r.rows[0] || null;
}

// GET /estabelecimentos/:slug — por slug (vai na URL /beer/estabelecimento/:slug,
// igual /food/:slug). 404 pra slug inexistente, parceiro inativo ou que
// saiu do Beer.
async function getEstabelecimento(req, res) {
  try {
    const e = await buscarEstabelecimentoPorSlug(req.params.slug);
    if (!e) return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    return res.json(publicoEstabelecimento(e));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estabelecimento' });
  }
}

// GET /estabelecimentos/:slug/produtos?categoria=vinhos — cardápio inteiro
// (todos os dias; o card mostra "Só domingo" em vez de esconder).
async function getProdutosEstabelecimento(req, res) {
  try {
    const e = await buscarEstabelecimentoPorSlug(req.params.slug);
    if (!e) return res.status(404).json({ error: 'Estabelecimento não encontrado' });

    const params = [e.estabelecimento_id];
    const filtros = [WHERE_PRODUTO_VISIVEL, 'be.id = $1'];
    if (req.query.categoria) {
      const sqlCat = await filtroCategoria(req.query.categoria, params);
      if (!sqlCat) return res.status(400).json({ error: 'Categoria inválida' });
      filtros.push(sqlCat);
    }
    const r = await db.query(
      `SELECT ${SELECT_PRODUTO} ${FROM_PRODUTO} WHERE ${filtros.join(' AND ')}
       ORDER BY bp.destaque DESC, bp.disponivel_agora DESC, bc.ordem, bp.nome`,
      params
    );
    return res.json({ produtos: r.rows.map(publicoProduto) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
}

// GET /produtos?categoria=X&dia=dom|hoje&disponivel_agora=true&q=texto
// Vitrine de produtos de TODOS os estabelecimentos (página de categoria e
// busca). `q` filtra em JS sem acento (nome, descrição, categoria,
// estabelecimento) — catálogo de uma cidade cabe tranquilo na memória, e
// o banco não tem unaccent. Teto de 300 linhas por segurança.
async function listarProdutos({ categoria, dia, disponivelAgora, soAbertos, q, tempoMax, retirada }) {
  const params = [];
  const filtros = [WHERE_PRODUTO_VISIVEL];
  if (categoria) {
    const sqlCat = await filtroCategoria(categoria, params);
    if (!sqlCat) return null;
    filtros.push(sqlCat);
  }
  if (dia) {
    params.push(dia);
    filtros.push(`(bp.dias_disponiveis ? 'todos' OR bp.dias_disponiveis ? $${params.length})`);
  }
  if (disponivelAgora) filtros.push('bp.disponivel_agora = true');
  if (soAbertos) filtros.push('be.status_aberto = true');
  if (tempoMax) { params.push(tempoMax); filtros.push(`be.tempo_entrega_min IS NOT NULL AND be.tempo_entrega_min <= $${params.length}`); }
  if (retirada) filtros.push('be.retirada_disponivel = true');

  const r = await db.query(
    `SELECT ${SELECT_PRODUTO} ${FROM_PRODUTO} WHERE ${filtros.join(' AND ')}
     ORDER BY bp.destaque DESC, ${sqlOrdemPlano()} DESC, be.status_aberto DESC, bp.created_at DESC
     LIMIT 300`,
    params
  );
  let linhas = r.rows;
  if (q) {
    const termo = normalizarTexto(q);
    linhas = linhas.filter(p => normalizarTexto([p.produto_nome, p.descricao, p.categoria_nome, p.nome].join(' ')).includes(termo));
  }
  return linhas.map(publicoProduto);
}

function diaDaQuery(dia) {
  if (!dia) return null;
  if (dia === 'hoje') return diaDeHoje();
  const mapa = { domingo: 'dom', segunda: 'seg', terca: 'ter', quarta: 'qua', quinta: 'qui', sexta: 'sex', sabado: 'sab' };
  const chave = mapa[normalizarTexto(dia)] || dia;
  return DIAS.includes(chave) ? chave : undefined;
}

async function getProdutos(req, res) {
  try {
    const dia = diaDaQuery(req.query.dia);
    if (dia === undefined) return res.status(400).json({ error: 'Dia inválido' });
    const produtos = await listarProdutos({
      categoria: req.query.categoria, dia, disponivelAgora: req.query.disponivel_agora === 'true', q: req.query.q,
    });
    if (!produtos) return res.status(400).json({ error: 'Categoria inválida' });
    return res.json({ produtos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
}

// GET /produtos/quero-agora?tempo=30|45&retirada=true — marcado "disponível
// agora" pelo parceiro, estabelecimento com "Aberto agora" ligado e
// disponível HOJE (item "só domingo" não aparece na terça).
async function getQueroAgora(req, res) {
  try {
    const tempo = req.query.tempo ? Number(req.query.tempo) : null;
    if (tempo !== null && ![30, 45].includes(tempo)) return res.status(400).json({ error: 'Tempo inválido' });
    const produtos = await listarProdutos({
      dia: diaDeHoje(), disponivelAgora: true, soAbertos: true, tempoMax: tempo, retirada: req.query.retirada === 'true',
    });
    return res.json({ produtos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
}

async function registrarVerificacao(req, { associadoId, metodo, isAdult }) {
  const result = await db.query(
    `INSERT INTO beer_verificacoes_idade (associado_id, metodo, is_adult, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5) RETURNING verified_at`,
    [associadoId || null, metodo, isAdult, getIp(req), String(req.headers['user-agent'] || '').slice(0, 500) || null]
  );
  return result.rows[0].verified_at;
}

// POST /verificar-idade  { cpf, data_nascimento }
// Checagem simples por CPF (formato válido) + nascimento informado. NÃO
// consulta o cadastro pelo CPF de propósito: responder diferente pra CPF
// de associado viraria um jeito de descobrir quem é filiado. O log não
// guarda o CPF nem a data (ver migration 058).
async function verificarIdade(req, res) {
  try {
    const { cpf, data_nascimento } = req.body || {};
    if (!isValidCPF(onlyDigits(cpf))) return res.status(400).json({ error: 'CPF inválido' });
    const idade = idadeEmAnos(data_nascimento);
    if (idade === null) return res.status(400).json({ error: 'Data de nascimento inválida' });

    const isAdult = idade >= IDADE_MINIMA;
    const verifiedAt = await registrarVerificacao(req, { associadoId: req.painelAssociado?.id, metodo: 'cpf_nascimento', isAdult });
    return res.json({ is_adult: isAdult, verified_at: verifiedAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar idade' });
  }
}

// POST /registrar-acesso  { confirmado?: true }
// Chamado ao entrar no /beer. Associado logado COM data de nascimento no
// cadastro: vale o cadastro (maior entra direto, sem modal; menor fica de
// fora mesmo marcando a caixinha). Sem login, ou cadastro sem data: só
// libera com `confirmado: true` (checkbox do modal = autodeclaração).
// is_adult null = ainda precisa do modal (nada é registrado).
async function registrarAcesso(req, res) {
  try {
    const associado = req.painelAssociado;
    const idadeCadastro = associado ? idadeEmAnos(associado.data_nascimento) : null;

    if (idadeCadastro !== null) {
      const isAdult = idadeCadastro >= IDADE_MINIMA;
      const verifiedAt = await registrarVerificacao(req, { associadoId: associado.id, metodo: 'cadastro', isAdult });
      return res.json({ is_adult: isAdult, metodo: 'cadastro', verified_at: verifiedAt });
    }

    if (req.body?.confirmado !== true) return res.json({ is_adult: null, metodo: null, verified_at: null });

    const verifiedAt = await registrarVerificacao(req, { associadoId: associado?.id, metodo: 'autodeclaracao', isAdult: true });
    return res.json({ is_adult: true, metodo: 'autodeclaracao', verified_at: verifiedAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar acesso' });
  }
}

module.exports = {
  getCategorias, getResumo, getEstabelecimentos, getEstabelecimento, getProdutosEstabelecimento,
  getProdutos, getQueroAgora, verificarIdade, registrarAcesso,
};
