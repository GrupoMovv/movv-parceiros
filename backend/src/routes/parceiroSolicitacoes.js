const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/parceiroSolicitacaoController');

// Mesma regra de acesso de sindicato-solicitacoes: admin ou o Renan (colaborador
// interno com role sindicato_aprendiz) — é ele quem cuida do IUB MAIS no dia a dia.
const requireAcesso = (req, res, next) => {
  if (req.user?.is_admin) return next();
  if (req.user?.type === 'internal' && req.user?.role === 'sindicato_aprendiz') return next();
  return res.status(403).json({ error: 'Acesso restrito' });
};

router.use(authenticate, requireAcesso);

router.get('/count-pendentes',   ctrl.contarPendentes);
router.get('/',                  ctrl.listarSolicitacoes);
router.get('/:id',               ctrl.detalheSolicitacao);
router.patch('/:id/aprovar',     ctrl.aprovarSolicitacao);
router.patch('/:id/rejeitar',    ctrl.rejeitarSolicitacao);

module.exports = router;
