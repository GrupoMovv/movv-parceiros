const db = require('../config/database');
const { montarLinkWhatsapp } = require('../utils/whatsapp');

function formatarPrecoBRL(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function buscarAssociadoAtivoPorHash(hash) {
  if (!hash) return null;
  const r = await db.query(
    `SELECT nome_completo, carteirinha_hash FROM sindicato_associados
     WHERE carteirinha_hash = $1 AND ativo = true AND carteirinha_valida_ate >= CURRENT_DATE`,
    [hash]
  );
  return r.rows[0] || null;
}

const BACKEND_URL = process.env.BACKEND_URL || 'https://movv-backend.onrender.com';

function montarMensagemGrupo(produtos, associado) {
  const linhas = ['Olá! Vi seus produtos no IUB Marketplace e tenho interesse em:', ''];
  let total = 0;
  for (const p of produtos) {
    const preco = p.preco_associado != null ? parseFloat(p.preco_associado) : parseFloat(p.preco);
    total += preco;
    linhas.push(`🛍️ ${p.nome} — ${formatarPrecoBRL(preco)}`);
  }
  linhas.push('', `Total estimado: ${formatarPrecoBRL(total)}`);

  if (associado) {
    linhas.push('', `📇 Meu nome: ${associado.nome_completo}`, '🎫 Sou associado SECI ativo', `🔗 Minha carteirinha: ${BACKEND_URL}/carteirinha/${associado.carteirinha_hash}`);
  }

  linhas.push('', 'Poderia me passar mais informações sobre disponibilidade?');
  return { mensagem: linhas.join('\n'), total };
}

// Núcleo compartilhado entre a rota pública (visitante, produto_ids vêm do
// localStorage do front) e a autenticada (associado, produto_ids vêm do
// banco) — busca produtos válidos, agrupa por parceiro e já monta a
// mensagem de WhatsApp pronta de cada grupo. Produto inativo/apagado desde
// que foi guardado no carrinho simplesmente não aparece — o id fica em
// `produtos_invalidos` pro front saber que pode limpar do carrinho local.
async function montarGrupos(produtoIds, associado) {
  if (produtoIds.length === 0) return { grupos: [], produtos_invalidos: [] };

  const result = await db.query(
    `SELECT pr.id, pr.nome, pr.preco, pr.preco_associado, pr.fotos,
            pa.id AS parceiro_id, pa.nome AS parceiro_nome, pa.slug AS parceiro_slug,
            pa.whatsapp AS parceiro_whatsapp, pa.logo_url AS parceiro_logo_url
     FROM sindicato_parceiro_produtos pr
     JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
     WHERE pr.id = ANY($1) AND pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'`,
    [produtoIds]
  );

  const encontrados = new Set(result.rows.map(r => r.id));
  const produtosInvalidos = produtoIds.filter(id => !encontrados.has(id));

  const porParceiro = new Map();
  for (const row of result.rows) {
    const grupo = porParceiro.get(row.parceiro_id) || {
      parceiro_id: row.parceiro_id,
      parceiro_nome: row.parceiro_nome,
      parceiro_slug: row.parceiro_slug,
      parceiro_whatsapp: row.parceiro_whatsapp,
      parceiro_logo_url: row.parceiro_logo_url,
      produtos: [],
    };
    grupo.produtos.push({
      id: row.id,
      nome: row.nome,
      preco: row.preco,
      preco_associado: row.preco_associado,
      foto_url: row.fotos?.[0]?.url || null,
    });
    porParceiro.set(row.parceiro_id, grupo);
  }

  const grupos = [...porParceiro.values()].map(grupo => {
    const { mensagem, total } = montarMensagemGrupo(grupo.produtos, associado);
    return {
      ...grupo,
      total_estimado: total,
      mensagem,
      url_final: grupo.parceiro_whatsapp ? montarLinkWhatsapp(grupo.parceiro_whatsapp, mensagem) : null,
    };
  });

  return { grupos, produtos_invalidos: produtosInvalidos };
}

// POST /api/public/carrinho/detalhar — pra visitante sem sessão: front
// manda os produto_id guardados no localStorage, backend devolve tudo já
// agrupado/pronto pra exibir e chamar no WhatsApp (nunca confia em nome/
// preço que o localStorage possa ter guardado, sempre busca do banco de
// novo — evita mostrar preço desatualizado).
async function detalhar(req, res) {
  try {
    const produtoIds = Array.isArray(req.body.produto_ids) ? req.body.produto_ids.map(Number).filter(Number.isInteger) : [];
    const associado = await buscarAssociadoAtivoPorHash(req.body.associado_hash);
    const { grupos, produtos_invalidos } = await montarGrupos(produtoIds, associado);
    return res.json({ grupos, produtos_invalidos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar carrinho' });
  }
}

// GET /api/public/carrinho — associado logado, carrinho persistido no banco.
async function listar(req, res) {
  try {
    const itensResult = await db.query(
      'SELECT produto_id FROM sindicato_associado_carrinho WHERE associado_id = $1 ORDER BY adicionado_em DESC',
      [req.painelAssociado.id]
    );
    const produtoIds = itensResult.rows.map(r => r.produto_id);
    const { grupos, produtos_invalidos } = await montarGrupos(produtoIds, req.painelAssociado);
    return res.json({ grupos, produtos_invalidos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar carrinho' });
  }
}

async function adicionar(req, res) {
  try {
    const produtoId = parseInt(req.body.produto_id, 10);
    if (!Number.isInteger(produtoId)) return res.status(400).json({ error: 'produto_id é obrigatório' });

    await db.query(
      `INSERT INTO sindicato_associado_carrinho (associado_id, produto_id, observacoes)
       VALUES ($1, $2, $3)
       ON CONFLICT (associado_id, produto_id) DO NOTHING`,
      [req.painelAssociado.id, produtoId, req.body.observacoes || null]
    );
    return listar(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao adicionar ao carrinho' });
  }
}

async function remover(req, res) {
  try {
    const produtoId = parseInt(req.params.produto_id, 10);
    await db.query(
      'DELETE FROM sindicato_associado_carrinho WHERE associado_id = $1 AND produto_id = $2',
      [req.painelAssociado.id, produtoId]
    );
    return listar(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover do carrinho' });
  }
}

async function limpar(req, res) {
  try {
    await db.query('DELETE FROM sindicato_associado_carrinho WHERE associado_id = $1', [req.painelAssociado.id]);
    return res.json({ grupos: [], produtos_invalidos: [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao limpar carrinho' });
  }
}

// POST /api/public/carrinho/migrar — chamado uma vez, na hora do login,
// pra levar o carrinho que a pessoa já tinha montado no localStorage (como
// visitante) pro banco. ON CONFLICT DO NOTHING porque um produto pode já
// estar no carrinho salvo de uma sessão anterior no banco.
async function migrar(req, res) {
  try {
    const produtoIds = Array.isArray(req.body.produto_ids) ? req.body.produto_ids.map(Number).filter(Number.isInteger) : [];
    for (const produtoId of produtoIds) {
      try {
        await db.query(
          `INSERT INTO sindicato_associado_carrinho (associado_id, produto_id)
           VALUES ($1, $2) ON CONFLICT (associado_id, produto_id) DO NOTHING`,
          [req.painelAssociado.id, produtoId]
        );
      } catch {
        // produto do carrinho local pode ter sido excluído/desativado desde
        // que foi guardado — ignora esse item e segue migrando o resto,
        // uma FK inválida não pode derrubar a migração inteira.
      }
    }
    return listar(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao migrar carrinho' });
  }
}

module.exports = { detalhar, listar, adicionar, remover, limpar, migrar };
