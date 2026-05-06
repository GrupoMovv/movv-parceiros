const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listReferrals, createReferral, confirmSale, expireOldReferrals } = require('../controllers/referralController');

router.get('/', authenticate, listReferrals);
router.post('/', authenticate, createReferral);
router.put('/:id/confirm', authenticate, requireAdmin, confirmSale);
router.post('/expire', authenticate, requireAdmin, expireOldReferrals);

module.exports = router;
