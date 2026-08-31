const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoAssociadosController');

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso completo.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

router.get('/stats',        ctrl.stats);
router.get('/',              ctrl.listAssociados);
router.get('/:id',           ctrl.getAssociado);
router.post('/',             ctrl.createAssociado);
router.put('/:id',           ctrl.updateAssociado);
router.put('/:id/status',    ctrl.updateStatus);

module.exports = router;
