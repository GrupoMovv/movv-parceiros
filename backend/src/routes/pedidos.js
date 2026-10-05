const router = require('express').Router();
const ctrl = require('../controllers/pedidoClienteController');
const { authenticatePainelPublico, lerPainelPublicoOpcional } = require('../middleware/painelPublicoAuth');
const { lerAdminOpcionalCabecalho } = require('../middleware/auth');
const { simpleRateLimit } = require('../middleware/rateLimit');

// Pedido pelo site — lado do cliente (/api/public/pedidos). Sessão do /meu
// no Authorization; admin testando a empresa de teste manda o próprio JWT
// no x-admin-token (req.modoQa).
router.use(simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 120 }));
router.use(lerAdminOpcionalCabecalho);

router.get('/disponibilidade', lerPainelPublicoOpcional, ctrl.disponibilidade);

router.use(authenticatePainelPublico);
router.get('/', ctrl.listar);
router.get('/enderecos-recentes', ctrl.enderecosRecentes);
router.post('/cotacao', ctrl.cotacao);
router.post('/', simpleRateLimit({ windowMs: 10 * 60 * 1000, max: 15 }), ctrl.criar);
router.get('/:id', ctrl.detalhe);
router.post('/:id/cancelar', ctrl.cancelar);
router.post('/:id/recebi', ctrl.recebi);

module.exports = router;
