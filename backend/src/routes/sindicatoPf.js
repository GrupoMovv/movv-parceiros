const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoPfController');

// Verificação do Vendedor Pessoa Física — SÓ admin (vê documento e selfie).
router.use(authenticate, requireAdmin);
router.get('/contagem', ctrl.contagem);
router.get('/verificacao', ctrl.listar);
router.get('/:id/documento/:tipo', ctrl.documento);
router.post('/:id/aprovar', ctrl.aprovar);
router.post('/:id/rejeitar', ctrl.rejeitar);

module.exports = router;
