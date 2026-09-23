const router = require('express').Router();
const ctrl = require('../controllers/beerController');
const { lerPainelPublicoOpcional } = require('../middleware/painelPublicoAuth');
const { simpleRateLimit } = require('../middleware/rateLimit');

// IUB BEER — tudo público (sob /api/public, igual Food). Cadastro de
// estabelecimento e de produto NÃO tem rota própria aqui: estabelecimento
// é parceiro normal com "Bebidas" nas categorias (admin/painel de sempre)
// e produto é o do catálogo (painel do parceiro).
router.get('/estabelecimentos', ctrl.getEstabelecimentos);
router.get('/estabelecimentos/:slug', ctrl.getEstabelecimento);
router.get('/estabelecimentos/:slug/produtos', ctrl.getProdutos);

// Escritas do +18 gravam log — limite contra spam de INSERT.
const limiteIdade = simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
router.post('/verificar-idade', limiteIdade, lerPainelPublicoOpcional, ctrl.verificarIdade);
router.post('/registrar-acesso', limiteIdade, lerPainelPublicoOpcional, ctrl.registrarAcesso);

module.exports = router;
