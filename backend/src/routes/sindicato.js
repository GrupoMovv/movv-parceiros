const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sindicatoController');

// Renan (colaborador interno, role sindicato_aprendiz) — só visualiza.
const requireSindicatoAprendiz = (req, res, next) => {
  if (req.user?.type !== 'internal' || req.user?.role !== 'sindicato_aprendiz') {
    return res.status(403).json({ error: 'Acesso restrito ao colaborador do Sindicato' });
  }
  next();
};

// ─── Admin ───────────────────────────────────────────────────────────────────
router.get('/faturamentos',           authenticate, requireAdmin, ctrl.listFaturamentos);
router.post('/faturamentos',          authenticate, requireAdmin, ctrl.upsertFaturamento);
router.patch('/faturamentos/:id/close',  authenticate, requireAdmin, ctrl.closeFaturamento);
router.patch('/faturamentos/:id/reopen', authenticate, requireAdmin, ctrl.reopenFaturamento);
router.patch('/faturamentos/:id/paid',   authenticate, requireAdmin, ctrl.markAsPaid);
router.patch('/faturamentos/:id/revert', authenticate, requireAdmin, ctrl.revertPayment);
router.delete('/faturamentos/:id',       authenticate, requireAdmin, ctrl.deleteFaturamento);

// ─── Renan ───────────────────────────────────────────────────────────────────
router.get('/me', authenticate, requireSindicatoAprendiz, ctrl.myBonus);

module.exports = router;
