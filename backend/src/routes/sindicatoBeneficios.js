const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoBeneficiosController');

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso completo.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

router.get('/colaboradores',     ctrl.listColaboradores);
router.post('/colaboradores',    ctrl.createColaborador);
router.put('/colaboradores/:id', ctrl.updateColaborador);
router.delete('/colaboradores/:id', ctrl.deleteColaborador);

// Renan só lê templates ativos; criar/editar é exclusivo do admin.
router.get('/templates',      ctrl.listTemplates);
router.post('/templates',     requireAdmin, ctrl.createTemplate);
router.put('/templates/:id',  requireAdmin, ctrl.updateTemplate);

router.post('/enviar',        ctrl.enviar);
router.post('/enviar-massa',  ctrl.enviarMassa);

module.exports = router;
