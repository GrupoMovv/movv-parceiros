const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoFechaMesController');

// Mesmo padrão de acesso das outras telas do Sindicato (admin + Renan).
const requireSindicatoAccess = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito ao Sindicato' });
};

router.use(authenticate, requireSindicatoAccess);

// Rotas literais (/config, /historico, /proximo) precisam vir ANTES de
// /:id — senão o Express casa "config"/"historico" como se fossem :id.
router.get('/proximo', ctrl.getProximo);
router.get('/config', ctrl.getConfig);
router.patch('/config', ctrl.atualizarConfig);
router.get('/historico', ctrl.getHistorico);
router.patch('/:id', ctrl.atualizarEvento);

module.exports = router;
