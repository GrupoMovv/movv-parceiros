const db = require('../config/database');
const { PLANOS, planoEfetivo, sqlPlanoVigente, limiteDestaquesBeer } = require('../config/planos');
const { IDADE_MINIMA, DIAS, idadeEmAnos, diaDeHoje, normalizarTexto, abertoEfetivo, FAIXAS_VOLUME, faixaVolume } = require('../config/beer');
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
  be.bairros_entrega, be.horario_funcionamento, be.status_aberto, be.ultimo_status_update, be.tempo_entrega_min, be.retirada_disponivel,
  pa.plano, pa.plano_expira_em, pa.cortesia_interna
`;

// Tira os campos internos e devolve o que vale AGORA: plano efetivo e
// status_aberto EFETIVO — botão "Aberto agora" ligado dentro do turno do
// horário e neste turno (config/beer.js abertoEfetivo). O cliente nunca vê
// o valor cru do botão: esquecido ligado de ontem = Fechado.
function publicoEstabelecimento({ plano_expira_em, cortesia_interna, estabelecimento_id, ultimo_status_update, ...e }) {
  return {
    id: estabelecimento_id, ...e,
    status_aberto: abertoEfetivo({ ...e, ultimo_status_update }),
    plano: planoEfetivo({ ...e, plano_expira_em, cortesia_interna }),
  };
}

// Mesma ordem do SQL (plano), com quem está aberto DE VERDADE na frente
// dentro de cada plano — "aberto" só dá pra saber em JS (turno do horário).
function ordenarAbertosPrimeiro(lista) {
  const peso = e => PLANOS[e.plano]?.boost_busca || 0;
  return [...lista].sort((a, b) => (peso(b) - peso(a)) || (Number(b.status_aberto) - Number(a.status_aberto)));
}

// Oferta vale só dentro do prazo. Vencida (sem cron pra desfazer) = volta
// o preço normal NA LEITURA: preco_original guarda o normal enquanto a
// oferta existe (migration 059).
const SQL_OFERTA_ATIVA = `(bp.em_oferta AND bp.preco_original IS NOT NULL AND bp.oferta_ate > NOW())`;
const SQL_PRECO_VIGENTE = `(CASE WHEN ${SQL_OFERTA_ATIVA} THEN bp.preco ELSE COALESCE(bp.preco_original, bp.preco) END)`;

function publicoProduto(r) {
  const estabelecimento = publicoEstabelecimento(r);
  return {
    id: r.produto_id, nome: r.produto_nome, descricao: r.descricao, preco: r.preco_vigente, imagem: r.imagem,
    em_oferta: r.oferta_ativa, preco_original: r.oferta_ativa ? r.preco_original : null, oferta_ate: r.oferta_ativa ? r.oferta_ate : null,
    volume_ml: r.volume_ml, origem: r.origem,
    disponivel_agora: r.disponivel_agora, dias_disponiveis: r.dias_disponiveis,
    // destaque só vale se o plano que vale AGORA dá direito (Grátis = 0 —
    // plano pago venceu, a estrela some sem precisar editar o produto)
    destaque: Boolean(r.destaque) && limiteDestaquesBeer(estabelecimento.plano) > 0,
    categoria: { codigo: r.categoria_codigo, nome: r.categoria_nome, icone: r.categoria_icone, regulamentada: r.regulamentada, pai: r.categoria_pai },
    estabelecimento,
  };
}

const SELECT_PRODUTO = `
  bp.id AS produto_id, bp.nome AS produto_nome, bp.descricao, bp.imagem, bp.disponivel_agora,
  bp.dias_disponiveis, bp.destaque, bp.categoria_codigo, bp.volume_ml, bp.origem, bp.created_at AS produto_criado_em,
  ${SQL_PRECO_VIGENTE} AS preco_vigente, ${SQL_OFERTA_ATIVA} AS oferta_ativa, bp.preco_original, bp.oferta_ate,
  bc.nome_exibicao AS categoria_nome, bc.icone AS categoria_icone, bc.regulamentada, bc.categoria_pai,
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
      `SELECT be.status_aberto, be.ultimo_status_update, be.horario_funcionamento
       FROM beer_estabelecimentos be JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
       WHERE ${WHERE_ESTABELECIMENTO_VISIVEL}`
    );
    return res.json({ estabelecimentos: r.rows.length, abertos: r.rows.filter(e => abertoEfetivo(e)).length });
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
    // botão ligado é condição necessária; o turno confere em JS lá embaixo
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
       ORDER BY ${sqlOrdemPlano()} DESC, pa.nome ASC`,
      params
    );

    let lista = result.rows;
    if (bairro) {
      const alvo = normalizarTexto(bairro);
      lista = lista.filter(e => (e.bairros_entrega || []).some(b => normalizarTexto(b) === alvo));
    }
    lista = ordenarAbertosPrimeiro(lista.map(publicoEstabelecimento));
    if (aberto === 'true') lista = lista.filter(e => e.status_aberto);
    return res.json({ estabelecimentos: lista });
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
  const produtos = linhas.map(publicoProduto);
  return soAbertos ? produtos.filter(p => p.estabelecimento.status_aberto) : produtos;
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

// ---------------------------------------------------------------------
// GET /categoria/:codigo — tela de categoria inteira numa chamada:
// seções (Ofertas do dia, Adegas abertas agora, Destaques — só na página
// 1), a página de "Todos os produtos" (20 por vez), o total pro contador e
// as facetas dos filtros avançados (faixa de preço, estabelecimentos,
// volumes, origens que EXISTEM nessa categoria).
//   ?sub=vinho_tinto            subcategoria (quando :codigo é grupo)
//   ?abertos=true               só estabelecimento aberto de verdade agora
//   ?preco_min=10&preco_max=80  no preço que vale agora (oferta incluída)
//   ?est=3,7   ?vol=ate_355,ate_750   ?origem=Chile,Argentina
//   ?ordem=relevancia|menor_preco|maior_preco|estabelecimento|rapido
//   ?pagina=2
// Filtra em JS de propósito: "aberto" depende do turno do horário (só dá
// pra saber em JS) e o catálogo de uma categoria numa cidade cabe na
// memória — teto de 2000 linhas por segurança.
const POR_PAGINA = 20;
const ORDENS = ['relevancia', 'menor_preco', 'maior_preco', 'estabelecimento', 'rapido'];
const pesoPlano = e => PLANOS[e.plano]?.boost_busca || 0;
const num = v => (v === undefined || v === '' || v === null ? null : Number(v));
const lista = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);

function ordenar(produtos, ordem) {
  const precoDe = p => Number(p.preco);
  const porRelevancia = (a, b) => (Number(b.destaque) - Number(a.destaque))
    || (pesoPlano(b.estabelecimento) - pesoPlano(a.estabelecimento))
    || (Number(b.estabelecimento.status_aberto) - Number(a.estabelecimento.status_aberto))
    || (Number(b.disponivel_agora) - Number(a.disponivel_agora))
    || (b.id - a.id);
  const cmp = {
    relevancia: porRelevancia,
    menor_preco: (a, b) => (precoDe(a) - precoDe(b)) || porRelevancia(a, b),
    maior_preco: (a, b) => (precoDe(b) - precoDe(a)) || porRelevancia(a, b),
    estabelecimento: (a, b) => a.estabelecimento.nome.localeCompare(b.estabelecimento.nome, 'pt-BR') || (precoDe(a) - precoDe(b)),
    // sem tempo informado vai pro fim; empate = relevância
    rapido: (a, b) => ((a.estabelecimento.tempo_entrega_min ?? 9999) - (b.estabelecimento.tempo_entrega_min ?? 9999)) || porRelevancia(a, b),
  }[ordem];
  return [...produtos].sort(cmp);
}

function contarPor(itens, chaveDe) {
  const m = new Map();
  itens.forEach(i => {
    const { chave, ...dados } = chaveDe(i) || {};
    if (chave === undefined) return;
    m.set(chave, { ...dados, total: (m.get(chave)?.total || 0) + 1 });
  });
  return [...m.values()];
}

async function getCategoria(req, res) {
  try {
    const cats = (await db.query(
      'SELECT codigo, nome_exibicao AS nome, categoria_pai, icone, ordem, regulamentada FROM beer_categorias WHERE ativo = true ORDER BY ordem'
    )).rows;
    const cat = cats.find(c => c.codigo === req.params.codigo);
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    const grupo = cat.categoria_pai ? cats.find(c => c.codigo === cat.categoria_pai) : cat;
    const ehGrupo = !cat.categoria_pai;

    const q = req.query;
    const sub = ehGrupo && q.sub && cats.some(c => c.codigo === q.sub && c.categoria_pai === cat.codigo) ? q.sub : null;
    const ordem = ORDENS.includes(q.ordem) ? q.ordem : 'relevancia';
    const pagina = Math.max(1, parseInt(q.pagina, 10) || 1);
    const precoMin = num(q.preco_min);
    const precoMax = num(q.preco_max);
    const ests = new Set(lista(q.est).map(Number).filter(Number.isInteger));
    const vols = new Set(lista(q.vol).filter(v => FAIXAS_VOLUME.some(fx => fx.chave === v)));
    const origens = new Set(lista(q.origem).map(normalizarTexto));

    const r = await db.query(
      `SELECT ${SELECT_PRODUTO} ${FROM_PRODUTO}
       WHERE ${WHERE_PRODUTO_VISIVEL} AND (bp.categoria_codigo = $1 OR bc.categoria_pai = $1)
       LIMIT 2000`,
      [cat.codigo]
    );
    const daCategoria = r.rows.map(publicoProduto);

    // Chips de subcategoria com contagem (categoria inteira, antes do sub)
    const subcategorias = ehGrupo
      ? cats.filter(c => c.categoria_pai === cat.codigo)
        .map(c => ({ codigo: c.codigo, nome: c.nome, total: daCategoria.filter(p => p.categoria.codigo === c.codigo).length }))
      : [];

    // Facetas: o que existe DEPOIS do sub e ANTES dos filtros avançados —
    // o painel de filtros só oferece opção que tem resultado.
    const base = sub ? daCategoria.filter(p => p.categoria.codigo === sub) : daCategoria;
    const precos = base.map(p => Number(p.preco));
    const facetas = {
      preco_min: precos.length ? Math.floor(Math.min(...precos)) : 0,
      preco_max: precos.length ? Math.ceil(Math.max(...precos)) : 0,
      estabelecimentos: contarPor(base, p => ({ chave: p.estabelecimento.id, id: p.estabelecimento.id, nome: p.estabelecimento.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      volumes: FAIXAS_VOLUME.map(fx => ({ chave: fx.chave, label: fx.label, total: base.filter(p => faixaVolume(p.volume_ml) === fx.chave).length }))
        .filter(fx => fx.total > 0),
      origens: contarPor(base.filter(p => p.origem), p => ({ chave: normalizarTexto(p.origem), valor: p.origem.trim() }))
        .sort((a, b) => a.valor.localeCompare(b.valor, 'pt-BR')),
    };

    const filtrados = base.filter(p => {
      const preco = Number(p.preco);
      if (q.abertos === 'true' && !p.estabelecimento.status_aberto) return false;
      if (precoMin !== null && preco < precoMin) return false;
      if (precoMax !== null && preco > precoMax) return false;
      if (ests.size && !ests.has(p.estabelecimento.id)) return false;
      if (vols.size && !vols.has(faixaVolume(p.volume_ml))) return false;
      if (origens.size && !(p.origem && origens.has(normalizarTexto(p.origem)))) return false;
      return true;
    });

    const todos = ordenar(filtrados, ordem);
    let secoes = null;
    if (pagina === 1) {
      const desconto = p => 1 - Number(p.preco) / Number(p.preco_original);
      const adegas = new Map();
      filtrados.filter(p => p.estabelecimento.status_aberto).forEach(p => {
        const atual = adegas.get(p.estabelecimento.id) || { ...p.estabelecimento, total_na_categoria: 0 };
        atual.total_na_categoria += 1;
        adegas.set(p.estabelecimento.id, atual);
      });
      secoes = {
        ofertas: filtrados.filter(p => p.em_oferta).sort((a, b) => desconto(b) - desconto(a)).slice(0, 12),
        // Master > Premium > Oficial (Grátis não tem destaque, ver publicoProduto)
        destaques: filtrados.filter(p => p.destaque)
          .sort((a, b) => (pesoPlano(b.estabelecimento) - pesoPlano(a.estabelecimento))
            || (Number(b.estabelecimento.status_aberto) - Number(a.estabelecimento.status_aberto)))
          .slice(0, 24),
        adegas_abertas: [...adegas.values()].sort((a, b) => (pesoPlano(b) - pesoPlano(a)) || (b.total_na_categoria - a.total_na_categoria)),
      };
    }

    return res.json({
      categoria: { codigo: cat.codigo, nome: cat.nome, icone: cat.icone, regulamentada: cat.regulamentada, eh_grupo: ehGrupo },
      grupo: { codigo: grupo.codigo, nome: grupo.nome, icone: grupo.icone },
      subcategorias,
      sub,
      total: filtrados.length,
      pagina,
      por_pagina: POR_PAGINA,
      tem_mais: pagina * POR_PAGINA < todos.length,
      produtos: todos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
      secoes,
      facetas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar categoria' });
  }
}

// GET /produtos/:id — um produto visível (modal aberto por link ?p=ID).
async function getProduto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(404).json({ error: 'Produto não encontrado' });
    const r = await db.query(`SELECT ${SELECT_PRODUTO} ${FROM_PRODUTO} WHERE ${WHERE_PRODUTO_VISIVEL} AND bp.id = $1`, [id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(publicoProduto(r.rows[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produto' });
  }
}

module.exports = {
  getCategoria, getProduto,
  getCategorias, getResumo, getEstabelecimentos, getEstabelecimento, getProdutosEstabelecimento,
  getProdutos, getQueroAgora, verificarIdade, registrarAcesso,
};
