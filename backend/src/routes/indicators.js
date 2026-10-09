const router = require('express').Router();
const ctrl = require('../controllers/indicatorController');
const { authenticate, requireEquipe } = require('../middleware/auth');

// Público
router.post('/register', ctrl.register);
router.get('/products',  ctrl.getProducts);

// Indicator autenticado
const requireIndicator = (req, res, next) => {
  if (req.user?.type !== 'indicator') return res.status(403).json({ error: 'Acesso restrito a indicadores' });
  next();
};

router.get('/me',                     authenticate, requireIndicator, ctrl.getMe);
router.put('/me',                     authenticate, requireIndicator, ctrl.updateMe);
router.put('/me/password',            authenticate, requireIndicator, ctrl.changeMyPassword);
router.get('/dashboard',              authenticate, requireIndicator, ctrl.getDashboard);
router.post('/referrals',             authenticate, requireIndicator, ctrl.createReferral);
router.get('/referrals',              authenticate, requireIndicator, ctrl.listMyReferrals);
router.put('/referrals/:id/renew',    authenticate, requireIndicator, ctrl.renewReferral);
router.get('/my-payments',            authenticate, requireIndicator, ctrl.getMyPayments);

// Admin
router.get('/',                            authenticate, requireEquipe, ctrl.listIndicators);
router.get('/all-referrals',               authenticate, requireEquipe, ctrl.listAllReferrals);
router.put('/referrals/:id/approve',       authenticate, requireEquipe, ctrl.approveReferralAdmin);
router.put('/referrals/:id/cancel',        authenticate, requireEquipe, ctrl.cancelReferralAdmin);
router.get('/payments/pending',            authenticate, requireEquipe, ctrl.getPendingPayments);
router.get('/payments',                    authenticate, requireEquipe, ctrl.listAdminPayments);
router.post('/payments',                   authenticate, requireEquipe, ctrl.createPayment);
router.put('/payments/:id/pay',            authenticate, requireEquipe, ctrl.markPaymentPaid);
router.get('/:id',                         authenticate, requireEquipe, ctrl.getIndicatorById);
router.put('/:id/approve',                 authenticate, requireEquipe, ctrl.approveIndicator);
router.put('/:id/reject',                  authenticate, requireEquipe, ctrl.rejectIndicator);
router.put('/:id/suspend',                 authenticate, requireEquipe, ctrl.suspendIndicator);

module.exports = router;
