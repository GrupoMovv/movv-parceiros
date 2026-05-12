const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { listCommissions, getStatement, getSummaryByMonth, approveCommissions, approveOne, cancelOne, revertOne } = require('../controllers/commissionController');

router.get('/', authenticate, listCommissions);
router.get('/statement', authenticate, getStatement);
router.get('/summary', authenticate, getSummaryByMonth);
router.put('/approve', authenticate, requireAdmin, approveCommissions);
router.patch('/:id/approve', authenticate, requireAdmin, approveOne);
router.patch('/:id/cancel', authenticate, requireAdmin, cancelOne);
router.patch('/:id/revert', authenticate, requireAdmin, revertOne);

module.exports = router;
