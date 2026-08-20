const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const salesCtrl = require('../controllers/diretaSalesController');
const activitiesCtrl = require('../controllers/diretaActivitiesController');

// Fernando (colaborador interno, role comercial_full) — dono do módulo Direta.
const requireComercialFull = (req, res, next) => {
  if (req.user?.type !== 'internal' || req.user?.role !== 'comercial_full') {
    return res.status(403).json({ error: 'Acesso restrito ao responsável pelo módulo Direta Certificação' });
  }
  next();
};

// Leitura compartilhada: admin vê tudo, Fernando vê o que é dele (filtrado no controller).
const requireAdminOrComercialFull = (req, res, next) => {
  if (req.user?.is_admin) return next();
  return requireComercialFull(req, res, next);
};

// ─── Vendas ──────────────────────────────────────────────────────────────────
router.get('/sales',              authenticate, requireAdminOrComercialFull, salesCtrl.listSales);
router.get('/sales/:id',          authenticate, requireAdminOrComercialFull, salesCtrl.getSale);
router.post('/sales',             authenticate, requireComercialFull,        salesCtrl.createSale);
router.patch('/sales/:id/cancel', authenticate, requireAdminOrComercialFull, salesCtrl.cancelSale);

// ─── Dashboard / metas / folha ───────────────────────────────────────────────
router.get('/dashboard',    authenticate, requireComercialFull,        salesCtrl.getMyDashboard);
router.get('/goal',         authenticate, requireAdminOrComercialFull, salesCtrl.getGoalCurrentMonth);
router.post('/payroll/close', authenticate, requireAdmin,              salesCtrl.closePayroll);

// ─── Atividades (mini-CRM) ───────────────────────────────────────────────────
router.get('/activities',           authenticate, requireAdminOrComercialFull, activitiesCtrl.listActivities);
router.get('/activities/:id',       authenticate, requireAdminOrComercialFull, activitiesCtrl.getActivity);
router.post('/activities',          authenticate, requireComercialFull,        activitiesCtrl.createActivity);
router.put('/activities/:id',       authenticate, requireComercialFull,        activitiesCtrl.updateActivity);
router.delete('/activities/:id',    authenticate, requireComercialFull,        activitiesCtrl.deleteActivity);

module.exports = router;
