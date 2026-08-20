const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  listPartners, getPartner, createPartner, updatePartner, resetPassword, getMyStats
} = require('../controllers/partnerController');

// Fernando (comercial_full) pode cadastrar novas contabilidades parceiras.
// createPartner força type='accounting' e bloqueia is_admin/parent_id para quem não é admin.
const requireAdminOrComercialFull = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'comercial_full') return next();
  return res.status(403).json({ error: 'Acesso negado' });
};

router.get('/stats', authenticate, getMyStats);
router.get('/', authenticate, requireAdmin, listPartners);
router.get('/:id', authenticate, requireAdmin, getPartner);
router.post('/', authenticate, requireAdminOrComercialFull, createPartner);
router.put('/:id', authenticate, requireAdmin, updatePartner);
router.put('/:id/reset-password', authenticate, requireAdmin, resetPassword);

module.exports = router;
