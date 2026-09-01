const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoSolicitacoesController');

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso completo.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

router.get('/count-pendentes', ctrl.countPendentes);
router.get('/',                ctrl.listSolicitacoes);
router.patch('/:id/status',    ctrl.updateStatus);

module.exports = router;
