const router = require('express').Router();
const { authenticate, requireAdmin, requireInternal } = require('../middleware/auth');
const ctrl = require('../controllers/internalCollaboratorController');

// ─── Rotas admin ─────────────────────────────────────────────────────────────
router.get ('/collaborators',          authenticate, requireAdmin, ctrl.listCollaborators);
router.get ('/commissions',            authenticate, requireAdmin, ctrl.listAllCommissions);
router.post('/commissions/preview',    authenticate, requireAdmin, ctrl.previewCommission);
router.post('/commissions',            authenticate, requireAdmin, ctrl.createCommission);
router.put  ('/commissions/:id',        authenticate, requireAdmin, ctrl.updateCommission);
router.delete('/commissions/:id',       authenticate, requireAdmin, ctrl.deleteCommission);
router.patch('/commissions/:id/paid',  authenticate, requireAdmin, ctrl.markAsPaid);
router.patch('/commissions/:id/revert',authenticate, requireAdmin, ctrl.revertToPending);

// ─── Rotas do colaborador (acesso próprio) ────────────────────────────────────
router.get('/me/commissions', authenticate, requireInternal, ctrl.myCommissions);
router.get('/me/summary',     authenticate, requireInternal, ctrl.mySummary);
router.get('/curves',         authenticate,                  ctrl.getCurves);

module.exports = router;
