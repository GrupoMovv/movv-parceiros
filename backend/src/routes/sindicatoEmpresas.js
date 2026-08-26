const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoEmpresasController');

// Admin e Renan (colaborador interno, role sindicato_aprendiz) têm acesso completo.
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

router.get('/contabilidades',              ctrl.listContabilidades);
router.post('/contabilidades',             ctrl.createContabilidade);
router.get('/contabilidades/:id/empresas', ctrl.listEmpresasDaContabilidade);

router.get('/empresas/:id',          ctrl.getEmpresa);
router.post('/empresas',             ctrl.createEmpresa);
router.put('/empresas/:id',          ctrl.updateEmpresa);
router.put('/empresas/:id/whatsapp', ctrl.updateWhatsapp);

router.post('/cobrancas', ctrl.registrarCobranca);

module.exports = router;
