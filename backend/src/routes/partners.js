const router = require('express').Router();
const { authenticate, requireAdmin, requireEquipe } = require('../middleware/auth');
const { veTudo } = require('../config/perfilAdmin');
const {
  listPartners, getPartner, createPartner, updatePartner, resetPassword, getMyStats
} = require('../controllers/partnerController');

// Fernando (comercial_full) pode cadastrar novas contabilidades parceiras.
// createPartner força type='accounting' e bloqueia is_admin/parent_id para quem não é admin.
const requireAdminOrComercialFull = (req, res, next) => {
  if (veTudo(req.user)) return next(); // admin ou perfil financeiro
  if (req.user?.type === 'internal' && req.user?.role === 'comercial_full') return next();
  return res.status(403).json({ error: 'Acesso negado' });
};

router.get('/stats', authenticate, getMyStats);
router.get('/', authenticate, requireEquipe, listPartners);
router.get('/:id', authenticate, requireEquipe, getPartner);
router.post('/', authenticate, requireAdminOrComercialFull, createPartner);
router.put('/:id', authenticate, requireEquipe, updatePartner);
router.put('/:id/reset-password', authenticate, requireAdmin, resetPassword);

module.exports = router;
