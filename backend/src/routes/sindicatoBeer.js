const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoBeerController');

// Moderação do IUB Disk Bebidas — SÓ admin (não inclui o sindicato_aprendiz
// das outras telas do Sindicato: aprovar bebida/cigarro é decisão do Junior).
router.use(authenticate, requireAdmin);
router.get('/produtos', ctrl.listarProdutos);
router.post('/moderar/:produtoId', ctrl.moderar);
router.get('/log', ctrl.listarLog);

module.exports = router;
