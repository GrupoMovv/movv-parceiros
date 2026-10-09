const router = require('express').Router();
const { authenticate, requireAdmin, requireEquipe, requireInternal } = require('../middleware/auth');
const ctrl = require('../controllers/internalCollaboratorController');

// ─── Rotas admin ─────────────────────────────────────────────────────────────
router.get ('/collaborators',          authenticate, requireEquipe, ctrl.listCollaborators);
router.get ('/commissions',            authenticate, requireEquipe, ctrl.listAllCommissions);
router.post('/commissions/preview',    authenticate, requireEquipe, ctrl.previewCommission);
router.post('/commissions',            authenticate, requireEquipe, ctrl.createCommission);
router.put  ('/commissions/:id',        authenticate, requireEquipe, ctrl.updateCommission);
router.delete('/commissions/:id',       authenticate, requireEquipe, ctrl.deleteCommission);
router.patch('/commissions/:id/paid',  authenticate, requireEquipe, ctrl.markAsPaid);
router.patch('/commissions/:id/revert',authenticate, requireEquipe, ctrl.revertToPending);
router.post ('/reset-password/:collaboratorId', authenticate, requireAdmin, ctrl.resetPassword);

// ─── Rotas do colaborador (acesso próprio) ────────────────────────────────────
router.get('/me/commissions', authenticate, requireInternal, ctrl.myCommissions);
router.get('/me/summary',     authenticate, requireInternal, ctrl.mySummary);

module.exports = router;
