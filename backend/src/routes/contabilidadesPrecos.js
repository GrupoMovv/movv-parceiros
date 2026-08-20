const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/contabilidadesPrecosController');

// Leitura: admin ou Fernando (precisa ver os preços para registrar vendas via contabilidade).
const requireAdminOrComercialFull = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'comercial_full') return next();
  return res.status(403).json({ error: 'Acesso negado' });
};

router.get('/',      authenticate, requireAdminOrComercialFull, ctrl.listPrecos);
router.get('/:id',   authenticate, requireAdminOrComercialFull, ctrl.getPreco);
router.post('/',     authenticate, requireAdminOrComercialFull, ctrl.createPreco);
router.put('/:id',   authenticate, requireAdminOrComercialFull, ctrl.updatePreco);
router.delete('/:id', authenticate, requireAdmin, ctrl.deletePreco);

module.exports = router;
