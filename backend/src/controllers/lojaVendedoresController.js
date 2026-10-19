// Equipe de vendas da loja — aba "Equipe de vendas" do painel
// (/api/parceiro/equipe). Regras em services/lojaVendedores.js.
const db = require('../config/database');
const lv = require('../services/lojaVendedores');

function responderErro(res, err) {
  if (err instanceof lv.ErroEquipe) return res.status(err.status).json({ error: err.message, codigo: err.codigo });
  console.error('[equipe de vendas]', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

// Lista + limite do plano + produtos da loja (para o "link de um produto").
async function ver(req, res) {
  try {
    const produtos = (await db.query(
      `SELECT id, nome FROM sindicato_parceiro_produtos
        WHERE parceiro_id = $1 AND ativo AND NOT rascunho AND moderacao_status = 'aprovado'
        ORDER BY nome ASC LIMIT 300`, [req.parceiro.id])).rows;
    return res.json({ ...(await lv.listar(req.parceiro)), produtos });
  } catch (err) { return responderErro(res, err); }
}

const acao = fn => async (req, res) => {
  try { return res.json(await fn(req)); } catch (err) { return responderErro(res, err); }
};

// GET /api/public/vendedor/:codigo — destino do link /v/CÓDIGO (público).
async function destinoPublico(req, res) {
  try {
    const d = await lv.destinoDoCodigo(req.params.codigo, req.modoQa);
    if (!d) return res.status(404).json({ error: 'Link não encontrado' });
    return res.json(d);
  } catch (err) { return responderErro(res, err); }
}

module.exports = {
  ver,
  destinoPublico,
  criar: async (req, res) => {
    try { return res.status(201).json(await lv.criar(req.parceiro, req.parceiroUsuario, req.body)); } catch (err) { return responderErro(res, err); }
  },
  editar: acao(req => lv.editar(req.parceiro, req.parceiroUsuario, req.params.id, req.body)),
  desativar: acao(req => lv.desativar(req.parceiro, req.params.id)),
  ativar: acao(req => lv.ativar(req.parceiro, req.params.id)),
  novoCodigo: acao(req => lv.novoCodigo(req.parceiro, req.params.id)),
};
