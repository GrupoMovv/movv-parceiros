const router = require('express').Router();
const ctrl = require('../controllers/beerController');
const { lerPainelPublicoOpcional } = require('../middleware/painelPublicoAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');

// IUB DISK BEBIDAS — rotas públicas (sob /api/public, igual Food). O que o
// parceiro edita (status, produtos, disponibilidade) fica em
// /api/parceiro/beer (routes/parceiroBeer.js, sessão do parceiro); a
// moderação em /api/sindicato-beer (routes/sindicatoBeer.js, admin).
router.get('/categorias', ctrl.getCategorias);
router.get('/resumo', ctrl.getResumo);
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
