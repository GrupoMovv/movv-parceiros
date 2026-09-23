const db = require('../config/database');
const { PLANOS, planoEfetivo, sqlPlanoVigente } = require('../config/planos');
const { CATEGORIAS_PRODUTO, IDADE_MINIMA, idadeEmAnos } = require('../config/beer');
const { normalizarCategoria, ehRestaurante, ehBebidas } = require('../utils/categorias');
const { onlyDigits, isValidCPF } = require('../utils/validators');

// IUB BEER — mesma lógica do IUB Food (getFood/getFoodPorSlug em
// marketplaceHomeController): estabelecimento = parceiro ativo com
// "Bebidas" no categorias[], cardápio = sindicato_parceiro_produtos.
// Filtro de categoria em JS (não SQL) pelo mesmo motivo do Food:
// categorias[] é texto livre de várias telas, precisa comparar sem acento.

// Master > Premium > Oficial > Grátis, com plano pago vencido valendo 0 —
// mesma regra do sqlBoostBusca da home, repetida aqui pra não exportar o
// helper interno daquele controller.
function sqlOrdemPlano() {
  const casos = Object.entries(PLANOS).map(([plano, cfg]) => `WHEN pa.plano = '${plano}' THEN ${cfg.boost_busca}`).join(' ');
  return `(CASE WHEN NOT ${sqlPlanoVigente('pa.')} THEN 0 ${casos} ELSE 0 END)`;
}

const SELECT_ESTABELECIMENTO = `
  pa.id, pa.slug, pa.nome, pa.logo_url, pa.categorias, pa.categoria_principal,
  pa.plano, pa.plano_expira_em, pa.cortesia_interna,
  pa.beer_tipo, pa.bairro, pa.bairros_entrega, pa.horario_funcionamento,
  pa.delivery_disponivel, pa.retirada_disponivel, pa.taxa_entrega, pa.entrega_gratis_acima, pa.tempo_preparo_min
`;

// Categorias de bebida que o estabelecimento TEM no cardápio agora (chips
// do card e filtro ?categoria=). Só conta item ativo e publicado.
const SQL_CATEGORIAS_BEBIDA = `
  (SELECT COALESCE(array_agg(DISTINCT pr.beer_categoria) FILTER (WHERE pr.beer_categoria IS NOT NULL), '{}')
   FROM sindicato_parceiro_produtos pr
   WHERE pr.parceiro_id = pa.id AND pr.ativo = true AND pr.rascunho = false) AS categorias_bebida
`;

// Nunca devolve plano_expira_em/cortesia_interna pro público — só servem
// pra calcular o plano que vale agora.
function publico({ plano_expira_em, cortesia_interna, ...p }) {
  return { ...p, plano: planoEfetivo({ ...p, plano_expira_em, cortesia_interna }) };
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
}

// GET /api/public/beer/estabelecimentos?categoria=cerveja&bairro=centro
// `bairro` casa com bairros_entrega OU, se o parceiro não informou bairros
// de entrega, com o bairro do próprio endereço.
async function getEstabelecimentos(req, res) {
  try {
    const { categoria, bairro } = req.query;
    if (categoria && !CATEGORIAS_PRODUTO.includes(categoria)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    const result = await db.query(
      `SELECT ${SELECT_ESTABELECIMENTO}, ${SQL_CATEGORIAS_BEBIDA}
       FROM sindicato_parceiros pa
       WHERE pa.status = 'ativo'
       ORDER BY ${sqlOrdemPlano()} DESC, pa.nome ASC`
    );

    let lista = result.rows.filter(p => ehBebidas(p.categorias));
    if (categoria) lista = lista.filter(p => p.categorias_bebida.includes(categoria));
    if (bairro) {
      const alvo = normalizarCategoria(bairro);
      lista = lista.filter(p => (p.bairros_entrega?.length ? p.bairros_entrega : [p.bairro])
        .some(b => normalizarCategoria(b) === alvo));
    }

    return res.json({ estabelecimentos: lista.map(publico) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estabelecimentos' });
  }
}

async function buscarEstabelecimento(slug) {
  const result = await db.query(
    `SELECT ${SELECT_ESTABELECIMENTO}, ${SQL_CATEGORIAS_BEBIDA},
            pa.descricao, pa.descricao_completa, pa.endereco, pa.cidade, pa.whatsapp, pa.fotos_estabelecimento
     FROM sindicato_parceiros pa
     WHERE pa.slug = $1 AND pa.status = 'ativo'`,
    [slug]
  );
  const parceiro = result.rows[0];
  return parceiro && ehBebidas(parceiro.categorias) ? parceiro : null;
}

// GET /api/public/beer/estabelecimentos/:slug — 404 tanto pra slug
// inexistente quanto pra parceiro sem "Bebidas" (igual getFoodPorSlug).
// Por slug, não id: é o que vai na URL (/beer/:slug), como /food/:slug.
async function getEstabelecimento(req, res) {
  try {
    const parceiro = await buscarEstabelecimento(req.params.slug);
    if (!parceiro) return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    return res.json(publico(parceiro));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estabelecimento' });
  }
}

// GET /api/public/beer/estabelecimentos/:slug/produtos?categoria=vinho
// Parceiro que também é restaurante (Food + Beer) mostra aqui só o que foi
// marcado com beer_categoria — senão o cardápio de bebidas vinha com prato
// de comida no meio. Adega/distribuidora "pura" mostra o catálogo inteiro
// (tudo que ela vende é do Beer, mesmo item ainda sem categoria marcada).
async function getProdutos(req, res) {
  try {
    const { categoria } = req.query;
    if (categoria && !CATEGORIAS_PRODUTO.includes(categoria)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }
    const parceiro = await buscarEstabelecimento(req.params.slug);
    if (!parceiro) return res.status(404).json({ error: 'Estabelecimento não encontrado' });

    const filtros = ['parceiro_id = $1', 'ativo = true', 'rascunho = false'];
    const params = [parceiro.id];
    if (ehRestaurante(parceiro.categorias)) filtros.push('beer_categoria IS NOT NULL');
    if (categoria) { params.push(categoria); filtros.push(`beer_categoria = $${params.length}`); }

    const result = await db.query(
      `SELECT id, nome, descricao, preco, preco_associado, fotos, estoque_disponivel, destaque, beer_categoria
       FROM sindicato_parceiro_produtos
       WHERE ${filtros.join(' AND ')}
       ORDER BY destaque DESC, created_at DESC`,
      params
    );
    return res.json({ produtos: result.rows });
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

// POST /api/public/beer/verificar-idade  { cpf, data_nascimento }
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

// POST /api/public/beer/registrar-acesso  { confirmado?: true }
// Chamado ao entrar no /beer. Associado logado COM data de nascimento no
// cadastro: vale o cadastro (maior entra direto sem modal; menor fica de
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

module.exports = { getEstabelecimentos, getEstabelecimento, getProdutos, verificarIdade, registrarAcesso };
