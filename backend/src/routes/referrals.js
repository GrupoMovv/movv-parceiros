const router = require('express').Router();
const { authenticate, requireEquipe } = require('../middleware/auth');
const { listReferrals, createReferral, confirmSale, expireOldReferrals } = require('../controllers/referralController');

router.get('/', authenticate, listReferrals);
router.post('/', authenticate, createReferral);
router.put('/:id/confirm', authenticate, requireEquipe, confirmSale);
router.post('/expire', authenticate, requireEquipe, expireOldReferrals);

module.exports = router;
