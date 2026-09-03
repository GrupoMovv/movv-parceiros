const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/parceiroInteressadosController');

// Mesma regra de acesso das outras telas do IUB MAIS no Sindicato: admin
// ou o Renan (colaborador interno com role sindicato_aprendiz).
const requireAcesso = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito' });
};

router.use(authenticate, requireAcesso);

router.get('/', ctrl.listarTodos);

module.exports = router;
