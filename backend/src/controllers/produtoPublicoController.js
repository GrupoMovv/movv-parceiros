const db = require('../config/database');

const TIPOS_EVENTO_VALIDOS = ['ver_produto', 'clique_whatsapp'];

async function buscarAssociadoIdPorHash(hash) {
  if (!hash) return null;
  const r = await db.query('SELECT id FROM sindicato_associados WHERE carteirinha_hash = $1', [hash]);
  return r.rows[0]?.id || null;
}

async function getProduto(req, res) {
  try {
    const result = await db.query(
      `SELECT
         pr.id, pr.nome, pr.descricao, pr.preco, pr.preco_associado, pr.categoria, pr.marca,
         pr.estoque_disponivel, pr.destaque, pr.fotos, pr.created_at,
         pa.id AS parceiro_id, pa.slug AS parceiro_slug, pa.nome AS parceiro_nome,
         pa.icone AS parceiro_icone, pa.cor_icone AS parceiro_cor_icone, pa.logo_url AS parceiro_logo_url,
         pa.categoria_principal AS parceiro_categoria, pa.endereco AS parceiro_endereco,
         pa.bairro AS parceiro_bairro, pa.cidade AS parceiro_cidade, pa.whatsapp AS parceiro_whatsapp
       FROM sindicato_parceiro_produtos pr
       JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
       WHERE pr.id = $1 AND pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produto' });
  }
}

async function getOutrosDoParceiro(req, res) {
  try {
    const atual = await db.query('SELECT parceiro_id FROM sindicato_parceiro_produtos WHERE id = $1', [req.params.id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });

    const result = await db.query(
      `SELECT id, nome, preco, preco_associado, fotos FROM sindicato_parceiro_produtos
       WHERE parceiro_id = $1 AND id != $2 AND ativo = true AND rascunho = false
       ORDER BY created_at DESC LIMIT 6`,
      [atual.rows[0].parceiro_id, req.params.id]
    );
    return res.json({ produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar outros produtos' });
  }
}

// Sem autenticacao (pagina publica) - so aceita os tipos conhecidos, pra nao
// virar uma gaveta de lixo com "tipo" arbitrario vindo do cliente.
async function registrarEvento(req, res) {
  try {
    const tipo = TIPOS_EVENTO_VALIDOS.includes(req.body.tipo) ? req.body.tipo : 'ver_produto';

    const produto = await db.query('SELECT id, parceiro_id FROM sindicato_parceiro_produtos WHERE id = $1', [req.params.id]);
    if (!produto.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });

    const associadoId = await buscarAssociadoIdPorHash(req.body.associado_hash);

    await db.query(
      `INSERT INTO sindicato_parceiro_cliques (parceiro_id, produto_id, tipo, associado_id)
       VALUES ($1, $2, $3, $4)`,
      [produto.rows[0].parceiro_id, produto.rows[0].id, tipo, associadoId]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar evento' });
  }
}

module.exports = { getProduto, getOutrosDoParceiro, registrarEvento };
