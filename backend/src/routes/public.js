const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const produtoCtrl = require('../controllers/produtoPublicoController');
const marketplaceHomeCtrl = require('../controllers/marketplaceHomeController');
const promocaoCtrl = require('../controllers/promocaoPublicoController');

const CATALOGO_PDF_PATH = path.join(__dirname, '../../uploads/beneficios/catalogo-beneficios-seci.pdf');

// Campos públicos da carteirinha digital: nunca inclui CPF, data de
// nascimento ou celular (dado sensível — a página é acessada sem login,
// só com o hash de 12 caracteres da URL).
async function buscarCarteirinhaPorHash(hash) {
  const associadoResult = await db.query(
    `SELECT a.id, a.nome_completo, a.foto_url, a.categoria_profissional, a.codigo_filiado,
            a.ativo, a.carteirinha_valida_ate, a.empresa_nome_livre,
            COALESCE(NULLIF(e.nome_fantasia, ''), e.razao_social) AS empresa_cadastrada,
            (SELECT COUNT(*)::int FROM sindicato_associados_dependentes dd WHERE dd.associado_id = a.id) AS dependentes_count
     FROM sindicato_associados a
     LEFT JOIN sindicato_empresas e ON e.id = a.empresa_id
     WHERE a.carteirinha_hash = $1`,
    [hash]
  );
  if (associadoResult.rows[0]) {
    const a = associadoResult.rows[0];
    return {
      tipo: 'associado',
      associado_id: a.id,
      nome: a.nome_completo,
      foto_url: a.foto_url,
      empresa: a.empresa_cadastrada || a.empresa_nome_livre || null,
      numero_associado: a.codigo_filiado,
      categoria: a.categoria_profissional,
      valida_ate: a.carteirinha_valida_ate,
      ativo: a.ativo,
      dependentes_count: a.dependentes_count,
    };
  }

  const depResult = await db.query(
    `SELECT d.id, d.nome, d.grau, d.foto_url, d.carteirinha_valida_ate,
            a.id AS associado_id, a.nome_completo AS titular_nome,
            a.ativo AS titular_ativo, a.empresa_nome_livre,
            COALESCE(NULLIF(e.nome_fantasia, ''), e.razao_social) AS empresa_cadastrada
     FROM sindicato_associados_dependentes d
     JOIN sindicato_associados a ON a.id = d.associado_id
     LEFT JOIN sindicato_empresas e ON e.id = a.empresa_id
     WHERE d.carteirinha_hash = $1`,
    [hash]
  );
  if (depResult.rows[0]) {
    const d = depResult.rows[0];
    return {
      tipo: 'dependente',
      dependente_id: d.id,
      nome: d.nome,
      foto_url: d.foto_url, // foto própria do dependente — nunca a do titular
      empresa: d.empresa_cadastrada || d.empresa_nome_livre || null,
      grau: d.grau,
      titular_nome: d.titular_nome,
      valida_ate: d.carteirinha_valida_ate,
      ativo: d.titular_ativo,
    };
  }

  return null;
}

// Rota pública (sem autenticação) — link enviado pelo Renan via WhatsApp.
router.get('/beneficios/catalogo.pdf', (req, res) => {
  if (!fs.existsSync(CATALOGO_PDF_PATH)) {
    return res.status(404).json({ error: 'Catálogo de benefícios não encontrado' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="catalogo-beneficios-seci.pdf"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(CATALOGO_PDF_PATH);
});

// Estatistica discreta pro hero do marketplace ("X associados") — so
// contagem, sem nenhum dado pessoal, endpoint publico por design.
router.get('/marketplace/stats', async (req, res) => {
  try {
    const r = await db.query('SELECT COUNT(*)::int AS total FROM sindicato_associados WHERE ativo = true');
    return res.json({ associados: r.rows[0].total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

router.get('/marketplace/vitrine-rotativa', marketplaceHomeCtrl.getVitrineRotativa);
router.get('/marketplace/ofertas-semana', marketplaceHomeCtrl.getOfertasSemana);
router.get('/marketplace/exclusivos-associados', marketplaceHomeCtrl.getExclusivosAssociados);
router.get('/marketplace/novidades', marketplaceHomeCtrl.getNovidades);
router.get('/marketplace/mais-vendidos', marketplaceHomeCtrl.getMaisVendidos);
router.get('/marketplace/categorias', marketplaceHomeCtrl.getCategorias);
router.get('/marketplace/categoria/:slug/produtos', marketplaceHomeCtrl.getProdutosPorCategoria);
router.get('/marketplace/parceiros', marketplaceHomeCtrl.getParceiros);

router.get('/produtos/:id', produtoCtrl.getProduto);
router.get('/produtos/:id/outros-do-parceiro', produtoCtrl.getOutrosDoParceiro);
router.get('/produtos/:id/mensagem-whatsapp', produtoCtrl.getMensagemWhatsapp);
router.post('/produtos/:id/visualizacao', produtoCtrl.registrarEvento);

router.get('/promocoes/:id', promocaoCtrl.getPromocao);
router.get('/promocoes/:id/mensagem-whatsapp', promocaoCtrl.getMensagemWhatsapp);
router.post('/promocoes/:id/visualizacao', promocaoCtrl.registrarEvento);

router.get('/carteirinha/:hash', async (req, res) => {
  try {
    const dados = await buscarCarteirinhaPorHash(req.params.hash);
    if (!dados) return res.status(404).json({ error: 'Carteirinha não encontrada' });
    return res.json(dados);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar carteirinha' });
  }
});

router.post('/carteirinha/:hash/registrar-uso', async (req, res) => {
  try {
    const { parceiro_nome } = req.body;
    if (!parceiro_nome) return res.status(400).json({ error: 'parceiro_nome é obrigatório' });

    const dados = await buscarCarteirinhaPorHash(req.params.hash);
    if (!dados) return res.status(404).json({ error: 'Carteirinha não encontrada' });

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    await db.query(
      `INSERT INTO sindicato_uso_beneficios (associado_id, dependente_id, parceiro_nome, ip_origem, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        dados.tipo === 'associado' ? dados.associado_id : null,
        dados.tipo === 'dependente' ? dados.dependente_id : null,
        parceiro_nome,
        ip || null,
        req.headers['user-agent'] || null,
      ]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar uso' });
  }
});

module.exports = router;
