const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/contabilidadesPrecosController');

// Leitura e cadastro: admin ou Fernando (ele que cadastra/edita as
// contabilidades que usa no dia a dia pra registrar vendas).
const requireAdminOrComercialFull = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'comercial_full') return next();
  return res.status(403).json({ error: 'Acesso negado' });
};

router.get('/',      authenticate, requireAdminOrComercialFull, ctrl.listContabilidades);
router.get('/:id',   authenticate, requireAdminOrComercialFull, ctrl.getContabilidade);
router.post('/',     authenticate, requireAdminOrComercialFull, ctrl.createContabilidade);
router.put('/:id',   authenticate, requireAdminOrComercialFull, ctrl.updateContabilidade);
router.patch('/:id/ativo', authenticate, requireAdminOrComercialFull, ctrl.toggleAtivo);
router.delete('/:id', authenticate, requireAdminOrComercialFull, ctrl.deleteContabilidade);

module.exports = router;
