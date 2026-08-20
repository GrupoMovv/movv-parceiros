const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/contabilidadesPrecosController');

router.get('/',      authenticate, requireAdmin, ctrl.listPrecos);
router.get('/:id',   authenticate, requireAdmin, ctrl.getPreco);
router.post('/',     authenticate, requireAdmin, ctrl.createPreco);
router.put('/:id',   authenticate, requireAdmin, ctrl.updatePreco);
router.delete('/:id', authenticate, requireAdmin, ctrl.deletePreco);

module.exports = router;
