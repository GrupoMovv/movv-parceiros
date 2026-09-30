const router = require('express').Router();
const ctrl = require('../controllers/beerController');
const { lerPainelPublicoOpcional } = require('../middleware/painelPublicoAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');
const { lerAdminOpcional } = require('../middleware/auth');

// IUB DISK BEBIDAS — rotas públicas (sob /api/public, igual Food). O que o
// parceiro edita (status, produtos, disponibilidade) fica em
// /api/parceiro/beer (routes/parceiroBeer.js, sessão do parceiro); a
// moderação em /api/sindicato-beer (routes/sindicatoBeer.js, admin).
// Admin logado → req.modoQa: vê também as empresas de teste.
router.use(lerAdminOpcional);
// Selo "visão admin" do /beer — o front só chama quando tem login de admin
// no navegador; o motivo ajuda a entender quando não ligou.
router.get('/modo-qa', (req, res) => res.json({ modo_qa: req.modoQa, motivo: req.modoQaMotivo }));
router.get('/categorias', ctrl.getCategorias);
router.get('/resumo', ctrl.getResumo);
router.get('/vitrine', ctrl.getVitrine);
router.get('/estabelecimentos', ctrl.getEstabelecimentos);
router.get('/estabelecimentos/:slug', ctrl.getEstabelecimento);
router.get('/estabelecimentos/:slug/produtos', ctrl.getProdutosEstabelecimento);
// /produtos/quero-agora ANTES de qualquer /produtos/:algo futuro
router.get('/produtos/quero-agora', ctrl.getQueroAgora);
router.get('/produtos', ctrl.getProdutos);
router.get('/produtos/:id', ctrl.getProduto);
router.get('/categoria/:codigo', ctrl.getCategoria);

// Escritas do +18 gravam log — limite contra spam de INSERT.
const limiteIdade = simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
router.post('/verificar-idade', limiteIdade, lerPainelPublicoOpcional, ctrl.verificarIdade);
router.post('/registrar-acesso', limiteIdade, lerPainelPublicoOpcional, ctrl.registrarAcesso);

module.exports = router;
