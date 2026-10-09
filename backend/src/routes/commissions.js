const router = require('express').Router();
const { authenticate, requireEquipe } = require('../middleware/auth');
const { listCommissions, getStatement, getSummaryByMonth, approveCommissions, approveOne, cancelOne, revertOne } = require('../controllers/commissionController');

router.get('/', authenticate, listCommissions);
router.get('/statement', authenticate, getStatement);
router.get('/summary', authenticate, getSummaryByMonth);
router.put('/approve', authenticate, requireEquipe, approveCommissions);
router.patch('/:id/approve', authenticate, requireEquipe, approveOne);
router.patch('/:id/cancel', authenticate, requireEquipe, cancelOne);
router.patch('/:id/revert', authenticate, requireEquipe, revertOne);

module.exports = router;
